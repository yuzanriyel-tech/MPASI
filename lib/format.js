const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// 1.8 -> "1,8" ; 1200 -> "1.200"
function angka(n) {
  const v = Math.round(Number(n) * 1000) / 1000;
  const [i, d] = String(v).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return d ? `${int},${d}` : int;
}
function pad(n) { return String(n).padStart(2, '0'); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function tanggalID(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} ${BULAN[Number(m) - 1]} ${y}`;
}
function bulanID(ym) {
  const [y, m] = ym.split('-');
  return `${BULAN[Number(m) - 1]} ${y}`;
}
// "1,5" atau "1.5" -> 1.5
function parseAngka(s) {
  const t = String(s ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
// Label periode: satu bulan atau lintas bulan
function periodeLabel(dari, sampai) {
  if (!dari && !sampai) return 'Semua periode';
  if (dari && !sampai) return `Sejak ${tanggalID(dari)}`;
  if (!dari && sampai) return `Sampai ${tanggalID(sampai)}`;
  if (dari.slice(0, 7) === sampai.slice(0, 7)) {
    return dari === sampai ? tanggalID(dari) : `${dari.slice(8)}–${tanggalID(sampai)}`;
  }
  return `${tanggalID(dari)} – ${tanggalID(sampai)}`;
}
module.exports = { periodeLabel, angka, tanggalID, bulanID, todayISO, parseAngka, isISODate, BULAN };
