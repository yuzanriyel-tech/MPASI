const router = require('express').Router();
const db = require('../lib/db');

router.get('/login', (req, res) => {
  if (res.locals.user) return res.redirect('/');
  res.render('login', { title: 'Login', error: null, values: {} });
});

router.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const errors = {};
  if (!username) errors.username = 'Data wajib diisi';
  if (!password) errors.password = 'Data wajib diisi';
  if (Object.keys(errors).length) {
    return res.status(400).render('login', { title: 'Login', error: null, errors, values: { username } });
  }
  const u = await db.user(username);
  if (!u || !u.aktif || !db.verifyPassword(password, u.password)) {
    return res.status(401).render('login', {
      title: 'Login',
      error: { judul: 'Username atau password salah', isi: 'Periksa kembali username dan password Anda.' },
      errors: {}, values: { username }
    });
  }
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.username = u.username;
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
