const router = require('express').Router();
const db = require('../lib/db');
const { isISODate } = require('../lib/format');
const { wajibPengelola } = require('../lib/guard');

const net = (t) => (t.jenis === 'masuk' ? t.jumlah : -t.jumlah);
const jumlahkan = (arr, fn) => db.round(arr.reduce((s, t) => s + fn(t), 0));

router.get('/laporan', wajibPengelola, async (req, res) => {
  const semuaBahan = await db.bahan();
  const dari = isISODate(req.query.dari) ? req.query.dari : '';
  const sampai = isISODate(req.query.sampai) ? req.query.sampai : '';
  const jenis = ['masuk', 'keluar'].includes(req.query.jenis) ? req.query.jenis : '';
  const kode = semuaBahan.some((b) => b.kode === String(req.query.kode || '')) ? String(req.query.kode) : '';

  const bahanMap = Object.fromEntries(semuaBahan.map((b) => [b.kode, b]));
  const semua = await db.transaksi();
  const dalamPeriode = (t) => (!dari || t.tanggal >= dari) && (!sampai || t.tanggal <= sampai);
  const sesuaiBahan = (t) => !kode || t.kode === kode;

  const baris = semua
    .filter((t) => dalamPeriode(t) && sesuaiBahan(t) && (!jenis || t.jenis === jenis))
    .sort((a, b) => (b.tanggal + String(b.id).padStart(6, '0')).localeCompare(a.tanggal + String(a.id).padStart(6, '0')))
    .map((t) => ({ ...t, bahan: bahanMap[t.kode] }));

  // Rekap per bahan: saldo awal + masuk - keluar
  const rekap = semuaBahan.filter((b) => !kode || b.kode === kode).map((b) => {
    const txB = semua.filter((t) => t.kode === b.kode);
    const periode = txB.filter(dalamPeriode);
    return {
      b,
      awal: db.round(b.saldo - jumlahkan(txB.filter((t) => !dari || t.tanggal >= dari), net)),
      masuk: jumlahkan(periode.filter((t) => t.jenis === 'masuk'), (t) => t.jumlah),
      keluar: jumlahkan(periode.filter((t) => t.jenis === 'keluar'), (t) => t.jumlah),
      akhir: db.round(b.saldo - jumlahkan(txB.filter((t) => sampai && t.tanggal > sampai), net)),
      adaTx: periode.length > 0
    };
  });

  const users = Object.fromEntries((await db.users()).map((u) => [u.username, u.nama]));
  res.render('laporan', {
    title: 'Laporan & Riwayat', active: 'laporan',
    baris, rekap, kosong: !rekap.some((r) => r.adaTx), users, filter: { dari, sampai, jenis, kode },
    bahanList: semuaBahan, bahanTerpilih: kode ? bahanMap[kode] : null,
    jml: { total: baris.length, masuk: baris.filter((t) => t.jenis === 'masuk').length, keluar: baris.filter((t) => t.jenis === 'keluar').length }
  });
});

module.exports = router;
