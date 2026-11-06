const router = require('express').Router();
const db = require('../lib/db');
const { wajibPengelola } = require('../lib/guard');

const WAJIB = 'Data wajib diisi';
const PERAN = ['Pengelola', 'Karyawan'];

router.get('/akun', wajibPengelola, (req, res) => {
  const cari = String(req.query.q || '').trim();
  const kunci = cari.toLowerCase();
  const semua = db.users();
  const akun = kunci ? semua.filter((a) => (a.nama + ' ' + a.username + ' ' + a.peran).toLowerCase().includes(kunci)) : semua;
  res.render('akun', { title: 'Akun Pengguna', active: 'akun', akun, cari, totalAkun: semua.length });
});

function form(res, { mode, values = {}, errors = {}, alert = null, status = 200 }) {
  res.status(status).render('akun-form', { title: mode === 'baru' ? 'Tambah akun' : 'Edit akun', active: 'akun', mode, values, errors, alert });
}
const ALERT = { tipe: 'err', judul: 'Periksa kolom yang ditandai', isi: 'Kolom wajib tidak boleh kosong.' };

router.get('/akun/baru', wajibPengelola, (req, res) => form(res, { mode: 'baru', values: { peran: 'Karyawan' } }));

router.post('/akun/baru', wajibPengelola, (req, res) => {
  const v = { nama: String(req.body.nama || '').trim(), username: String(req.body.username || '').trim().toLowerCase(), peran: String(req.body.peran || ''), password: String(req.body.password || '') };
  const e = {};
  if (!v.nama) e.nama = WAJIB;
  if (!v.username) e.username = WAJIB;
  else if (!/^[a-z0-9._-]{3,30}$/.test(v.username)) e.username = 'Username 3–30 karakter: huruf kecil, angka, titik, minus, atau garis bawah';
  else if (db.user(v.username)) e.username = 'Username sudah dipakai';
  if (!PERAN.includes(v.peran)) e.peran = WAJIB;
  if (!v.password) e.password = WAJIB; else if (v.password.length < 6) e.password = 'Password minimal 6 karakter';
  if (Object.keys(e).length) return form(res, { mode: 'baru', values: { ...v, password: '' }, errors: e, alert: ALERT, status: 400 });
  db.addUser({ username: v.username, nama: v.nama, peran: v.peran, aktif: true, password: db.hashPassword(v.password) });
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `Akun ${v.nama} berhasil dibuat.` };
  res.redirect('/akun');
});

router.get('/akun/:username/edit', wajibPengelola, (req, res, next) => {
  const u = db.user(req.params.username);
  if (!u) return next();
  form(res, { mode: 'edit', values: { nama: u.nama, username: u.username, peran: u.peran } });
});

router.post('/akun/:username/edit', wajibPengelola, (req, res, next) => {
  const u = db.user(req.params.username);
  if (!u) return next();
  const v = { nama: String(req.body.nama || '').trim(), username: u.username, peran: String(req.body.peran || ''), password: String(req.body.password || '') };
  const e = {};
  if (!v.nama) e.nama = WAJIB;
  if (!PERAN.includes(v.peran)) e.peran = WAJIB;
  if (v.username === res.locals.user.username && v.peran !== u.peran) e.peran = 'Peran akun sendiri tidak dapat diubah';
  if (v.password && v.password.length < 6) e.password = 'Password minimal 6 karakter';
  if (Object.keys(e).length) return form(res, { mode: 'edit', values: { ...v, password: '' }, errors: e, alert: ALERT, status: 400 });
  u.nama = v.nama; u.peran = v.peran;
  if (v.password) u.password = db.hashPassword(v.password);
  db.save();
  req.session.flash = { tipe: 'ok', judul: 'Data tersimpan', isi: `Perubahan akun ${u.nama} berhasil disimpan.` };
  res.redirect('/akun');
});

router.post('/akun/:username/nonaktifkan', wajibPengelola, (req, res, next) => {
  const u = db.user(req.params.username);
  if (!u) return next();
  if (u.username === res.locals.user.username) { // akun sendiri tidak punya aksi Nonaktifkan
    req.session.flash = { tipe: 'err', judul: 'Tidak dapat dilakukan', isi: 'Akun sendiri tidak dapat dinonaktifkan.' };
    return res.redirect('/akun');
  }
  u.aktif = false; db.save();
  req.session.flash = { tipe: 'ok', judul: 'Akun dinonaktifkan', isi: `${u.nama} tidak dapat Login lagi. Riwayat transaksi tetap tersimpan.` };
  res.redirect('/akun');
});

router.post('/akun/:username/aktifkan', wajibPengelola, (req, res, next) => {
  const u = db.user(req.params.username);
  if (!u) return next();
  u.aktif = true; db.save();
  req.session.flash = { tipe: 'ok', judul: 'Akun diaktifkan', isi: `${u.nama} dapat Login kembali.` };
  res.redirect('/akun');
});

module.exports = router;
