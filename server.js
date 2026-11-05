const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { icon } = require('./lib/icons');
const fmt = require('./lib/format');
const db = require('./lib/db');

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'radjo.sid',
  secret: process.env.SESSION_SECRET || 'radjo-dev-secret-ganti-di-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

// Variabel & helper yang tersedia di semua view + perlindungan CSRF
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Sesi tidak valid', pesan: 'Sesi formulir tidak valid atau sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.', user: null, active: '' });
  }
  const u = req.session.username ? db.user(req.session.username) : null;
  res.locals.user = u && u.aktif ? u : null;
  res.locals.csrf = req.session.csrf;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.icon = icon;
  res.locals.f = fmt;
  res.locals.perluPesan = db.perluPesan;
  res.locals.active = '';
  res.locals.q = '';
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/stok'));
app.use(require('./routes/master'));
app.use(require('./routes/pemantauan'));
app.use(require('./routes/laporan'));
app.use(require('./routes/akun'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Halaman tidak ditemukan', pesan: 'Halaman yang Anda cari tidak ada atau sudah dipindahkan.' });
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('error', { title: 'Terjadi kesalahan', pesan: 'Terjadi kesalahan pada server. Coba lagi beberapa saat.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Radjo Inventory berjalan di http://localhost:${PORT}`));
