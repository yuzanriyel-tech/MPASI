// Konfigurasi koneksi database (dipakai aplikasi dan sequelize-cli).
// Nilai diambil dari .env, lihat .env.example.
require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'persediaan_radjo',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  timezone: '+07:00',
  logging: false,
  // Sebagian hosting MySQL mewajibkan SSL: set DB_SSL=true
  dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}
};

module.exports = { development: base, test: base, production: base };
