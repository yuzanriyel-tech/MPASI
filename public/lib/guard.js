function wajibLogin(req, res, next) {
  if (!res.locals.user) return res.redirect('/login');
  next();
}
function wajibPengelola(req, res, next) {
  if (!res.locals.user) return res.redirect('/login');
  if (res.locals.user.peran !== 'Pengelola') {
    return res.status(403).render('error', { title: 'Akses ditolak', pesan: 'Halaman ini hanya untuk Pengelola.', active: '' });
  }
  next();
}
module.exports = { wajibLogin, wajibPengelola };
