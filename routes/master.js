const router = require('express').Router();
const db = require('../lib/db');
const { parseAngka } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

const WAJIB = 'Data wajib diisi';

router.get('/master', wajibPengelola, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const kategoriAktif = String(req.query.kategori || '');
  const semua = await db.bahan();
  const kategori = [...new Set(semua.map((b) => b.kategori))];
  const daftar = semua.filter((b) =>
    (!kategoriAktif || b.kategori === kategoriAktif) &&
    (!q || (b.nama + ' ' + b.kode).toLowerCase().includes(q)));
  res.render('master', { title: 'Master Bahan Baku', active: 'master', daftar, kategori, kategoriAktif, cari: String(req.query.q || '') });
});

async function formBahan(res, { mode, values = {}, errors = {}, alert = null, status = 200 }) {
  // Dropdown diambil dari database
  const [daftarPemasok, daftarKategori, daftarSatuan] = await Promise.all([db.pemasok(), db.kategori(), db.satuan()]);
  res.status(status).render('master-form', {
    title: mode === 'baru' ? 'Tambah bahan' : 'Edit bahan', active: 'master', mode, values, errors, alert,
    daftarPemasok, daftarKategori, daftarSatuan
  });
}

router.get('/master/baru', wajibPengelola, async (req, res) => {
  await formBahan(res, { mode: 'baru', values: { kode: await db.nextKode(), saldo: '0' } });
});

async function validasi(body) {
  const v = {
    nama: String(body.nama || '').trim(), kategori: String(body.kategori || '').trim(),
    pemasok: String(body.pemasok || '').trim(),
    satuanBeli: String(body.satuanBeli || '').trim(), satuanPakai: String(body.satuanPakai || '').trim(),
    isi: String(body.isi || '').trim(), minimum: String(body.minimum || '').trim(),
    masaSimpan: String(body.masaSimpan || '').trim()
  };
  const e = {};
  const [pemasok, kategori, satuan] = await Promise.all([db.pemasok(), db.kategori(), db.satuan()]);
  if (!v.nama) e.nama = WAJIB;
  if (!v.kategori || !kategori.includes(v.kategori)) e.kategori = WAJIB;
  if (!v.pemasok || !pemasok.includes(v.pemasok)) e.pemasok = WAJIB;
  if (!v.satuanBeli || !satuan.beli.includes(v.satuanBeli)) e.satuanBeli = WAJIB;
  if (!v.satuanPakai || !satuan.pakai.includes(v.satuanPakai)) e.satuanPakai = WAJIB;

  const isi = parseAngka(v.isi);
  if (!v.isi) e.isi = WAJIB; else if (!(isi > 0)) e.isi = 'Isi per satuan beli harus lebih dari 0';

  const min = parseAngka(v.minimum);
  if (!v.minimum) e.minimum = WAJIB; else if (Number.isNaN(min) || min < 0) e.minimum = 'Minimum tidak boleh negatif';

  const masa = parseInt(v.masaSimpan, 10);
  if (!v.masaSimpan) e.masaSimpan = WAJIB; else if (Number.isNaN(masa) || masa <= 0) e.masaSimpan = 'Masa simpan tidak valid';

  return { v, e, isi, min, masa };
}

const ALERT = { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Kolom wajib tidak boleh kosong dan angka harus valid.' };

router.post('/master/baru', wajibPengelola, async (req, res) => {
  const { v, e, isi, min, masa } = await validasi(req.body);
  v.kode = await db.nextKode();

  if (Object.keys(e).length) return formBahan(res, { mode: 'baru', values: v, errors: e, alert: ALERT, status: 400 });

  // Saldo awal 0, bertambah via Stok Masuk
  await db.addBahan({ kode: v.kode, nama: v.nama, kategori: v.kategori, pemasok: v.pemasok, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, minimum: min, masaSimpan: masa });

  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `${v.nama} ditambahkan ke master bahan baku.` };
  res.redirect('/master');
});

router.get('/master/:kode/edit', wajibPengelola, async (req, res, next) => {
  const b = await db.bahanByKode(req.params.kode);
  if (!b) return next();
  await formBahan(res, { mode: 'edit', values: { ...b, isi: String(b.isi), minimum: String(b.minimum) } });
});

router.post('/master/:kode/edit', wajibPengelola, async (req, res, next) => {
  const b = await db.bahanByKode(req.params.kode);
  if (!b) return next();

  const { v, e, isi, min, masa } = await validasi(req.body);
  v.kode = b.kode;
  v.saldo = b.saldo; // saldo hanya berubah via transaksi

  if (Object.keys(e).length) return formBahan(res, { mode: 'edit', values: v, errors: e, alert: ALERT, status: 400 });

  await db.updateBahan(b.kode, { nama: v.nama, kategori: v.kategori, pemasok: v.pemasok, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, minimum: min, masaSimpan: masa });

  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `Perubahan ${v.nama} berhasil disimpan.` };
  res.redirect('/master');
});

// Hapus bahan; tolak jika ada riwayat transaksi
router.post('/master/:kode/hapus', wajibPengelola, async (req, res, next) => {
  const b = await db.bahanByKode(req.params.kode);
  if (!b) return next();

  const hasil = await db.hapusBahan(b.kode);
  if (!hasil.ok) {
    req.session.flash = {
      tipe: 'err',
      judul: 'Tidak dapat dihapus',
      isi: `${b.nama} sudah punya riwayat transaksi, jadi datanya dipertahankan agar laporan tetap utuh.`
    };
    return res.redirect(`/master/${b.kode}/edit`);
  }
  req.session.flash = { tipe: 'ok', judul: 'Bahan dihapus', isi: `${b.nama} berhasil dihapus dari sistem.` };
  res.redirect('/master');
});

module.exports = router;
