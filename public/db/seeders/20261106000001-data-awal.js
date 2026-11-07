'use strict';
// Data awal: 2 akun, kategori, pemasok, 15 bahan baku.
// Tanggal batch = hari seed atau SEED_TANGGAL di .env.
const { hashPassword } = require('../../lib/password');

const AKUN = [
  { nama: 'Aditya', username: 'aditya', password: 'aditya123', role: 'pengelola' },
  { nama: 'Rani', username: 'rani', password: 'rani123', role: 'karyawan' }
];
const KATEGORI = ['Kopi', 'Susu & Dairy', 'Sirup', 'Bubuk', 'Pemanis', 'Pendukung', 'Kemasan', 'Lainnya'];
const PEMASOK = ['Pemasok Pusat', 'CV Sumber Pangan', 'Toko Grosir Maju', 'Toko Es Segar'];

// [kode, nama, kat, satBeli, satPakai, isi, stok, min, pemasok, masa]
const BAHAN = [
  ['BB-001', 'Biji Kopi House Blend', 'Kopi', 'kg', 'gram', 1000, 4500, 2000, 'Pemasok Pusat', 180],
  ['BB-002', 'Biji Kopi Arabika Single Origin', 'Kopi', 'kg', 'gram', 1000, 1800, 1000, 'Pemasok Pusat', 180],
  ['BB-003', 'Susu Fresh Milk', 'Susu & Dairy', 'karton', 'liter', 12, 18, 5, 'Pemasok Pusat', 14],
  ['BB-004', 'Susu Kental Manis', 'Susu & Dairy', 'kaleng', 'gram', 370, 3700, 1480, 'CV Sumber Pangan', 365],
  ['BB-005', 'Whipped Cream', 'Susu & Dairy', 'kaleng', 'ml', 500, 1500, 1000, 'Pemasok Pusat', 90],
  ['BB-006', 'Sirup Karamel', 'Sirup', 'botol', 'ml', 750, 2250, 500, 'Pemasok Pusat', 270],
  ['BB-007', 'Sirup Vanilla', 'Sirup', 'botol', 'ml', 750, 1500, 500, 'Pemasok Pusat', 270],
  ['BB-008', 'Sirup Hazelnut', 'Sirup', 'botol', 'ml', 750, 300, 500, 'Pemasok Pusat', 270],
  ['BB-009', 'Bubuk Matcha', 'Bubuk', 'pack', 'gram', 500, 1000, 400, 'CV Sumber Pangan', 365],
  ['BB-010', 'Bubuk Cokelat', 'Bubuk', 'pack', 'gram', 1000, 2000, 500, 'CV Sumber Pangan', 365],
  ['BB-011', 'Gula Pasir', 'Pemanis', 'kg', 'gram', 1000, 10000, 3000, 'Toko Grosir Maju', 730],
  ['BB-012', 'Es Batu', 'Pendukung', 'karung', 'kg', 20, 60, 20, 'Toko Es Segar', 2],
  ['BB-013', 'Cup Plastik 12oz', 'Kemasan', 'dus', 'pcs', 1000, 1200, 100, 'Pemasok Pusat', 730],
  ['BB-014', 'Tutup Cup (Lid)', 'Kemasan', 'dus', 'pcs', 1000, 80, 100, 'Pemasok Pusat', 730],
  ['BB-015', 'Sedotan Plastik', 'Kemasan', 'dus', 'pcs', 1000, 2000, 500, 'Pemasok Pusat', 730]
];

const pad = (n) => String(n).padStart(2, '0');
const hariIni = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tambahHari = (iso, hari) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
};
const bulat = (n) => Math.round(n * 100) / 100;

module.exports = {
  async up(qi) {
    const tanggal = process.env.SEED_TANGGAL || hariIni();

    await qi.bulkInsert('users', AKUN.map((a) => ({ nama: a.nama, username: a.username, password: hashPassword(a.password), role: a.role, status_aktif: true })));
    await qi.bulkInsert('kategori', KATEGORI.map((nama_kategori) => ({ nama_kategori })));
    await qi.bulkInsert('pemasok', PEMASOK.map((nama_pemasok) => ({ nama_pemasok, no_telepon: null, alamat: null })));

    const ambil = async (sql) => (await qi.sequelize.query(sql, { type: 'SELECT' }));
    const idKategori = Object.fromEntries((await ambil('SELECT id_kategori, nama_kategori FROM kategori')).map((r) => [r.nama_kategori, r.id_kategori]));
    const idPemasok = Object.fromEntries((await ambil('SELECT id_pemasok, nama_pemasok FROM pemasok')).map((r) => [r.nama_pemasok, r.id_pemasok]));
    const idPengelola = (await ambil("SELECT id_user FROM users WHERE role = 'pengelola' ORDER BY id_user LIMIT 1"))[0].id_user;

    await qi.bulkInsert('bahan_baku', BAHAN.map(([kode, nama, kat, beli, pakai, isi, stok, min, pem, masa]) => ({
      id_kategori: idKategori[kat], id_pemasok: idPemasok[pem], kode_bahan: kode, nama_bahan: nama,
      satuan_beli: beli, satuan_pakai: pakai, isi_per_satuan_beli: isi, stok_saat_ini: stok, stok_minimum: min, masa_simpan_hari: masa
    })));

    const idBahan = Object.fromEntries((await ambil('SELECT id_bahan, kode_bahan FROM bahan_baku')).map((r) => [r.kode_bahan, r.id_bahan]));
    await qi.bulkInsert('stok_masuk', BAHAN.map(([kode, , , , , isi, stok, , pem, masa]) => ({
      id_bahan: idBahan[kode], id_pemasok: idPemasok[pem], id_user: idPengelola,
      kode_batch: `${kode}-${tanggal.replace(/-/g, '')}`, tanggal_masuk: tanggal,
      jumlah_satuan_beli: bulat(stok / isi), jumlah_masuk: stok, sisa_stok: stok,
      tanggal_kedaluwarsa: tambahHari(tanggal, masa)
    })));
  },

  async down(qi) {
    // Urutan terbalik agar tidak langgar FK
    for (const t of ['detail_stok_keluar', 'stok_keluar', 'stok_masuk', 'bahan_baku', 'pemasok', 'kategori', 'users']) {
      await qi.bulkDelete(t, null, {});
    }
  }
};
