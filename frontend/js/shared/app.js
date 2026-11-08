
/* =========================================================
   E-PERPUSTAKAAN - UTILITAS BERSAMA
   Navigasi, notifikasi, dan penyimpanan simulasi browser.
   ========================================================= */
(() => {
  'use strict';

  const SESSION_KEYS = [
    'eperpus_demo_session',
    'eperpus_anggota_session',
    'eperpus_pustakawan_session',
    'eperpus_kepus_session'
  ];

  const $ = (selector, root = document) => root.querySelector(selector);

  // Menampilkan notifikasi kepada pengguna.
  function notify(message, type = 'info') {
    let box = $('[data-app-feedback]');

    if (!box) {
      box = document.createElement('div');
      box.dataset.appFeedback = 'true';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      box.style.cssText = [
        'position:fixed',
        'right:20px',
        'bottom:20px',
        'z-index:9999',
        'max-width:360px',
        'padding:12px 16px',
        'border-radius:8px',
        'background:#17324d',
        'color:#fff',
        'box-shadow:0 4px 16px #0002'
      ].join(';');

      document.body.appendChild(box);
    }

    box.textContent = message;
    box.dataset.type = type;
    box.hidden = false;
  }

  // Membaca data dari localStorage.
  function read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.error(`Gagal membaca penyimpanan ${key}:`, error);
      return fallback;
    }
  }

  // Menyimpan data ke localStorage.
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Gagal menyimpan ${key}:`, error);
      notify('Penyimpanan browser gagal. Periksa kapasitas penyimpanan.', 'error');
      return false;
    }
  }

  // Menghapus data tertentu dari localStorage.
  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Gagal menghapus ${key}:`, error);
      return false;
    }
  }

  // Menghapus sesi login seluruh peran.
  function clearSessions() {
    SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));
  }

  // Menangani perpindahan halaman.
  function navigate(route) {
    const target = String(route || '').trim();

    if (!target || /^(https?:|javascript:|data:)/i.test(target)) {
      notify('Tujuan navigasi tidak valid.', 'error');
      return;
    }

    // Sesi diakhiri ketika pengguna menuju halaman login.
    if (/auth\/login\/(anggota|pustakawan|kepus)\.html$/i.test(target)) {
      clearSessions();
    }

    window.location.href = target;
  }

  // Event click untuk navigasi seluruh halaman.
  document.addEventListener('click', event => {
    const routeElement = event.target.closest('[data-route]');
    if (!routeElement) return;

    const route = routeElement.dataset.route || routeElement.getAttribute('href');
    if (!route) return;

    event.preventDefault();
    navigate(route);
  });

  // Mendukung navigasi menggunakan keyboard.
  document.addEventListener('keydown', event => {
    const interactive = event.target.closest('[role="link"], [role="button"]');
    if (!interactive) return;

    if (event.key === 'Enter' || event.key === ' ') {
      if (interactive.tagName === 'BUTTON') return;

      event.preventDefault();
      interactive.click();
    }
  });

  // Fungsi yang dapat digunakan oleh file JavaScript lainnya.
  window.EPerpus = Object.freeze({
    notify,
    read,
    write,
    remove,
    navigate,
    clearSessions
  });
})();
