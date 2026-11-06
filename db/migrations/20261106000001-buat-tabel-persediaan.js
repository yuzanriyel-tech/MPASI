'use strict';
// Membuat 7 tabel sesuai ERD: users, kategori, pemasok, bahan_baku, stok_masuk,
// stok_keluar, detail_stok_keluar. Semua FK memakai ON DELETE RESTRICT supaya
// riwayat transaksi tidak bisa hilang karena master data dihapus.

const fk = (tabel, kolom, wajib = true) => ({
  type: 'INTEGER',
  allowNull: !wajib,
  references: { model: tabel, key: kolom },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT'
});

module.exports = {
  async up(qi, Sequelize) {
    const T = Sequelize;
    const opsi = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };
    const id = { type: T.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false };
    const desimal = (allowNull = false, defaultValue) => ({ type: T.DECIMAL(10, 2), allowNull, ...(defaultValue === undefined ? {} : { defaultValue }) });

    await qi.createTable('users', {
      id_user: id,
      nama: { type: T.STRING(100), allowNull: false },
      username: { type: T.STRING(50), allowNull: false, unique: true },
      password: { type: T.STRING(255), allowNull: false },
      role: { type: T.ENUM('pengelola', 'karyawan'), allowNull: false },
      status_aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: T.DATE, allowNull: false, defaultValue: T.literal('CURRENT_TIMESTAMP') }
    }, opsi);

    await qi.createTable('kategori', {
      id_kategori: id,
      nama_kategori: { type: T.STRING(50), allowNull: false, unique: true }
    }, opsi);

    await qi.createTable('pemasok', {
      id_pemasok: id,
      nama_pemasok: { type: T.STRING(100), allowNull: false },
      no_telepon: { type: T.STRING(20), allowNull: true },
      alamat: { type: T.TEXT, allowNull: true }
    }, opsi);

    await qi.createTable('bahan_baku', {
      id_bahan: id,
      id_kategori: fk('kategori', 'id_kategori'),
      id_pemasok: fk('pemasok', 'id_pemasok', false),
      kode_bahan: { type: T.STRING(10), allowNull: false, unique: true },
      nama_bahan: { type: T.STRING(100), allowNull: false },
      satuan_beli: { type: T.STRING(20), allowNull: false },
      satuan_pakai: { type: T.STRING(20), allowNull: false },
      isi_per_satuan_beli: desimal(),
      stok_saat_ini: desimal(false, 0),
      stok_minimum: desimal(),
      masa_simpan_hari: { type: T.INTEGER, allowNull: true }
    }, opsi);

    await qi.createTable('stok_masuk', {
      id_stok_masuk: id,
      id_bahan: fk('bahan_baku', 'id_bahan'),
      id_pemasok: fk('pemasok', 'id_pemasok', false),
      id_user: fk('users', 'id_user'),
      kode_batch: { type: T.STRING(20), allowNull: false, unique: true },
      tanggal_masuk: { type: T.DATEONLY, allowNull: false },
      jumlah_satuan_beli: desimal(),
      jumlah_masuk: desimal(),
      sisa_stok: desimal(),
      tanggal_kedaluwarsa: { type: T.DATEONLY, allowNull: true }
    }, opsi);
    // Dipakai FEFO: batch dengan sisa > 0 per bahan, urut kedaluwarsa
    await qi.addIndex('stok_masuk', ['id_bahan', 'tanggal_kedaluwarsa'], { name: 'idx_stok_masuk_fefo' });

    await qi.createTable('stok_keluar', {
      id_stok_keluar: id,
      id_bahan: fk('bahan_baku', 'id_bahan'),
      id_user: fk('users', 'id_user'),
      tanggal_keluar: { type: T.DATEONLY, allowNull: false },
      jumlah_keluar: desimal(),
      jenis_keluar: { type: T.ENUM('pemakaian', 'rusak', 'kedaluwarsa'), allowNull: false, defaultValue: 'pemakaian' },
      keterangan: { type: T.TEXT, allowNull: true }
    }, opsi);

    await qi.createTable('detail_stok_keluar', {
      id_detail: id,
      id_stok_keluar: fk('stok_keluar', 'id_stok_keluar'),
      id_stok_masuk: fk('stok_masuk', 'id_stok_masuk'),
      jumlah_diambil: desimal()
    }, opsi);
  },

  async down(qi) {
    for (const t of ['detail_stok_keluar', 'stok_keluar', 'stok_masuk', 'bahan_baku', 'pemasok', 'kategori', 'users']) {
      await qi.dropTable(t);
    }
  }
};
