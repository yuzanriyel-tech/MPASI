const router = require('express').Router();
const db = require('../lib/db');
const { isISODate } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

router.get('/laporan', wajibPengelola, (req, res) => {
  const dari = isISODate(req.query.dari) ? req.query.dari : '';
  const sampai = isISODate(req.query.sampai) ? req.query.sampai : '';
  const jenis = ['masuk', 'keluar'].includes(req.query.jenis) ? req.query.jenis : '';
  const kode = db.bahanByKode(String(req.query.kode || '')) ? String(req.query.kode) : '';

  const bahanMap = Object.fromEntries(db.bahan().map((b) => [b.kode, b]));
  const baris = db.transaksi()
    .filter((t) => (!dari || t.tanggal >= dari) && (!sampai || t.tanggal <= sampai) && (!jenis || t.jenis === jenis) && (!kode || t.kode === kode))
    .sort((a, b) => (b.tanggal + String(b.id).padStart(6, '0')).localeCompare(a.tanggal + String(a.id).padStart(6, '0')))
    .map((t) => ({ ...t, bahan: bahanMap[t.kode] }));

  const users = Object.fromEntries(db.users().map((u) => [u.username, u.nama]));
  res.render('laporan', {
    title: 'Laporan & Riwayat Transaksi', active: 'laporan',
    baris, users, filter: { dari, sampai, jenis, kode }, bahanList: db.bahan(),
    jml: { total: baris.length, masuk: baris.filter((t) => t.jenis === 'masuk').length, keluar: baris.filter((t) => t.jenis === 'keluar').length }
  });
});

module.exports = router;
