
/* =====================================================
   PUSTAKAWAN - BERANDA PROFILE

   Fungsi:
   1. Mengambil sesi pustakawan yang sedang login.
   2. Menampilkan nama sesuai akun terdaftar.
   3. Menampilkan NIP sesuai akun terdaftar.
   4. Mendukung akun lama.
   ===================================================== */

(() => {
  'use strict';

  const SESSION_KEY = 'eperpus_pustakawan_session';

  const adminName = document.getElementById('adminName');
  const adminNip = document.getElementById('adminNip');

  // Mengambil sesi login.
  function getSession() {
    try {
      const sessionData = sessionStorage.getItem(SESSION_KEY);

      if (!sessionData) return null;

      const session = JSON.parse(sessionData);

      if (
        !session ||
        session.role !== 'pustakawan'
      ) {
        return null;
      }

      return session;

    } catch (error) {
      console.error('Gagal membaca sesi pustakawan:', error);
      return null;
    }
  }

  // Format NIP lama jika terdiri dari 18 angka.
  function formatLegacyIdentity(identity) {
    const value = String(identity || '').trim();
    const digits = value.replace(/\s/g, '');

    if (/^\d{18}$/.test(digits)) {
      return [
        digits.slice(0, 8),
        digits.slice(8, 14),
        digits.slice(14, 15),
        digits.slice(15, 18)
      ].join(' ');
    }

    return value;
  }

  // Menampilkan informasi profil admin.
  function renderAdminProfile() {
    if (!adminName || !adminNip) return;

    const session = getSession();

    if (!session) {
      adminName.textContent = 'Sesi tidak ditemukan';
      adminNip.textContent = 'Silakan login kembali';
      return;
    }

    const name = String(session.nama || '').trim();

    const identity = session.identityDisplay
      ? String(session.identityDisplay).trim()
      : formatLegacyIdentity(session.identity);

    adminName.textContent =
      name || 'Nama belum tersedia';

    adminNip.textContent =
      identity || 'NIP belum tersedia';
  }

  // Inisialisasi.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      renderAdminProfile,
      { once: true }
    );
  } else {
    renderAdminProfile();
  }

})();
