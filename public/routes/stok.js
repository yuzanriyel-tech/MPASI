const router = require('express').Router();
const db = require('../lib/db');
const { parseAngka, isISODate, todayISO } = require('../lib/format');
const { wajibLogin } = require('../lib/guard');

const ERR_JUMLAH = 'Jumlah harus lebih dari 0. Tidak boleh kosong, 0, atau negatif.';
const WAJIB = 'Data wajib diisi';
const ALERT_GAGAL = { tipe: 'err', judul: 'Gagal menyimpan', isi: 'Data belum tersimpan dan saldo tidak berubah. Periksa isian lalu coba simpan lagi.' };
const bahanJson = async () => (await db.bahan()).map((b) => ({
  kode: b.kode, nama: b.nama, saldo: b.saldo, minimum: b.minimum,
  satuanPakai: b.satuanPakai, satuanBeli: b.satuanBeli, isi: b.isi
}));

/* ===================== STOK MASUK ===================== */
async function renderMasuk(res, extra = {}) {
  res.render('stok-masuk', {
    title: 'Stok Masuk', active: 'masuk', errors: {}, values: {}, alert: null,
    bahanData: await bahanJson(), pemasok: await db.pemasok(), hariIni: todayISO(), ...extra
  });
}
router.get('/stok-masuk', wajibLogin, (req, res) => renderMasuk(res, { values: { tanggalMasuk: todayISO() } }));

router.post('/stok-masuk', wajibLogin, async (req, res) => {
  // Kolom catatan tidak ada di stok_masuk
  const v = {
    kode: String(req.body.kode || ''), pemasok: String(req.body.pemasok || ''),
    jumlah: String(req.body.jumlah || ''), tanggalMasuk: String(req.body.tanggalMasuk || ''),
    kedaluwarsa: String(req.body.kedaluwarsa || '')
  };
  const errors = {};
  const b = await db.bahanByKode(v.kode);
  const daftarPemasok = await db.pemasok();
  if (!b) errors.kode = WAJIB;
  if (!v.pemasok || !daftarPemasok.includes(v.pemasok)) errors.pemasok = WAJIB;
  const jumlah = parseAngka(v.jumlah);
  if (!(jumlah > 0)) errors.jumlah = ERR_JUMLAH;
  if (!isISODate(v.tanggalMasuk)) errors.tanggalMasuk = WAJIB;
  if (!isISODate(v.kedaluwarsa)) errors.kedaluwarsa = WAJIB;
  else if (isISODate(v.tanggalMasuk) && v.kedaluwarsa < v.tanggalMasuk) {
    errors.kedaluwarsa = 'Tanggal kedaluwarsa tidak boleh sebelum tanggal masuk';
  }
  if (Object.keys(errors).length) {
    return res.status(400).render('stok-masuk', {
      title: 'Stok Masuk', active: 'masuk', errors, values: v, bahanData: await bahanJson(), pemasok: daftarPemasok, hariIni: todayISO(),
      alert: { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Jumlah harus lebih dari 0. Kolom wajib tidak boleh kosong.' }
    });
  }
  try {
    await db.catat({
      jenis: 'masuk', kode: b.kode, jumlahPakai: db.round(jumlah * b.isi), jumlahBeli: jumlah,
      pemasok: v.pemasok, tanggalMasuk: v.tanggalMasuk, kedaluwarsa: v.kedaluwarsa,
      oleh: res.locals.user.username, tanggal: todayISO()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).render('stok-masuk', {
      title: 'Stok Masuk', active: 'masuk', errors: {}, values: v, bahanData: await bahanJson(),
      pemasok: daftarPemasok, hariIni: todayISO(), alert: ALERT_GAGAL
    });
  }
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: 'Saldo bahan telah diperbarui.' };
  res.redirect('/');
});

/* ===================== STOK KELUAR ===================== */
async function renderKeluar(res, extra = {}) {
  res.render('stok-keluar', {
    title: 'Stok Keluar', active: 'keluar', errors: {}, values: {}, alert: null,
    bahanData: await bahanJson(), hariIni: todayISO(), ...extra
  });
}
router.get('/stok-keluar', wajibLogin, async (req, res) => {
  const values = {};
  if (req.query.kode && await db.bahanByKode(String(req.query.kode))) values.kode = String(req.query.kode);
  renderKeluar(res, { values });
});

router.post('/stok-keluar', wajibLogin, async (req, res) => {
  const v = { kode: String(req.body.kode || ''), jumlah: String(req.body.jumlah || ''), catatan: String(req.body.catatan || '').trim() };
  const errors = {};
  const b = await db.bahanByKode(v.kode);
  if (!b) errors.kode = WAJIB;
  const jumlah = parseAngka(v.jumlah);
  if (!(jumlah > 0)) errors.jumlah = ERR_JUMLAH;
  else if (b && jumlah > b.saldo) {
    errors.jumlah = `Stok tidak mencukupi. Saldo tersedia ${b.saldo.toString().replace('.', ',')} ${b.satuanPakai}.`;
  }
  const tolakStokKurang = async (pesan) => res.status(400).render('stok-keluar', {
    title: 'Stok Keluar', active: 'keluar', errors: { jumlah: pesan }, values: v, bahanData: await bahanJson(), hariIni: todayISO(),
    alert: { tipe: 'err', judul: 'Stok tidak mencukupi', isi: 'Periksa jumlah dan satuan sebelum menyimpan.' }
  });
  if (Object.keys(errors).length) {
    const kurang = errors.jumlah && errors.jumlah.startsWith('Stok tidak mencukupi');
    if (kurang) return tolakStokKurang(errors.jumlah);
    return res.status(400).render('stok-keluar', {
      title: 'Stok Keluar', active: 'keluar', errors, values: v, bahanData: await bahanJson(), hariIni: todayISO(),
      alert: { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Jumlah harus lebih dari 0. Kolom wajib tidak boleh kosong.' }
    });
  }
  try {
    // jenis_keluar default 'pemakaian'
    await db.catat({ jenis: 'keluar', kode: b.kode, jumlahPakai: jumlah, catatan: v.catatan, jenisKeluar: 'pemakaian', oleh: res.locals.user.username, tanggal: todayISO() });
  } catch (err) {
    // Saldo berubah oleh pengguna lain
    if (err.code === 'STOK_KURANG') return tolakStokKurang(err.message);
    console.error(err);
    return res.status(500).render('stok-keluar', {
      title: 'Stok Keluar', active: 'keluar', errors: {}, values: v, bahanData: await bahanJson(), hariIni: todayISO(), alert: ALERT_GAGAL
    });
  }
  req.session.flash = {
    tipe: 'ok',
    judul: 'Data tersimpan',
    isi: `Pemakaian ${b.nama} sebanyak ${jumlah.toString().replace('.', ',')} ${b.satuanPakai} berhasil dicatat.`
  };
  res.redirect('/');
});

module.exports = router;
