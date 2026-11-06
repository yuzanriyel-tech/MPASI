// Lapisan data Sequelize/MySQL.
const { sequelize, Sequelize, User, Kategori, Pemasok, BahanBaku, StokMasuk, StokKeluar, DetailStokKeluar } = require('../db/models');
const { hashPassword, verifyPassword } = require('./password');

const { Op } = Sequelize;

const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100; // DECIMAL(10,2)
const num = (v) => Number(v);

const ROLE_KE_PERAN = { pengelola: 'Pengelola', karyawan: 'Karyawan' };
const PERAN_KE_ROLE = { Pengelola: 'pengelola', Karyawan: 'karyawan' };

// Dropdown satuan beli & pakai
const SATUAN_BELI = ['karton', 'kantong', 'botol', 'kaleng', 'pack', 'dus', 'karung', 'kg', 'liter', 'pcs'];
const SATUAN_PAKAI = ['kg', 'liter', 'gram', 'ml', 'pcs'];

class StokKurangError extends Error {
  constructor(saldo, satuan) {
    super(`Stok tidak mencukupi. Saldo tersedia ${String(saldo).replace('.', ',')} ${satuan}.`);
    this.code = 'STOK_KURANG';
    this.saldo = saldo;
  }
}

const mapUser = (u) => ({
  username: u.username, nama: u.nama, peran: ROLE_KE_PERAN[u.role], aktif: !!u.status_aktif, password: u.password
});

const INCLUDE_BAHAN = [{ model: Kategori, as: 'kategori' }, { model: Pemasok, as: 'pemasok' }];
const mapBahan = (b) => ({
  kode: b.kode_bahan, nama: b.nama_bahan, kategori: b.kategori ? b.kategori.nama_kategori : '',
  pemasok: b.pemasok ? b.pemasok.nama_pemasok : '', satuanBeli: b.satuan_beli, isi: num(b.isi_per_satuan_beli),
  satuanPakai: b.satuan_pakai, saldo: num(b.stok_saat_ini), minimum: num(b.stok_minimum), masaSimpan: b.masa_simpan_hari
});

async function idKategori(nama) {
  const k = await Kategori.findOne({ where: { nama_kategori: nama } });
  if (!k) throw new Error(`Kategori "${nama}" tidak dikenal`);
  return k.id_kategori;
}
async function idPemasok(nama) {
  if (!nama) return null;
  const p = await Pemasok.findOne({ where: { nama_pemasok: nama } });
  if (!p) throw new Error(`Pemasok "${nama}" tidak dikenal`);
  return p.id_pemasok;
}
const dariBahan = async (b) => ({
  id_kategori: await idKategori(b.kategori), id_pemasok: await idPemasok(b.pemasok),
  nama_bahan: b.nama, satuan_beli: b.satuanBeli, satuan_pakai: b.satuanPakai,
  isi_per_satuan_beli: b.isi, stok_minimum: b.minimum, masa_simpan_hari: b.masaSimpan
});

const db = {
  hashPassword, verifyPassword, round, StokKurangError, SATUAN_BELI, SATUAN_PAKAI,

  // ---- akun pengguna
  async users() { return (await User.findAll({ order: [['id_user', 'ASC']] })).map(mapUser); },
  async user(username) {
    const kunci = String(username || '').trim().toLowerCase();
    if (!kunci) return null;
    const u = await User.findOne({ where: { username: kunci } });
    return u ? mapUser(u) : null;
  },
  async addUser(u) {
    await User.create({ username: u.username, nama: u.nama, password: u.password, role: PERAN_KE_ROLE[u.peran], status_aktif: u.aktif !== false });
  },
  async updateUser(username, { nama, peran, password }) {
    const u = await User.findOne({ where: { username } });
    u.nama = nama; u.role = PERAN_KE_ROLE[peran];
    if (password) u.password = password; // sudah di-hash oleh pemanggil
    await u.save();
  },
  async setAktif(username, aktif) { await User.update({ status_aktif: aktif }, { where: { username } }); },

  // ---- referensi (dropdown)
  async pemasok() { return (await Pemasok.findAll({ order: [['nama_pemasok', 'ASC']] })).map((p) => p.nama_pemasok); },
  async kategori() { return (await Kategori.findAll({ order: [['id_kategori', 'ASC']] })).map((k) => k.nama_kategori); },
  async satuan() {
    const baris = await BahanBaku.findAll({ attributes: ['satuan_beli', 'satuan_pakai'] });
    const gabung = (dasar, kolom) => [...new Set([...dasar, ...baris.map((b) => b[kolom])])];
    return { beli: gabung(SATUAN_BELI, 'satuan_beli'), pakai: gabung(SATUAN_PAKAI, 'satuan_pakai') };
  },

  // ---- bahan baku
  async bahan() { return (await BahanBaku.findAll({ include: INCLUDE_BAHAN, order: [['kode_bahan', 'ASC']] })).map(mapBahan); },
  async bahanByKode(kode) {
    const b = await BahanBaku.findOne({ where: { kode_bahan: String(kode || '') }, include: INCLUDE_BAHAN });
    return b ? mapBahan(b) : null;
  },
  async nextKode() {
    const semua = await BahanBaku.findAll({ attributes: ['kode_bahan'] });
    const max = semua.reduce((m, b) => Math.max(m, Number(b.kode_bahan.split('-')[1]) || 0), 0);
    return `BB-${String(max + 1).padStart(3, '0')}`;
  },
  async addBahan(b) {
    await BahanBaku.create({ kode_bahan: b.kode, stok_saat_ini: 0, ...(await dariBahan(b)) });
  },
  async updateBahan(kode, b) {
    await BahanBaku.update(await dariBahan(b), { where: { kode_bahan: kode } });
  },
  // Tolak hapus jika ada riwayat
  async hapusBahan(kode) {
    const b = await BahanBaku.findOne({ where: { kode_bahan: kode } });
    if (!b) return { ok: false, alasan: 'tidak ada' };
    const [m, k] = await Promise.all([
      StokMasuk.count({ where: { id_bahan: b.id_bahan } }), StokKeluar.count({ where: { id_bahan: b.id_bahan } })
    ]);
    if (m + k > 0) return { ok: false, alasan: 'riwayat' };
    await b.destroy();
    return { ok: true };
  },
  perluPesan: (b) => b.saldo <= b.minimum,

  // ---- transaksi
  // Gabungan masuk & keluar untuk laporan.
  async transaksi() {
    const bahan = { model: BahanBaku, as: 'bahan', attributes: ['kode_bahan'] };
    const pencatat = { model: User, as: 'pencatat', attributes: ['username'] };
    const [masuk, keluar] = await Promise.all([
      StokMasuk.findAll({ include: [bahan, { model: Pemasok, as: 'pemasok', attributes: ['nama_pemasok'] }, pencatat], order: [['id_stok_masuk', 'ASC']] }),
      StokKeluar.findAll({ include: [bahan, pencatat], order: [['id_stok_keluar', 'ASC']] })
    ]);
    const semua = [
      ...masuk.map((t) => ({
        tanggal: t.tanggal_masuk, jenis: 'masuk', kode: t.bahan.kode_bahan, jumlah: num(t.jumlah_masuk),
        jumlahBeli: num(t.jumlah_satuan_beli), pemasok: t.pemasok ? t.pemasok.nama_pemasok : '',
        tanggalMasuk: t.tanggal_masuk, kedaluwarsa: t.tanggal_kedaluwarsa || '', catatan: '', oleh: t.pencatat.username
      })),
      ...keluar.map((t) => ({
        tanggal: t.tanggal_keluar, jenis: 'keluar', kode: t.bahan.kode_bahan, jumlah: num(t.jumlah_keluar),
        jumlahBeli: null, pemasok: '', tanggalMasuk: '', kedaluwarsa: '', catatan: t.keterangan || '',
        jenisKeluar: t.jenis_keluar, oleh: t.pencatat.username
      }))
    ];
    semua.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.jenis === b.jenis ? 0 : a.jenis === 'masuk' ? -1 : 1));
    return semua.map((t, i) => ({ id: i + 1, ...t })); // id = urutan tampil
  },

  // Catat masuk (batch baru) atau keluar (FEFO) dalam satu transaksi DB.
  async catat({ jenis, kode, jumlahPakai, jumlahBeli, pemasok, tanggalMasuk, kedaluwarsa, catatan, jenisKeluar, oleh, tanggal }) {
    return sequelize.transaction(async (t) => {
      const bahan = await BahanBaku.findOne({ where: { kode_bahan: kode }, transaction: t, lock: t.LOCK.UPDATE });
      const user = await User.findOne({ where: { username: oleh }, transaction: t });
      if (!bahan || !user) throw new Error('Bahan atau pengguna tidak ditemukan');
      const jumlah = round(jumlahPakai);

      if (jenis === 'masuk') {
        const prefix = `${kode}-${tanggalMasuk.replace(/-/g, '')}`;
        const ada = await StokMasuk.count({ where: { kode_batch: { [Op.like]: `${prefix}%` } }, transaction: t });
        await StokMasuk.create({
          id_bahan: bahan.id_bahan, id_pemasok: await idPemasok(pemasok), id_user: user.id_user,
          kode_batch: ada ? `${prefix}-${ada + 1}` : prefix, tanggal_masuk: tanggalMasuk,
          jumlah_satuan_beli: jumlahBeli, jumlah_masuk: jumlah, sisa_stok: jumlah, tanggal_kedaluwarsa: kedaluwarsa || null
        }, { transaction: t });
        bahan.stok_saat_ini = round(num(bahan.stok_saat_ini) + jumlah);
        await bahan.save({ transaction: t });
        return;
      }

      // Keluar: validasi saldo, ambil batch FEFO
      const saldo = round(bahan.stok_saat_ini);
      if (jumlah > saldo) throw new StokKurangError(saldo, bahan.satuan_pakai);
      const batch = await StokMasuk.findAll({
        where: { id_bahan: bahan.id_bahan, sisa_stok: { [Op.gt]: 0 } },
        order: [[sequelize.literal('tanggal_kedaluwarsa IS NULL'), 'ASC'], ['tanggal_kedaluwarsa', 'ASC'], ['id_stok_masuk', 'ASC']],
        transaction: t, lock: t.LOCK.UPDATE
      });
      const keluar = await StokKeluar.create({
        id_bahan: bahan.id_bahan, id_user: user.id_user, tanggal_keluar: tanggal, jumlah_keluar: jumlah,
        jenis_keluar: jenisKeluar || 'pemakaian', keterangan: catatan || null
      }, { transaction: t });
      let perlu = jumlah;
      for (const b of batch) {
        if (perlu <= 0) break;
        const ambil = Math.min(num(b.sisa_stok), perlu);
        await DetailStokKeluar.create({ id_stok_keluar: keluar.id_stok_keluar, id_stok_masuk: b.id_stok_masuk, jumlah_diambil: round(ambil) }, { transaction: t });
        b.sisa_stok = round(num(b.sisa_stok) - ambil);
        await b.save({ transaction: t });
        perlu = round(perlu - ambil);
      }
      if (perlu > 0) throw new StokKurangError(round(jumlah - perlu), bahan.satuan_pakai); // saldo & batch tidak sinkron
      bahan.stok_saat_ini = round(saldo - jumlah);
      await bahan.save({ transaction: t });
    });
  },

  // Saldo bahan di awal bulan ym.
  // tx dari db.transaksi() agar tidak query ulang.
  saldoAwalBulan(b, ym, tx) {
    const net = tx
      .filter((t) => t.kode === b.kode && t.tanggal.slice(0, 7) >= ym)
      .reduce((s, t) => s + (t.jenis === 'masuk' ? t.jumlah : -t.jumlah), 0);
    return round(b.saldo - net);
  },

  // Batch stok_masuk masih bersisa; sisa > 0.
  async batchAktif(sebelum) {
    const batch = await StokMasuk.findAll({
      where: sebelum ? { tanggal_masuk: { [Op.lt]: sebelum } } : {},
      include: [{ model: BahanBaku, as: 'bahan', attributes: ['kode_bahan'] }], order: [['id_stok_masuk', 'ASC']]
    });
    if (!batch.length) return [];
    const detail = await DetailStokKeluar.findAll({
      where: { id_stok_masuk: batch.map((b) => b.id_stok_masuk) },
      include: [{ model: StokKeluar, as: 'keluar', attributes: ['tanggal_keluar'], required: true, ...(sebelum ? { where: { tanggal_keluar: { [Op.lt]: sebelum } } } : {}) }]
    });
    const diambil = {};
    detail.forEach((d) => { diambil[d.id_stok_masuk] = (diambil[d.id_stok_masuk] || 0) + num(d.jumlah_diambil); });
    return batch
      .map((b) => ({ kodeBatch: b.kode_batch, kode: b.bahan.kode_bahan, id: b.id_stok_masuk, kedaluwarsa: b.tanggal_kedaluwarsa || '', sisa: round(num(b.jumlah_masuk) - (diambil[b.id_stok_masuk] || 0)) }))
      .filter((x) => x.sisa > 0);
  }
};

module.exports = db;
