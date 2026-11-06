(function () {
  'use strict';

  /* ---------- Dropdown (Pengelolaan, profil) ---------- */
  var dropdowns = document.querySelectorAll('[data-dropdown]');
  function closeAll(except) {
    dropdowns.forEach(function (d) {
      if (d === except) return;
      var p = d.querySelector('.dropdown-panel'), b = d.querySelector('[data-dropdown-toggle]');
      if (p) p.hidden = true;
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  dropdowns.forEach(function (d) {
    var btn = d.querySelector('[data-dropdown-toggle]'), panel = d.querySelector('.dropdown-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      closeAll(d);
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function () { closeAll(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });

  /* ---------- Menu pengelola (mobile) ---------- */
  var mBtn = document.querySelector('[data-mmenu-toggle]'), mMenu = document.getElementById('m-menu');
  if (mBtn && mMenu) {
    mBtn.addEventListener('click', function () {
      var show = mMenu.hidden;
      mMenu.hidden = !show;
      mBtn.setAttribute('aria-expanded', String(show));
    });
  }

    /* ---------- Tampilkan / sembunyikan password ---------- */
  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    var ikon = btn.querySelector('svg');
    var tutup = ikon ? ikon.innerHTML : '';          // ikon mata dicoret (password tersembunyi)
    var buka = btn.getAttribute('data-icon-show') || ''; // ikon mata terbuka (password terlihat)

    btn.addEventListener('click', function () {
      var input = document.querySelector(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      if (ikon && buka) ikon.innerHTML = show ? buka : tutup;
    });
  });

  /* ---------- Dialog konfirmasi ---------- */
  document.querySelectorAll('[data-open-dialog]').forEach(function (b) {
    b.addEventListener('click', function () {
      var dlg = document.getElementById(b.getAttribute('data-open-dialog'));
      if (dlg && dlg.showModal) dlg.showModal();
    });
  });
  document.querySelectorAll('[data-close-dialog]').forEach(function (b) {
    b.addEventListener('click', function () { var d = b.closest('dialog'); if (d) d.close(); });
  });

    /* ---------- Pencarian global (dropdown hasil di navbar) ---------- */
  (function () {
    var form = document.querySelector('[data-gsearch]');
    if (!form) return;
    var inp = form.querySelector('[data-gsearch-input]');
    var panel = form.querySelector('.gsearch-panel');
    var timer = null, seq = 0, idx = -1;

    function angka(n) {
      n = Math.round(n * 1000) / 1000;
      var s = String(n).split('.');
      s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return s.join(',');
    }
    function tutup() { panel.hidden = true; inp.setAttribute('aria-expanded', 'false'); idx = -1; }
    function buka() { panel.hidden = false; inp.setAttribute('aria-expanded', 'true'); }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    function tampil(data) {
      panel.textContent = '';
      idx = -1;
      if (!data.bahan.length) {
        var kosong = el('div', 'gs-empty');
        kosong.appendChild(el('strong', null, 'Tidak ditemukan'));
        kosong.appendChild(el('small', null, 'Tidak ada bahan baku untuk “' + data.q + '”. Coba nama atau kode lain.'));
        panel.appendChild(kosong);
        buka();
        return;
      }
      panel.appendChild(el('p', 'gs-group', 'Hasil bahan baku'));
      data.bahan.forEach(function (b) {
        var a = el('a', 'gs-item');
        a.setAttribute('role', 'option');
        a.href = '/?q=' + encodeURIComponent(b.kode);
        var kiri = el('span', 'gs-main');
        kiri.appendChild(el('strong', null, b.nama));
        kiri.appendChild(el('small', null, b.kode + ' · ' + b.kategori));
        var kanan = el('span', 'gs-side' + (b.perlu ? ' bahaya' : ''));
        kanan.textContent = angka(b.saldo) + ' ' + b.satuanPakai;
        a.appendChild(kiri); a.appendChild(kanan);
        panel.appendChild(a);
      });
      var semua = el('a', 'gs-all', 'Lihat semua hasil (' + data.total + ')');
      semua.href = '/?q=' + encodeURIComponent(data.q);
      panel.appendChild(semua);
      buka();
    }

    function cari() {
      var q = inp.value.trim();
      if (!q) { tutup(); return; }
      var mine = ++seq;
      fetch('/api/cari?q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { if (mine === seq) tampil(d); })
        .catch(function () { if (mine === seq) tutup(); });
    }

    inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(cari, 180); });
    inp.addEventListener('focus', function () { if (inp.value.trim() && panel.childNodes.length) buka(); });
    inp.addEventListener('keydown', function (e) {
      var items = panel.querySelectorAll('.gs-item');
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
        e.preventDefault();
        idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (it, i) { it.setAttribute('aria-selected', String(i === idx)); });
        items[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && idx >= 0 && items[idx]) {
        e.preventDefault(); window.location.href = items[idx].href;
      } else if (e.key === 'Escape') { tutup(); }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) tutup(); });
  })();

  /* ---------- Form stok: combobox bahan + satuan + preview konversi ---------- */
  var dataEl = document.getElementById('bahan-data');
  var combo = document.querySelector('[data-combo]');
  if (!dataEl || !combo) return;

  var bahan = JSON.parse(dataEl.textContent || '[]');
  var input = combo.querySelector('[data-combo-input]');
  var hidden = combo.querySelector('[data-combo-value]');
  var list = combo.querySelector('.combo-list');
  var info = document.querySelector('[data-saldo-info]');
  var unitPakai = document.querySelector('[data-unit-pakai]');
  var unitBeli = document.querySelector('[data-unit-beli]');
  var preview = document.querySelector('[data-preview]');
  var jumlah = document.querySelector('[data-jumlah]');
  var activeIdx = -1;

  function angka(n) {
    n = Math.round(n * 1000) / 1000;
    var s = String(n).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return s.join(',');
  }
  function find(kode) { return bahan.find(function (b) { return b.kode === kode; }); }

  function refresh() {
    var b = find(hidden.value);
    if (info) info.textContent = b
      ? b.kode + ' · Saldo ' + angka(b.saldo) + ' ' + b.satuanPakai + ' · Minimum ' + angka(b.minimum) + ' ' + b.satuanPakai
      : 'Saldo dan satuan tampil setelah bahan dipilih.';
    if (unitPakai) unitPakai.textContent = b ? b.satuanPakai : 'satuan';
    if (unitBeli) unitBeli.textContent = b ? b.satuanBeli : 'satuan beli';
    if (preview) {
      var v = jumlah ? parseFloat(String(jumlah.value).replace(',', '.')) : NaN;
      preview.textContent = (b && v > 0)
        ? angka(v) + ' ' + b.satuanBeli + ' × ' + angka(b.isi) + ' ' + b.satuanPakai + ' = ' + angka(v * b.isi) + ' ' + b.satuanPakai + ' (saldo menjadi ' + angka(b.saldo + v * b.isi) + ' ' + b.satuanPakai + ')'
        : 'Pilih bahan dan masukkan jumlah positif untuk melihat preview satuan pakai.';
    }
  }

  function render(q) {
    q = (q || '').trim().toLowerCase();
    var hasil = bahan.filter(function (b) { return !q || (b.nama + ' ' + b.kode).toLowerCase().indexOf(q) !== -1; });
    list.innerHTML = '';
    activeIdx = -1;
    if (!hasil.length) {
      var none = document.createElement('li'); none.className = 'none'; none.textContent = 'Bahan tidak ditemukan'; list.appendChild(none);
    }
    hasil.forEach(function (b) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option'); li.dataset.kode = b.kode;
      var s = document.createElement('strong'); s.textContent = b.nama;
      var m = document.createElement('small');
      m.textContent = b.kode + ' · Saldo ' + angka(b.saldo) + ' ' + b.satuanPakai + ' · Minimum ' + angka(b.minimum) + ' ' + b.satuanPakai;
      li.appendChild(s); li.appendChild(m);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); pilih(b); });
      list.appendChild(li);
    });
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  function tutup() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function pilih(b) { hidden.value = b.kode; input.value = b.nama; tutup(); refresh(); }

  input.addEventListener('focus', function () { render(hidden.value ? '' : input.value); });
  input.addEventListener('input', function () { hidden.value = ''; render(input.value); refresh(); });
  input.addEventListener('blur', function () { setTimeout(tutup, 120); });
  input.addEventListener('keydown', function (e) {
    var items = list.querySelectorAll('li[data-kode]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) render(input.value);
      items = list.querySelectorAll('li[data-kode]');
      if (!items.length) return;
      activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (li, i) { li.setAttribute('aria-selected', String(i === activeIdx)); });
    } else if (e.key === 'Enter' && !list.hidden && activeIdx >= 0) {
      e.preventDefault(); pilih(find(items[activeIdx].dataset.kode));
    } else if (e.key === 'Escape') { tutup(); }
  });
  if (jumlah) jumlah.addEventListener('input', refresh);
  refresh();
})();
