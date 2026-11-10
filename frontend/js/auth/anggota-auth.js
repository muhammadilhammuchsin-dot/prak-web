
/* =========================================================
   FITUR LUPA PASSWORD ANGGOTA
   File: frontend/js/auth/anggota-auth.js
   Penyimpanan: localStorage
   Identifikasi: email terdaftar
   Algoritma: PBKDF2-SHA256
   OTP: belum diintegrasikan
   ========================================================= */
(() => {
  'use strict';

  const ACCOUNT_KEY = 'eperpus_demo_accounts';
  const ITERATIONS = 120000;
  const form = document.querySelector(
    'form[data-auth-form="forgot-password"][data-user-role="anggota"]'
  );

  if (!form) return;

  const emailField = form.elements.namedItem('email');
  const passwordField = form.elements.namedItem('password');
  const confirmField = form.elements.namedItem('password-confirm');
  const submitButton = form.querySelector(
    '[data-auth-action="forgot-password"],button[type="submit"]'
  );
  const feedback = form.querySelector('[data-auth-feedback]');
  let isSubmitting = false;

  // Memeriksa apakah seluruh input tersedia.
  if (!emailField || !passwordField || !confirmField) {
    console.error('Form Lupa Password Anggota tidak lengkap.');
    return;
  }

  // Menampilkan atau menghapus pesan kesalahan.
  function setError(field, message) {
    const error = form.querySelector(
      `[data-error-for="${field.name}"]`
    );

    field.classList.toggle('form__input--error', Boolean(message));

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

  // Menampilkan pesan hasil proses.
  function showMessage(message, type = 'info') {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }

  // Menghapus pesan hasil proses.
  function clearMessage() {
    if (!feedback) return;
    feedback.textContent = '';
    feedback.hidden = true;
  }

  // Validasi email, password, dan konfirmasi.
  function validateField(field) {
    const value = field.value.trim();
    let message = '';

    if (!value) {
      message = 'Bagian ini wajib diisi.';
    } else if (
      field === emailField &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      message = 'Format email tidak valid.';
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

  // Mengambil data akun anggota.
  function readAccounts() {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return [];

    const accounts = JSON.parse(raw);

    if (!Array.isArray(accounts)) {
      throw new Error('Data akun anggota tidak valid.');
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

  // Proses pemulihan password anggota.
  async function resetPassword() {
    clearMessage();

    const valid = [
      emailField,
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
      const email = emailField.value.trim().toLowerCase();
      const accounts = readAccounts();

      // Mencari akun berdasarkan email.
      const index = accounts.findIndex(account =>
        String(account.email || '').trim().toLowerCase() === email
      );

      if (index < 0) {
        showMessage(
          'Email tidak ditemukan pada akun anggota.',
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
      localStorage.setItem(
        ACCOUNT_KEY,
        JSON.stringify(accounts)
      );

      form.reset();

      [emailField, passwordField, confirmField].forEach(field => {
        setError(field, '');
      });

      showMessage(
        'Password berhasil diperbarui pada penyimpanan browser. Silakan login kembali.',
        'info'
      );

      window.setTimeout(() => {
        window.location.href = '../login/anggota.html';
      }, 1200);

    } catch (error) {
      console.error('Lupa password anggota:', error);

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
      field !== emailField &&
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
  // Capture mencegah handler submit lama memproses form yang sama.
  form.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetPassword();
  }, true);

})();
