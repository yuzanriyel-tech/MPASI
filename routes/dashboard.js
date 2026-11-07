const router = require('express').Router();
const db = require('../lib/db');
const { wajibLogin } = require('../lib/guard');

router.get('/', wajibLogin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const semua = await db.bahan();
  const daftar = q
    ? semua.filter((b) => (b.nama + ' ' + b.kode + ' ' + b.kategori).toLowerCase().includes(q.toLowerCase()))
    : semua;
  const perlu = semua.filter(db.perluPesan);
  res.render('dashboard', {
    title: 'Dashboard', active: 'dashboard', q,
    daftar, total: semua.length, perlu, aman: semua.length - perlu.length
  });
});

module.exports = router;
