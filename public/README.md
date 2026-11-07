# Cafe Radjo Roastery: Sistem Informasi Persediaan

Aplikasi web persediaan bahan baku (Express 4 + EJS + MySQL/MariaDB via Sequelize).

## Menjalankan

Butuh Node.js 18+ dan MySQL/MariaDB (mis. Laragon).

```bash
npm install
cp .env.example .env        # sesuaikan DB_*; buat dulu database kosong bernama DB_NAME
npm run db:reset            # migrasi 7 tabel + data awal (hapus semua tabel lalu buat ulang)
npm start                   # http://localhost:3000
```

Perintah database lain: `npm run db:migrate`, `npm run db:seed`.
Jalankan `db:seed` hanya pada database kosong (data awal punya kode unik, jadi dua kali seed akan error).

## Akun demo

| Peran     | Username | Password    |
|-----------|----------|-------------|
| Pengelola | `aditya` | `aditya123` |
| Karyawan  | `rani`   | `rani123`   |

## Struktur

```
server.js            entri aplikasi (session, CSRF, helper view)
routes/              auth, dashboard, stok, master, pemantauan, laporan, akun, pencarian
lib/db.js            lapisan data (query, transaksi stok masuk/keluar FEFO)
lib/password.js      hash password (scrypt)
db/migrations/       skema 7 tabel sesuai ERD
db/models/           model Sequelize dan relasi
db/seeders/          data awal (data dummy bahan baku, pemasok, akun, batch pembuka)
config/config.js     konfigurasi koneksi database
views/, public/      tampilan (EJS, CSS, JS)
```

## Aturan bisnis

- Saldo ≤ minimum berarti **Perlu dipesan ulang**.
- Stok Masuk diinput dalam **satuan beli** dan dikonversi ke **satuan pakai**. Tiap Stok Masuk menjadi satu batch (`stok_masuk`) dengan tanggal kedaluwarsa dan sisanya sendiri.
- Stok Keluar diinput dalam satuan pakai, tidak boleh melebihi saldo, dan mengambil dari batch yang paling cepat kedaluwarsa (FEFO). Rinciannya disimpan di `detail_stok_keluar`. Semuanya dalam satu transaksi database dengan row lock.
- Bahan baku yang sudah punya riwayat transaksi tidak bisa dihapus.
- Karyawan hanya melihat Dashboard, Stok Masuk, Stok Keluar. Menu Pengelolaan khusus Pengelola.

## Catatan

- Data awal: `Master_Data_Bahan_Baku_Dummy.xlsx` (Nadila), satuan huruf kecil, stok awal BB-014 diubah menjadi 80 agar di bawah minimum. Stok awal menjadi satu batch pembuka per bahan; tanggalnya hari seed dijalankan (atur dengan `SEED_TANGGAL` di `.env`).
- Server memakai zona waktu `Asia/Jakarta` agar tanggal "hari ini" benar walau di-host pada server UTC.
- Untuk produksi: set `SESSION_SECRET`, gunakan HTTPS, store sesi persisten, ganti password akun demo.
