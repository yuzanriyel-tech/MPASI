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
  res.status(status).render('master-form', { title: mode === 'baru' ? 'Tambah bahan' : 'Edit bahan', active: 'master', mode, values, errors, alert });
}

router.get('/master/baru', wajibPengelola, (req, res) => {
  formBahan(res, { mode: 'baru', values: { kode: db.nextKode(), saldo: '0' } });
});

function validasi(body, mode) {
  const v = {
    nama: String(body.nama || '').trim(), kategori: String(body.kategori || '').trim(),
    satuanBeli: String(body.satuanBeli || '').trim(), satuanPakai: String(body.satuanPakai || '').trim(),
    isi: String(body.isi || '').trim(), minimum: String(body.minimum || '').trim(), saldo: String(body.saldo ?? '0').trim()
  };
  const e = {};
  if (!v.nama) e.nama = WAJIB;
  if (!v.kategori) e.kategori = WAJIB;
  if (!v.satuanBeli) e.satuanBeli = WAJIB;
  if (!v.satuanPakai) e.satuanPakai = WAJIB;
  const isi = parseAngka(v.isi);
  if (!v.isi) e.isi = WAJIB; else if (!(isi > 0)) e.isi = 'Isi per satuan beli harus berupa angka lebih dari 0';
  const min = parseAngka(v.minimum);
  if (!v.minimum) e.minimum = WAJIB; else if (Number.isNaN(min)) e.minimum = 'Minimum harus berupa angka'; else if (min < 0) e.minimum = 'Minimum tidak boleh negatif';
  let saldo = 0;
  if (mode === 'baru') {
    saldo = parseAngka(v.saldo || '0');
    if (Number.isNaN(saldo) || saldo < 0) e.saldo = 'Saldo awal harus berupa angka 0 atau lebih';
  }
  return { v, e, isi, min, saldo };
}
const ALERT = { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Kolom wajib tidak boleh kosong dan angka harus valid.' };

router.post('/master/baru', wajibPengelola, (req, res) => {
  const { v, e, isi, min, saldo } = validasi(req.body, 'baru');
  v.kode = db.nextKode();
  if (Object.keys(e).length) return formBahan(res, { mode: 'baru', values: v, errors: e, alert: ALERT, status: 400 });
  db.addBahan({ kode: v.kode, nama: v.nama, kategori: v.kategori, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, saldo, minimum: min });
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
  const { v, e, isi, min } = validasi(req.body, 'edit');
  v.kode = b.kode; v.saldo = b.saldo;
  if (Object.keys(e).length) return formBahan(res, { mode: 'edit', values: v, errors: e, alert: ALERT, status: 400 });
  Object.assign(b, { nama: v.nama, kategori: v.kategori, satuanBeli: v.satuanBeli, isi, satuanPakai: v.satuanPakai, minimum: min });
  db.save();
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `Perubahan ${b.nama} berhasil disimpan.` };
  res.redirect('/master');
});

module.exports = router;
