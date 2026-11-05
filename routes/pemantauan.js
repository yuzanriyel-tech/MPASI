const router = require('express').Router();
const db = require('../lib/db');
const { bulanID, todayISO } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

router.get('/pemantauan', wajibPengelola, (req, res) => {
  let bulan = String(req.query.bulan || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) bulan = todayISO().slice(0, 7);
  const [y, m] = bulan.split('-').map(Number);
  const berikut = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  const txBulan = db.transaksi().filter((t) => t.tanggal.slice(0, 7) === bulan);
  const baris = db.bahan().map((b) => {
    const masuk = txBulan.filter((t) => t.kode === b.kode && t.jenis === 'masuk').reduce((s, t) => s + t.jumlah, 0);
    const keluar = txBulan.filter((t) => t.kode === b.kode && t.jenis === 'keluar').reduce((s, t) => s + t.jumlah, 0);
    const awal = db.saldoAwalBulan(b, bulan);
    const akhir = db.saldoAwalBulan(b, berikut);
    return { b, awal, masuk: db.round(masuk), keluar: db.round(keluar), akhir, perlu: akhir <= b.minimum };
  });
  res.render('pemantauan', {
    title: 'Pemantauan Stok Minimum Bulanan', active: 'pemantauan',
    bulan, bulanLabel: bulanID(bulan), baris, kosong: txBulan.length === 0,
    perluCount: baris.filter((r) => r.perlu).length
  });
});

module.exports = router;
