
/* =====================================================
   PUSTAKAWAN - BERANDA PROFILE

   Menampilkan identitas admin berdasarkan sesi login.
   ===================================================== */

(() => {
  'use strict';

  const SESSION_KEY = 'eperpus_pustakawan_session';

  const adminName = document.getElementById('adminName');
  const adminNip = document.getElementById('adminNip');

  function getSession() {

    try {

      const sessionData =
        sessionStorage.getItem(SESSION_KEY);

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

      console.error(
        'Gagal membaca sesi pustakawan:',
        error
      );

      return null;

    }

  }

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

  function renderAdminProfile() {

    if (!adminName || !adminNip) return;

    const session = getSession();

    if (!session) {

      adminName.textContent =
        'Sesi tidak ditemukan';

      adminNip.textContent =
        'Silakan login kembali';

      return;

    }

    const name = String(
      session.nama || ''
    ).trim();

    const identity = session.identityDisplay
      ? String(session.identityDisplay).trim()
      : formatLegacyIdentity(session.identity);

    adminName.textContent =
      name || 'Nama belum tersedia';

    adminNip.textContent =
      identity || 'NIP belum tersedia';

  }

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
