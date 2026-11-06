// Model Sequelize untuk 7 tabel sesuai ERD (Lampiran D.6 dan D.7 laporan).
// Nama tabel dan kolom sengaja sama persis dengan kamus data.
const { Sequelize, DataTypes: T } = require('sequelize');
const config = require('../../config/config')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const pk = (name) => ({ [name]: { type: T.INTEGER, primaryKey: true, autoIncrement: true } });
const desimal = (allowNull = false) => ({ type: T.DECIMAL(10, 2), allowNull });

const User = sequelize.define('User', {
  ...pk('id_user'),
  nama: { type: T.STRING(100), allowNull: false },
  username: { type: T.STRING(50), allowNull: false, unique: true },
  password: { type: T.STRING(255), allowNull: false },
  role: { type: T.ENUM('pengelola', 'karyawan'), allowNull: false },
  status_aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  created_at: { type: T.DATE, allowNull: false, defaultValue: T.NOW }
}, { tableName: 'users', timestamps: false });

const Kategori = sequelize.define('Kategori', {
  ...pk('id_kategori'),
  nama_kategori: { type: T.STRING(50), allowNull: false, unique: true }
}, { tableName: 'kategori', timestamps: false });

const Pemasok = sequelize.define('Pemasok', {
  ...pk('id_pemasok'),
  nama_pemasok: { type: T.STRING(100), allowNull: false },
  no_telepon: { type: T.STRING(20), allowNull: true },
  alamat: { type: T.TEXT, allowNull: true }
}, { tableName: 'pemasok', timestamps: false });

const BahanBaku = sequelize.define('BahanBaku', {
  ...pk('id_bahan'),
  id_kategori: { type: T.INTEGER, allowNull: false },
  id_pemasok: { type: T.INTEGER, allowNull: true },
  kode_bahan: { type: T.STRING(10), allowNull: false, unique: true },
  nama_bahan: { type: T.STRING(100), allowNull: false },
  satuan_beli: { type: T.STRING(20), allowNull: false },
  satuan_pakai: { type: T.STRING(20), allowNull: false },
  isi_per_satuan_beli: desimal(),
  stok_saat_ini: { ...desimal(), defaultValue: 0 },
  stok_minimum: desimal(),
  masa_simpan_hari: { type: T.INTEGER, allowNull: true }
}, { tableName: 'bahan_baku', timestamps: false });

const StokMasuk = sequelize.define('StokMasuk', {
  ...pk('id_stok_masuk'),
  id_bahan: { type: T.INTEGER, allowNull: false },
  id_pemasok: { type: T.INTEGER, allowNull: true },
  id_user: { type: T.INTEGER, allowNull: false },
  kode_batch: { type: T.STRING(20), allowNull: false, unique: true },
  tanggal_masuk: { type: T.DATEONLY, allowNull: false },
  jumlah_satuan_beli: desimal(),
  jumlah_masuk: desimal(),
  sisa_stok: desimal(),
  tanggal_kedaluwarsa: { type: T.DATEONLY, allowNull: true }
}, { tableName: 'stok_masuk', timestamps: false });

const StokKeluar = sequelize.define('StokKeluar', {
  ...pk('id_stok_keluar'),
  id_bahan: { type: T.INTEGER, allowNull: false },
  id_user: { type: T.INTEGER, allowNull: false },
  tanggal_keluar: { type: T.DATEONLY, allowNull: false },
  jumlah_keluar: desimal(),
  jenis_keluar: { type: T.ENUM('pemakaian', 'rusak', 'kedaluwarsa'), allowNull: false, defaultValue: 'pemakaian' },
  keterangan: { type: T.TEXT, allowNull: true }
}, { tableName: 'stok_keluar', timestamps: false });

const DetailStokKeluar = sequelize.define('DetailStokKeluar', {
  ...pk('id_detail'),
  id_stok_keluar: { type: T.INTEGER, allowNull: false },
  id_stok_masuk: { type: T.INTEGER, allowNull: false },
  jumlah_diambil: desimal()
}, { tableName: 'detail_stok_keluar', timestamps: false });

// Relasi (Tabel D.16)
BahanBaku.belongsTo(Kategori, { foreignKey: 'id_kategori', as: 'kategori' });
BahanBaku.belongsTo(Pemasok, { foreignKey: 'id_pemasok', as: 'pemasok' });
StokMasuk.belongsTo(BahanBaku, { foreignKey: 'id_bahan', as: 'bahan' });
StokMasuk.belongsTo(Pemasok, { foreignKey: 'id_pemasok', as: 'pemasok' });
StokMasuk.belongsTo(User, { foreignKey: 'id_user', as: 'pencatat' });
StokKeluar.belongsTo(BahanBaku, { foreignKey: 'id_bahan', as: 'bahan' });
StokKeluar.belongsTo(User, { foreignKey: 'id_user', as: 'pencatat' });
StokKeluar.hasMany(DetailStokKeluar, { foreignKey: 'id_stok_keluar', as: 'detail' });
DetailStokKeluar.belongsTo(StokKeluar, { foreignKey: 'id_stok_keluar', as: 'keluar' });
DetailStokKeluar.belongsTo(StokMasuk, { foreignKey: 'id_stok_masuk', as: 'batch' });

module.exports = { sequelize, Sequelize, User, Kategori, Pemasok, BahanBaku, StokMasuk, StokKeluar, DetailStokKeluar };
