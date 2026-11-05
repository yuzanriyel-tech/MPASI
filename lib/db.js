// Penyimpanan sederhana berbasis berkas JSON (data/db.json). Cukup untuk demo / implementasi UI;
// ganti dengan database sungguhan (SQLite/MySQL/PostgreSQL) untuk produksi.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'db.json');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(h, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

function seed() {
  return {
    users: [
      { username: 'aditya', nama: 'Aditya', peran: 'Pengelola', aktif: true, password: hashPassword('aditya123') },
      { username: 'rani', nama: 'Rani', peran: 'Karyawan', aktif: true, password: hashPassword('rani123') }
    ],
    pemasok: ['CV Kopi Nusantara', 'UD Susu Segar Jaya', 'PT Sirup Manis Abadi'],
    bahan: [
      { kode: 'BB-001', nama: 'Biji Kopi Arabika', kategori: 'Kopi', satuanBeli: 'kantong', isi: 1, satuanPakai: 'kg', saldo: 1.8, minimum: 1 },
      { kode: 'BB-002', nama: 'Susu Cair', kategori: 'Susu & Dairy', satuanBeli: 'karton', isi: 12, satuanPakai: 'liter', saldo: 6, minimum: 8 },
      { kode: 'BB-003', nama: 'Sirup Karamel', kategori: 'Sirup', satuanBeli: 'botol', isi: 1, satuanPakai: 'liter', saldo: 2, minimum: 1 }
    ],
    transaksi: []
  };
}

let data;
function load() {
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { data = seed(); save(); }
}
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}
load();

const round = (n) => Math.round(n * 1000) / 1000;

const db = {
  hashPassword, verifyPassword,

  // ---- akun pengguna
  users: () => data.users,
  user: (u) => data.users.find((x) => x.username === String(u || '').trim().toLowerCase()),
  addUser(u) { data.users.push(u); save(); },
  save,

  // ---- pemasok
  pemasok: () => data.pemasok,

  // ---- bahan baku
  bahan: () => data.bahan,
  bahanByKode: (k) => data.bahan.find((b) => b.kode === k),
  nextKode() {
    const max = data.bahan.reduce((m, b) => Math.max(m, Number(b.kode.split('-')[1]) || 0), 0);
    return `BB-${String(max + 1).padStart(3, '0')}`;
  },
  addBahan(b) { data.bahan.push(b); save(); },
  perluPesan: (b) => b.saldo <= b.minimum, // saldo <= minimum => "Perlu dipesan ulang"

  // ---- transaksi
  transaksi: () => data.transaksi,
  catat({ jenis, kode, jumlahPakai, jumlahBeli, pemasok, kedaluwarsa, tanggalMasuk, catatan, oleh, tanggal }) {
    const b = db.bahanByKode(kode);
    b.saldo = round(b.saldo + (jenis === 'masuk' ? jumlahPakai : -jumlahPakai));
    data.transaksi.push({
      id: data.transaksi.length + 1, tanggal, jenis, kode, jumlah: jumlahPakai,
      jumlahBeli: jumlahBeli ?? null, pemasok: pemasok || '', tanggalMasuk: tanggalMasuk || '',
      kedaluwarsa: kedaluwarsa || '', catatan: catatan || '', oleh
    });
    save();
  },

  // Saldo bahan pada awal bulan `ym` ("YYYY-MM") = saldo kini dikurangi selisih transaksi sejak bulan itu.
  saldoAwalBulan(b, ym) {
    const net = data.transaksi
      .filter((t) => t.kode === b.kode && t.tanggal.slice(0, 7) >= ym)
      .reduce((s, t) => s + (t.jenis === 'masuk' ? t.jumlah : -t.jumlah), 0);
    return round(b.saldo - net);
  },
  round
};
module.exports = db;
