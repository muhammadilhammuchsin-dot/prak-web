
/* =========================================================
   FITUR LUPA PASSWORD PETUGAS
   File: frontend/js/auth/staff-auth.js
   Role: Pustakawan dan Kepus
   Penyimpanan: localStorage
   Identifikasi: NIP / Kode akun
   Algoritma: PBKDF2-SHA256
   OTP: belum diintegrasikan
   ========================================================= */
(() => {
  'use strict';

  const ACCOUNT_KEY = 'eperpus_staff_accounts';
  const LEGACY_KEY = 'eperpus_pustakawan_accounts';
  const ITERATIONS = 120000;

  const form = document.querySelector(
    'form[data-auth-form="forgot-password"][data-user-role]'
  );

  if (!form) return;

  const role = form.dataset.userRole;

  // Konfigurasi berdasarkan jenis petugas.
  const roleConfig = {
    pustakawan: {
      loginUrl: '../login/pustakawan.html',
      label: 'Pustakawan'
    },
    kepus: {
      loginUrl: '../login/kepus.html',
      label: 'Kepala Perpustakaan'
    }
  };

  if (!roleConfig[role]) return;

  const identityField = form.elements.namedItem('npm');
  const passwordField = form.elements.namedItem('password');
  const confirmField = form.elements.namedItem('password-confirm');

  const submitButton = form.querySelector(
    '[data-auth-action="forgot-password"],button[type="submit"]'
  );

  const feedback = form.querySelector('[data-auth-feedback]');
  let isSubmitting = false;

  // Memastikan seluruh elemen tersedia.
  if (!identityField || !passwordField || !confirmField) {
    console.error('Form Lupa Password Petugas tidak lengkap.');
    return;
  }

  // Menyamakan format NIP atau kode akun.
  function normalizeIdentity(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  // Mengatur pesan validasi.
  function setError(field, message) {
    const error = form.querySelector(
      `[data-error-for="${field.name}"]`
    );

    field.classList.toggle(
      'form__input--error',
      Boolean(message)
    );

    if (message) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }

    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  }

  // Menampilkan feedback.
  function showMessage(message, type = 'info') {
    if (!feedback) return;

    feedback.textContent = message;
    feedback.className = `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }

  // Menghapus feedback.
  function clearMessage() {
    if (!feedback) return;

    feedback.textContent = '';
    feedback.hidden = true;
  }

  // Validasi setiap input.
  function validateField(field) {
    const value = field.value.trim();
    let message = '';

    if (!value) {
      message = 'Bagian ini wajib diisi.';

    } else if (
      field === identityField &&
      !/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(
        normalizeIdentity(value)
      )
    ) {
      message = 'NIP atau kode identitas tidak valid.';

    } else if (
      field === passwordField &&
      field.value.length < 8
    ) {
      message = 'Password minimal 8 karakter.';

    } else if (
      field === confirmField &&
      field.value !== passwordField.value
    ) {
      message = 'Konfirmasi password tidak sama.';
    }

    setError(field, message);
    return !message;
  }

  // Membaca data akun dari localStorage.
  function readArray(key) {
    const raw = localStorage.getItem(key);

    if (!raw) return [];

    const value = JSON.parse(raw);

    if (!Array.isArray(value)) {
      throw new Error(
        'Format data akun petugas tidak valid.'
      );
    }

    return value;
  }

  // Menyimpan data akun petugas.
  function saveAccounts(accounts) {
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify(accounts)
    );
  }

  // Membaca akun petugas sekaligus mempertahankan migrasi akun lama.
  function readAccounts() {
    const accounts = readArray(ACCOUNT_KEY);
    const legacy = readArray(LEGACY_KEY);
    let changed = false;

    legacy.forEach(old => {
      if (!old || typeof old !== 'object') return;

      const identity = normalizeIdentity(old.identity);

      if (!identity || !old.salt || !old.passwordHash) {
        return;
      }

      const exists = accounts.some(account =>
        normalizeIdentity(account.identity) === identity
      );

      if (!exists) {
        accounts.push({
          role: 'pustakawan',
          nama: old.nama || '',
          identity,
          email: old.email || '',
          salt: old.salt,
          passwordHash: old.passwordHash,
          createdAt: old.createdAt || new Date().toISOString()
        });

        changed = true;
      }
    });

    if (changed) {
      saveAccounts(accounts);
    }

    return accounts;
  }

  // Mengubah byte menjadi Base64.
  function toBase64(bytes) {
    let binary = '';

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  // Membuat hash password menggunakan PBKDF2.
  async function makeHash(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        'Web Crypto tidak tersedia. Jalankan melalui Live Server atau HTTPS.'
      );
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    }, key, 256);

    return toBase64(new Uint8Array(bits));
  }

  // Proses pemulihan password.
  async function resetPassword() {
    clearMessage();

    // Memastikan seluruh input valid.
    const valid = [
      identityField,
      passwordField,
      confirmField
    ].every(validateField);

    if (!valid) {
      showMessage(
        'Periksa kembali data yang Anda masukkan.',
        'error'
      );
      return;
    }

    if (isSubmitting) return;
    isSubmitting = true;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Memproses...';
    }

    try {
      const identity = normalizeIdentity(
        identityField.value
      );

      const accounts = readAccounts();

      // Mencari akun berdasarkan NIP dan role.
      const index = accounts.findIndex(account =>
        normalizeIdentity(account.identity) === identity &&
        account.role === role
      );

      if (index < 0) {
        showMessage(
          `Akun ${roleConfig[role].label} dengan NIP/kode tersebut tidak ditemukan.`,
          'error'
        );
        return;
      }

      // Membuat salt baru untuk password baru.
      const salt = crypto.getRandomValues(
        new Uint8Array(16)
      );

      const passwordHash = await makeHash(
        passwordField.value,
        salt
      );

      // Memperbarui password akun.
      accounts[index] = {
        ...accounts[index],
        salt: toBase64(salt),
        passwordHash,
        passwordUpdatedAt: new Date().toISOString()
      };

      // Menyimpan perubahan akun.
      saveAccounts(accounts);

      form.reset();

      [
        identityField,
        passwordField,
        confirmField
      ].forEach(field => {
        setError(field, '');
      });

      showMessage(
        'Password berhasil diperbarui pada penyimpanan browser. Silakan login kembali.',
        'info'
      );

      // Mengarahkan pengguna sesuai jenis akun.
      window.setTimeout(() => {
        window.location.href = roleConfig[role].loginUrl;
      }, 1200);

    } catch (error) {
      console.error('Lupa password petugas:', error);

      showMessage(
        error.message || 'Password gagal diperbarui.',
        'error'
      );

    } finally {
      isSubmitting = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Simpan password';
      }
    }
  }

  // Memperbarui validasi saat input berubah.
  function handleFieldChange(event) {
    const field = event.target;

    if (
      field !== identityField &&
      field !== passwordField &&
      field !== confirmField
    ) return;

    validateField(field);

    // Periksa ulang konfirmasi saat password berubah.
    if (field === passwordField && confirmField.value) {
      validateField(confirmField);
    }

    clearMessage();
  }

  // Event input dan change.
  form.addEventListener('input', handleFieldChange);
  form.addEventListener('change', handleFieldChange);

  // Event submit.
  // Capture mencegah handler lama memproses form yang sama.
  form.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetPassword();
  }, true);

})();
