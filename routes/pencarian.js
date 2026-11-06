const router = require('express').Router();
const db = require('../lib/db');

// Pencarian global (dropdown navbar): hanya bahan baku, maksimal 6 hasil.
router.get('/api/cari', (req, res) => {
  if (!res.locals.user) return res.status(401).json({ error: 'Silakan login kembali.' });
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (!q) return res.json({ q, total: 0, bahan: [] });
  const kunci = q.toLowerCase();
  const cocok = db.bahan().filter((b) => (b.nama + ' ' + b.kode + ' ' + b.kategori).toLowerCase().includes(kunci));
  res.json({
    q,
    total: cocok.length,
    bahan: cocok.slice(0, 6).map((b) => ({
      kode: b.kode, nama: b.nama, kategori: b.kategori,
      saldo: b.saldo, minimum: b.minimum, satuanPakai: b.satuanPakai, perlu: db.perluPesan(b)
    }))
  });
});

module.exports = router;