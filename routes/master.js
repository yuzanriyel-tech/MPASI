const router = require('express').Router();
const db = require('../lib/db');
const { parseAngka } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

const WAJIB = 'Data wajib diisi';

router.get('/master', wajibPengelola, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const kategoriAktif = String(req.query.kategori || '');
  const semua = db.bahan();
  const kategori = [...new Set(semua.map((b) => b.kategori))];
  const daftar = semua.filter((b) =>
    (!kategoriAktif || b.kategori === kategoriAktif) &&
    (!q || (b.nama + ' ' + b.kode).toLowerCase().includes(q)));
  res.render('master', { title: 'Master Bahan Baku', active: 'master', daftar, kategori, kategoriAktif, cari: String(req.query.q || '') });
});

function formBahan(res, { mode, values = {}, errors = {}, alert = null, status = 200 }) {
  const daftarPemasok = db.pemasok ? db.pemasok() : []; // Menarik data pemasok
  res.status(status).render('master-form', { title: mode === 'baru' ? 'Tambah bahan' : 'Edit bahan', active: 'master', mode, values, errors, alert, daftarPemasok });
}

router.get('/master/baru', wajibPengelola, (req, res) => {
  formBahan(res, { mode: 'baru', values: { kode: db.nextKode(), saldo: '0' } });
});

function validasi(body) {
  const v = {
    nama: String(body.nama || '').trim(), kategori: String(body.kategori || '').trim(),
    pemasok: String(body.pemasok || '').trim(), 
    satuanBeli: String(body.satuanBeli || '').trim(), satuanPakai: String(body.satuanPakai || '').trim(),
    isi: String(body.isi || '').trim(), minimum: String(body.minimum || '').trim(),
    masaSimpan: String(body.masaSimpan || '').trim() 
  };
  const e = {};
  if (!v.nama) e.nama = WAJIB;
  if (!v.kategori) e.kategori = WAJIB;
  if (!v.pemasok) e.pemasok = WAJIB;
  if (!v.satuanBeli) e.satuanBeli = WAJIB;
  if (!v.satuanPakai) e.satuanPakai = WAJIB;
  
  const isi = parseAngka(v.isi);
  if (!v.isi) e.isi = WAJIB; else if (!(isi > 0)) e.isi = 'Isi per satuan beli harus lebih dari 0';
  
  const min = parseAngka(v.minimum);
  if (!v.minimum) e.minimum = WAJIB; else if (Number.isNaN(min) || min < 0) e.minimum = 'Minimum tidak boleh negatif';

  const masa = parseInt(v.masaSimpan, 10);
  if (!v.masaSimpan) e.masaSimpan = WAJIB; else if (Number.isNaN(masa) || masa <= 0) e.masaSimpan = 'Masa simpan tidak valid';

  return { v, e, isi, min, masa }; // <- Pastikan masa ditambahkan di sini
}

const ALERT = { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Kolom wajib tidak boleh kosong dan angka harus valid.' };

router.post('/master/baru', wajibPengelola, (req, res) => {
  const { v, e, isi, min, masa } = validasi(req.body); // Ambil 'masa'
  v.kode = db.nextKode();
  
  if (Object.keys(e).length) return formBahan(res, { mode: 'baru', values: v, errors: e, alert: ALERT, status: 400 });
  
  // Saldo di-hardcode 0, pemasok dan masaSimpan dimasukkan
  db.addBahan({ kode: v.kode, nama: v.nama, kategori: v.kategori, pemasok: v.pemasok, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, saldo: 0, minimum: min, masaSimpan: masa });
  
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `${v.nama} ditambahkan ke master bahan baku.` };
  res.redirect('/master');
});

router.get('/master/:kode/edit', wajibPengelola, (req, res, next) => {
  const b = db.bahanByKode(req.params.kode);
  if (!b) return next();
  formBahan(res, { mode: 'edit', values: { ...b, isi: String(b.isi), minimum: String(b.minimum) } });
});

router.post('/master/:kode/edit', wajibPengelola, (req, res, next) => {
  const b = db.bahanByKode(req.params.kode);
  if (!b) return next();
  
  const { v, e, isi, min, masa } = validasi(req.body);
  v.kode = b.kode; 
  v.saldo = b.saldo; // Pertahankan saldo lama
  
  if (Object.keys(e).length) return formBahan(res, { mode: 'edit', values: v, errors: e, alert: ALERT, status: 400 });
  
  // Update data termasuk pemasok dan masaSimpan
  Object.assign(b, { nama: v.nama, kategori: v.kategori, pemasok: v.pemasok, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, minimum: min, masaSimpan: masa });
  
  db.save();
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `Perubahan ${b.nama} berhasil disimpan.` };
  res.redirect('/master');
});

// Route POST untuk menghapus bahan
router.post('/master/:kode/hapus', wajibPengelola, (req, res, next) => {
  const b = db.bahanByKode(req.params.kode);
  if (!b) return next();

  try {
    // Ambil semua data bahan, cari urutannya, lalu hapus dari array
    const semuaBahan = db.bahan();
    const index = semuaBahan.findIndex(item => item.kode === b.kode);
    
    if (index !== -1) {
      semuaBahan.splice(index, 1); // Potong data dari array
      db.save(); // Simpan ulang database
    }

    req.session.flash = { 
      tipe: 'ok', 
      judul: 'Bahan dihapus', 
      isi: `${b.nama} berhasil dihapus dari sistem.` 
    };
    res.redirect('/master');
    
  } catch (err) {
    console.error("Error Hapus:", err);
    req.session.flash = { 
      tipe: 'err', 
      judul: 'Gagal menghapus', 
      isi: 'Terjadi kesalahan saat menghapus data bahan.' 
    };
    res.redirect(`/master/${b.kode}/edit`);
  }
});

module.exports = router;
