const router = require('express').Router();
const db = require('../lib/db');
const { bulanID, todayISO } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

router.get('/pemantauan', wajibPengelola, async (req, res) => {
  let bulan = String(req.query.bulan || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) bulan = todayISO().slice(0, 7);
  const [y, m] = bulan.split('-').map(Number);
  const berikut = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  // Batch bersisa & kedaluwarsa bulan ini
  const semuaBahan = await db.bahan();
  const bahanMap = Object.fromEntries(semuaBahan.map((b) => [b.kode, b]));
  const tx = await db.transaksi();
  const batchBulan = (await db.batchAktif(`${berikut}-01`))
    .filter((x) => x.kedaluwarsa.slice(0, 7) === bulan)
    .sort((a, b) => a.kedaluwarsa.localeCompare(b.kedaluwarsa) || a.kodeBatch.localeCompare(b.kodeBatch))
    .map((x) => ({ ...x, bahan: bahanMap[x.kode] }));

  const rekomendasi = [];
  semuaBahan.forEach((b) => {
    const saldo = db.saldoAwalBulan(b, berikut, tx); // saldo akhir bulan ini
    const perlu = saldo <= b.minimum;
    const bt = batchBulan.filter((x) => x.kode === b.kode);
    if (!perlu && !bt.length) return;
    // Hitung kebutuhan beli untuk minimum & ganti batch kedaluwarsa
    const untukMinimum = perlu ? Math.floor((b.minimum - saldo) / b.isi) + 1 : 0;
    const untukBatch = bt.length ? Math.ceil(bt.reduce((s, x) => s + x.sisa, 0) / b.isi) : 0;
    const jumlahBeli = Math.max(1, untukMinimum, untukBatch);
    const terakhir = tx.filter((t) => t.kode === b.kode && t.jenis === 'masuk' && t.pemasok).pop();
    rekomendasi.push({
      b, saldo, perlu, adaBatch: bt.length > 0, jumlahBeli, jumlahPakai: db.round(jumlahBeli * b.isi),
      pemasok: b.pemasok || (terakhir && terakhir.pemasok) || ''
    });
  });
  rekomendasi.sort((a, c) => Number(c.perlu) - Number(a.perlu));
  const perluList = rekomendasi.filter((r) => r.perlu);

  res.render('pemantauan', {
    title: 'Pemantauan Bulanan', active: 'pemantauan',
    bulan, bulanLabel: bulanID(bulan), rekomendasi, perluList, batchBulan,
    aman: rekomendasi.length === 0 && batchBulan.length === 0,
    tahunPanel: /^\d{4}$/.test(String(req.query.th || '')) ? Number(req.query.th) : y,
    bukaPemilih: req.query.buka === '1'
  });
});

module.exports = router;
