// Konfigurasi DB dari .env.
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
  // Set DB_SSL=true jika hosting mewajibkan SSL
  dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}
};

module.exports = { development: base, test: base, production: base };
