
/* =========================================================
   E-PERPUSTAKAAN - UTILITAS BERSAMA

   Fungsi:
   1. Navigasi halaman.
   2. Notifikasi otomatis.
   3. Membaca localStorage.
   4. Menyimpan localStorage.
   5. Menghapus localStorage.
   6. Mengelola sesi login.

   PERBAIKAN:
   Notifikasi otomatis menghilang setelah 3 detik.
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const SESSION_KEYS = [
    'eperpus_demo_session',
    'eperpus_anggota_session',
    'eperpus_pustakawan_session',
    'eperpus_kepus_session'
  ];

  const NOTIFICATION_DURATION = 3000;
  const NOTIFICATION_FADE_DURATION = 250;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Timer notifikasi.
  let notificationTimer = null;
  let notificationHideTimer = null;


  // =======================================================
  // 2. SISTEM NOTIFIKASI
  // =======================================================

  function notify(message, type = 'info') {

    let box = $('[data-app-feedback]');

    // Membuat elemen notifikasi jika belum tersedia.
    if (!box) {

      box = document.createElement('div');

      box.dataset.appFeedback = 'true';

      box.setAttribute('role', 'status');

      box.setAttribute('aria-live', 'polite');

      box.setAttribute('aria-atomic', 'true');

      box.style.cssText = [

        'position:fixed',
        'right:20px',
        'bottom:20px',
        'z-index:9999',
        'max-width:min(360px, calc(100vw - 40px))',
        'padding:12px 16px',
        'border-radius:8px',
        'background:#17324d',
        'color:#fff',
        'box-shadow:0 4px 16px #0002',
        'font-family:inherit',
        'font-size:14px',
        'line-height:1.6',
        'opacity:1',
        'transform:translateY(0)',
        'transition:opacity 250ms ease, transform 250ms ease'

      ].join(';');

      document.body.appendChild(box);

    }

    // Menghentikan timer notifikasi sebelumnya.
    // Ini mencegah notifikasi baru ikut menghilang
    // karena timer dari pesan sebelumnya.

    if (notificationTimer !== null) {

      clearTimeout(notificationTimer);

      notificationTimer = null;

    }

    if (notificationHideTimer !== null) {

      clearTimeout(notificationHideTimer);

      notificationHideTimer = null;

    }

    // Mengisi pesan dan jenis notifikasi.
    box.textContent = message;

    box.dataset.type = type;

    // Memunculkan notifikasi.
    box.hidden = false;

    box.style.opacity = '1';

    box.style.transform = 'translateY(0)';


    // =====================================================
    // OTOMATIS MENGHILANG SETELAH 3 DETIK
    // =====================================================

    notificationTimer = window.setTimeout(() => {

      // Animasi menghilang.
      box.style.opacity = '0';

      box.style.transform = 'translateY(8px)';

      // Menyembunyikan elemen setelah animasi selesai.
      notificationHideTimer = window.setTimeout(() => {

        box.hidden = true;

        // Mengembalikan tampilan awal untuk pesan berikutnya.
        box.style.opacity = '1';

        box.style.transform = 'translateY(0)';

        notificationHideTimer = null;

      }, NOTIFICATION_FADE_DURATION);

      notificationTimer = null;

    }, NOTIFICATION_DURATION);

  }


  // =======================================================
  // 3. MEMBACA DATA DARI LOCALSTORAGE
  // =======================================================

  function read(key, fallback = null) {

    try {

      const raw = localStorage.getItem(key);

      return raw === null
        ? fallback
        : JSON.parse(raw);

    } catch (error) {

      console.error(
        `Gagal membaca penyimpanan ${key}:`,
        error
      );

      return fallback;

    }

  }


  // =======================================================
  // 4. MENYIMPAN DATA KE LOCALSTORAGE
  // =======================================================

  function write(key, value) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;

    } catch (error) {

      console.error(
        `Gagal menyimpan ${key}:`,
        error
      );

      notify(
        'Penyimpanan browser gagal. Periksa kapasitas penyimpanan.',
        'error'
      );

      return false;

    }

  }


  // =======================================================
  // 5. MENGHAPUS DATA LOCALSTORAGE
  // =======================================================

  function remove(key) {

    try {

      localStorage.removeItem(key);

      return true;

    } catch (error) {

      console.error(
        `Gagal menghapus ${key}:`,
        error
      );

      return false;

    }

  }


  // =======================================================
  // 6. MENGHAPUS SELURUH SESI LOGIN
  // =======================================================

  function clearSessions() {

    SESSION_KEYS.forEach(key => {

      sessionStorage.removeItem(key);

    });

  }


  // =======================================================
  // 7. NAVIGASI HALAMAN
  // =======================================================

  function navigate(route) {

    const target = String(route || '').trim();

    if (
      !target ||
      /^(https?:|javascript:|data:)/i.test(target)
    ) {

      notify(
        'Tujuan navigasi tidak valid.',
        'error'
      );

      return;

    }

    // Mengakhiri sesi ketika menuju halaman login.
    if (
      /auth\/login\/(anggota|pustakawan|kepus)\.html$/i
        .test(target)
    ) {

      clearSessions();

    }

    window.location.href = target;

  }


  // =======================================================
  // 8. EVENT KLIK NAVIGASI
  // =======================================================

  document.addEventListener('click', event => {

    const routeElement = event.target.closest(
      '[data-route]'
    );

    if (!routeElement) return;

    const route =
      routeElement.dataset.route ||
      routeElement.getAttribute('href');

    if (!route) return;

    event.preventDefault();

    navigate(route);

  });


  // =======================================================
  // 9. NAVIGASI MENGGUNAKAN KEYBOARD
  // =======================================================

  document.addEventListener('keydown', event => {

    const interactive = event.target.closest(
      '[role="link"], [role="button"]'
    );

    if (!interactive) return;

    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {

      if (interactive.tagName === 'BUTTON') return;

      event.preventDefault();

      interactive.click();

    }

  });


  // =======================================================
  // 10. FUNGSI GLOBAL E-PERPUS
  // =======================================================

  window.EPerpus = Object.freeze({

    notify,

    read,

    write,

    remove,

    navigate,

    clearSessions

  });

})();
