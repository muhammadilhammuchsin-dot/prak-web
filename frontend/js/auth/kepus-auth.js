
/* =========================================================
   KEPUS-AUTH.JS
   PROTEKSI HALAMAN KEPALA PERPUSTAKAAN

   FITUR:
   1. Memeriksa sesi login Kepus.
   2. Memastikan role akun adalah kepus.
   3. Melindungi halaman laporan.
   4. Menangani logout Kepus.

   LOGIN DAN REGISTRASI DITANGANI STAFF-AUTH.JS.
   ========================================================= */

(() => {
  'use strict';

  const SESSION_KEY = 'eperpus_kepus_session';
  const LOGIN_URL = '../auth/login/kepus.html';

  // Membaca sesi Kepus.
  function readKepusSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);

      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Sesi Kepus tidak valid:', error);
      return null;
    }
  }

  // Memastikan halaman laporan hanya dapat dibuka oleh Kepus.
  function protectKepusPage() {
    if (document.body.dataset.kepusProtected !== 'true') {
      return;
    }

    const session = readKepusSession();

    if (!session || session.role !== 'kepus') {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace(LOGIN_URL);
    }
  }

  // Menangani tombol keluar.
  function handleLogout(event) {
    const target = event.target instanceof Element
      ? event.target.closest('[data-kepus-logout]')
      : null;

    if (!target) return;

    event.preventDefault();

    // Menghapus sesi Kepus.
    sessionStorage.removeItem(SESSION_KEY);

    // Kembali ke login Kepus.
    window.location.href = LOGIN_URL;
  }

  // Inisialisasi proteksi dan logout.
  function initialize() {
    protectKepusPage();
    document.addEventListener('click', handleLogout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
