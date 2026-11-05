# Cafe Radjo Roastery — Sistem Informasi Persediaan

Implementasi desain Figma **UI MPSI** (Mockup Desktop 1280 px + Mockup Mobile 390 px) dengan **Express.js + EJS**.
Satu kode sumber, responsif: navbar horizontal di desktop, header + menu hamburger + navigasi bawah di mobile
(tabel otomatis berubah menjadi kartu berlabel di bawah 900 px).

## Menjalankan

```bash
npm install
cp .env.example .env     # opsional, atur SESSION_SECRET
npm start                # http://localhost:3000
```

Butuh Node.js 18+. Untuk mode pengembangan: `npm run dev` (auto-reload).

## Akun demo

| Peran     | Username | Password   |
|-----------|----------|------------|
| Pengelola | `aditya` | `aditya123`|
| Karyawan  | `rani`   | `rani123`  |

Ganti segera sebelum dipakai sungguhan (menu **Pengelolaan → Akun Pengguna**).

## Halaman ↔ frame Figma

| Route | Frame Figma | Akses |
|---|---|---|
| `/login` | 01 Login, 02 Login gagal | publik |
| `/` | 03 Dashboard Karyawan, 04 Dashboard Pengelola, 05 Stok aman, 09/12 sukses | semua peran |
| `/stok-masuk` | 10 Stok Masuk, 11 validasi | semua peran |
| `/stok-keluar` | 06 Stok Keluar, 07 wajib diisi, 08 tidak mencukupi | semua peran |
| `/master`, `/master/baru`, `/master/:kode/edit` | 13 Master, 14 edit, 15 validasi, 16 setelah simpan | Pengelola |
| `/pemantauan` | 17 Pemantauan Bulanan, 18 kosong | Pengelola |
| `/laporan` | 19 Laporan dan Riwayat, 20 Laporan kosong | Pengelola |
| `/akun`, `/akun/baru`, `/akun/:username/edit` | 21 Akun, 22 edit & validasi, 23 konfirmasi nonaktifkan | Pengelola |

## Aturan bisnis yang diterapkan (dari Design System)

- Saldo ≤ minimum ⇒ **Perlu dipesan ulang**; saldo > minimum ⇒ **Aman**.
- Stok Masuk dicatat dalam **satuan beli** (mis. karton) dan otomatis dikonversi ke **satuan pakai** (mis. 12 liter/karton).
- Stok Keluar tidak boleh melebihi saldo; jumlah harus > 0.
- Saldo dengan satuan berbeda tidak pernah dijumlahkan.
- Karyawan hanya melihat Dashboard, Stok Masuk, Stok Keluar. Menu Pengelolaan khusus Pengelola.
- Akun sendiri tidak punya aksi Nonaktifkan; akun nonaktif tidak bisa Login.

## Struktur

```
server.js            entri aplikasi (session, CSRF, helper view)
routes/              auth, dashboard, stok, master, pemantauan, laporan, akun
lib/                 db.js (penyimpanan JSON), format.js, icons.js, guard.js
views/               halaman EJS + partials (header, footer, status, combo-bahan)
public/css/styles.css  design tokens + komponen + responsif
public/js/app.js     dropdown, combobox bahan, preview konversi, dialog
data/db.json         dibuat otomatis saat pertama jalan (berisi data awal)
```

## Catatan

- **Penyimpanan** memakai berkas JSON agar langsung jalan tanpa database. Untuk produksi, ganti `lib/db.js`
  dengan SQLite/MySQL/PostgreSQL (antarmuka fungsinya sudah terpisah dari route).
- Password di-hash dengan `scrypt` (bawaan Node), form dilindungi token CSRF, sesi `httpOnly`.
  Untuk produksi: set `SESSION_SECRET`, gunakan HTTPS, store sesi persisten, dan tambahkan pembatasan percobaan login.
- Font **Inter** dimuat dari Google Fonts (ada fallback font sistem). Ikon berupa SVG inline bergaya Lucide.
- Daftar pemasok awal (`CV Kopi Nusantara`, dst.) hanyalah contoh — ubah di `lib/db.js`.
