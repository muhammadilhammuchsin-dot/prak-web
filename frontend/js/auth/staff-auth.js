
/* =========================================================
   STAFF-AUTH.JS
   AUTENTIKASI BERSAMA PUSTAKAWAN DAN KEPUS

   FITUR:
   1. Satu sistem pendaftaran untuk dua jenis akun.
   2. Menyimpan role setiap akun.
   3. Login berdasarkan role yang sesuai.
   4. Migrasi akun Pustakawan lama.
   5. Validasi input dan akun duplikat.
   6. Hash password menggunakan PBKDF2-SHA256.
   7. Tampilkan/sembunyikan password.
   8. Membuat sesi terpisah.
   9. Mengarahkan pengguna ke beranda sesuai role.

   MODE: SIMULASI FRONTEND MENGGUNAKAN localStorage.
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const ACCOUNT_KEY = 'eperpus_staff_accounts';
  const LEGACY_ACCOUNT_KEY = 'eperpus_pustakawan_accounts';
  const PASSWORD_ITERATIONS = 120000;
  const FORM_SELECTOR = 'form[data-auth-form]';

  // Pengaturan masing-masing jenis akun.
  const ROLE_CONFIG = {
    pustakawan: {
      label: 'Pustakawan',
      identityLabel: 'NIP / Kode Pustakawan',
      loginUrl: '../login/pustakawan.html',
      homeUrl: '../../pustakawan/beranda.html',
      sessionKey: 'eperpus_pustakawan_session'
    },
    kepus: {
      label: 'Kepala Perpustakaan',
      identityLabel: 'NIP / Kode Kepus',
      loginUrl: '../login/kepus.html',
      homeUrl: '../../kepus/laporan.html',
      sessionKey: 'eperpus_kepus_session'
    }
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  // =======================================================
  // 2. NORMALISASI IDENTITAS
  // =======================================================

  function normalizeIdentity(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function isValidRole(role) {
    return Object.prototype.hasOwnProperty.call(
      ROLE_CONFIG,
      role
    );
  }

  // =======================================================
  // 3. MEMBACA PENYIMPANAN AKUN
  // =======================================================

  function readAccounts(key) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) return [];

      const accounts = JSON.parse(raw);

      if (!Array.isArray(accounts)) {
        throw new Error('Format data akun tidak valid.');
      }

      return accounts;
    } catch (error) {
      console.error(`Gagal membaca ${key}:`, error);
      throw new Error(
        'Data akun tidak dapat dibaca. Periksa penyimpanan browser.'
      );
    }
  }

  // =======================================================
  // 4. MENYIMPAN AKUN
  // =======================================================

  function saveAccounts(accounts) {
    try {
      localStorage.setItem(
        ACCOUNT_KEY,
        JSON.stringify(accounts)
      );

      return true;
    } catch (error) {
      console.error('Gagal menyimpan akun:', error);
      throw new Error(
        'Akun gagal disimpan. Periksa kapasitas penyimpanan browser.'
      );
    }
  }

  // =======================================================
  // 5. MIGRASI AKUN PUSTAKAWAN LAMA
  // =======================================================

  function getAccounts() {
    const accounts = readAccounts(ACCOUNT_KEY);
    const legacyAccounts = readAccounts(LEGACY_ACCOUNT_KEY);
    let changed = false;

    // Akun lama dimigrasikan sebagai Pustakawan.
    // Akun lama tidak otomatis memperoleh hak akses Kepus.
    legacyAccounts.forEach(oldAccount => {
      const identity = normalizeIdentity(oldAccount.identity);

      if (
        !identity ||
        !oldAccount.salt ||
        !oldAccount.passwordHash
      ) {
        return;
      }

      const exists = accounts.some(account =>
        account.role === 'pustakawan' &&
        normalizeIdentity(account.identity) === identity
      );

      if (!exists) {
        accounts.push({
          role: 'pustakawan',
          nama: oldAccount.nama || '',
          identity,
          email: oldAccount.email || '',
          salt: oldAccount.salt,
          passwordHash: oldAccount.passwordHash,
          createdAt: oldAccount.createdAt ||
            new Date().toISOString()
        });

        changed = true;
      }
    });

    if (changed) {
      saveAccounts(accounts);
    }

    return accounts;
  }

  // =======================================================
  // 6. HASH PASSWORD PBKDF2
  // =======================================================

  function toBase64(bytes) {
    let binary = '';

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  function fromBase64(value) {
    return Uint8Array.from(
      atob(value),
      character => character.charCodeAt(0)
    );
  }

  function generateSalt() {
    if (!window.crypto?.getRandomValues) {
      throw new Error('Browser tidak mendukung keamanan password.');
    }

    return window.crypto.getRandomValues(
      new Uint8Array(16)
    );
  }

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        'Web Crypto tidak tersedia. Jalankan proyek melalui Live Server.'
      );
    }

    const encoder = new TextEncoder();

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const hash = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PASSWORD_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return toBase64(new Uint8Array(hash));
  }

  // Membandingkan hash tanpa berhenti pada karakter pertama.
  function compareHash(first, second) {
    if (
      typeof first !== 'string' ||
      typeof second !== 'string' ||
      first.length !== second.length
    ) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < first.length; i++) {
      difference |= first.charCodeAt(i) ^ second.charCodeAt(i);
    }

    return difference === 0;
  }

  // =======================================================
  // 7. FEEDBACK FORM
  // =======================================================

  function showFeedback(form, message, type = 'info') {
    const feedback = $('[data-auth-feedback]', form);

    if (!feedback) return;

    feedback.textContent = message;
    feedback.className = `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }

  function clearFeedback(form) {
    const feedback = $('[data-auth-feedback]', form);

    if (!feedback) return;

    feedback.textContent = '';
    feedback.hidden = true;
    feedback.className = 'auth-feedback';
  }

  // =======================================================
  // 8. VALIDASI INPUT
  // =======================================================

  function getErrorElement(form, name) {
    return $$('[data-error-for]', form).find(element =>
      element.dataset.errorFor === name
    ) || null;
  }

  function setFieldError(form, field, message) {
    field.setAttribute('aria-invalid', 'true');
    field.classList.add('form__input--error');

    const error = getErrorElement(form, field.name);

    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearFieldError(form, field) {
    field.removeAttribute('aria-invalid');
    field.classList.remove('form__input--error');

    const error = getErrorElement(form, field.name);

    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function validateField(form, field) {
    const formType = form.dataset.authForm;
    const value = field.value.trim();

    // Pemeriksaan input wajib.
    if (field.required && !value) {
      setFieldError(form, field, 'Bagian ini wajib diisi.');
      return false;
    }

    // Input opsional boleh kosong.
    if (!value) {
      clearFieldError(form, field);
      return true;
    }

    // Validasi identitas pegawai.
    if (field.name === 'npm') {
      const identity = normalizeIdentity(value);

      if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(identity)) {
        setFieldError(
          form,
          field,
          'NIP atau kode identitas tidak valid.'
        );
        return false;
      }
    }

    // Validasi nama.
    if (field.name === 'nama') {
      if (value.length < 3 || value.length > 100) {
        setFieldError(
          form,
          field,
          'Nama harus terdiri dari 3 sampai 100 karakter.'
        );
        return false;
      }
    }

    // Validasi email opsional.
    if (field.name === 'email') {
      if (field.validity.typeMismatch) {
        setFieldError(form, field, 'Format email tidak valid.');
        return false;
      }

      if (value.length > 150) {
        setFieldError(form, field, 'Email maksimal 150 karakter.');
        return false;
      }
    }

    // Validasi panjang password saat pendaftaran.
    if (
      field.name === 'password' &&
      formType === 'register' &&
      Array.from(field.value).length < 8
    ) {
      setFieldError(
        form,
        field,
        'Password minimal 8 karakter.'
      );
      return false;
    }

    // Validasi konfirmasi password.
    if (
      field.name === 'password-confirm' &&
      formType === 'register'
    ) {
      const password = form.elements.namedItem('password');

      if (field.value !== password.value) {
        setFieldError(
          form,
          field,
          'Konfirmasi password tidak sama.'
        );
        return false;
      }
    }

    clearFieldError(form, field);
    return true;
  }

  function validateForm(form) {
    const fields = $$('input[name]', form);
    let valid = true;
    let firstInvalid = null;

    fields.forEach(field => {
      if (!validateField(form, field)) {
        valid = false;
        firstInvalid ||= field;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      showFeedback(
        form,
        'Periksa kembali data yang Anda masukkan.',
        'error'
      );
    }

    return valid;
  }

  // =======================================================
  // 9. MENENTUKAN ROLE PENDAFTARAN
  // =======================================================

  function initializeRegistrationRole(form) {
    const params = new URLSearchParams(
      window.location.search
    );

    const role = params.get('role');

    // Hanya dua role yang diperbolehkan.
    if (!isValidRole(role)) {
      showFeedback(
        form,
        'Jenis akun tidak valid. Kembali ke halaman login dan pilih Daftar di sana.',
        'error'
      );

      const button = $('button[type="submit"]', form);

      if (button) button.disabled = true;

      return false;
    }

    form.dataset.userRole = role;

    const config = ROLE_CONFIG[role];

    // Mengubah judul sesuai role.
    const heading = $('[data-role-title]');
    const description = $('[data-role-description]');
    const identityLabel = $('[data-role-identity-label]');
    const identityInput = $('#npm');

    if (heading) {
      heading.textContent = `Daftar Akun ${config.label}`;
    }

    if (description) {
      description.textContent =
        `Buat akun ${config.label} menggunakan identitas pegawai.`;
    }

    if (identityLabel) {
      identityLabel.textContent = config.identityLabel;
    }

    if (identityInput) {
      identityInput.placeholder =
        `Masukkan ${config.identityLabel}`;
    }

    // Memperbarui tautan kembali ke login sesuai role.
    $$('[data-role-login-link]').forEach(link => {
      link.href = config.loginUrl;
    });

    return true;
  }

  // =======================================================
  // 10. PEMERIKSAAN AKUN DUPLIKAT
  // =======================================================

  function checkDuplicate(accounts, role, identity, email) {
    const duplicateIdentity = accounts.some(account =>
      account.role === role &&
      normalizeIdentity(account.identity) === identity
    );

    if (duplicateIdentity) {
      return 'NIP atau kode identitas sudah terdaftar.';
    }

    if (email) {
      const duplicateEmail = accounts.some(account =>
        account.role === role &&
        String(account.email || '').toLowerCase() === email
      );

      if (duplicateEmail) {
        return 'Email sudah digunakan pada jenis akun ini.';
      }
    }

    return '';
  }

  // =======================================================
  // 11. PROSES PENDAFTARAN
  // =======================================================

  async function handleRegistration(form) {
    const role = form.dataset.userRole;

    if (!isValidRole(role)) {
      showFeedback(form, 'Jenis akun tidak valid.', 'error');
      return;
    }

    const nama = form.elements.namedItem('nama').value.trim();

    const identity = normalizeIdentity(
      form.elements.namedItem('npm').value
    );

    const email = form.elements.namedItem('email').value
      .trim()
      .toLowerCase();

    const password = form.elements.namedItem('password').value;

    const accounts = getAccounts();

    // Mencegah identitas dan email ganda pada role yang sama.
    const duplicateMessage = checkDuplicate(
      accounts,
      role,
      identity,
      email
    );

    if (duplicateMessage) {
      showFeedback(form, duplicateMessage, 'error');
      return;
    }

    // Membuat salt dan hash password.
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Menyimpan akun beserta role.
    const newAccount = {
      role,
      nama,
      identity,
      email,
      salt: toBase64(salt),
      passwordHash,
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    saveAccounts(accounts);

    showFeedback(
      form,
      `Pendaftaran ${ROLE_CONFIG[role].label} berhasil. Silakan login.`,
      'info'
    );

    // Kembali ke halaman login sesuai role.
    window.setTimeout(() => {
      window.location.href = ROLE_CONFIG[role].loginUrl;
    }, 1000);
  }

  // =======================================================
  // 12. PROSES LOGIN
  // =======================================================

  async function handleLogin(form) {
    const role = form.dataset.userRole;

    if (!isValidRole(role)) {
      showFeedback(form, 'Jenis login tidak valid.', 'error');
      return;
    }

    const identity = normalizeIdentity(
      form.elements.namedItem('npm').value
    );

    const password = form.elements.namedItem('password').value;

    // Menghapus sesi role sebelumnya agar tidak tertukar.
    Object.values(ROLE_CONFIG).forEach(config => {
      sessionStorage.removeItem(config.sessionKey);
    });

    const accounts = getAccounts();

    // Identitas dan role harus cocok.
    const account = accounts.find(item =>
      normalizeIdentity(item.identity) === identity &&
      item.role === role
    );

    if (!account) {
      const otherAccount = accounts.find(item =>
        normalizeIdentity(item.identity) === identity
      );

      if (otherAccount && isValidRole(otherAccount.role)) {
        showFeedback(
          form,
          `Akun ini terdaftar sebagai ${ROLE_CONFIG[otherAccount.role].label}. Gunakan halaman login yang sesuai.`,
          'error'
        );
      } else {
        showFeedback(
          form,
          'NIP atau kode identitas belum terdaftar.',
          'error'
        );
      }

      return;
    }

    if (!account.salt || !account.passwordHash) {
      throw new Error('Data autentikasi akun tidak lengkap.');
    }

    // Memverifikasi password.
    const salt = fromBase64(account.salt);
    const inputHash = await hashPassword(password, salt);

    if (!compareHash(inputHash, account.passwordHash)) {
      showFeedback(
        form,
        'Password yang Anda masukkan salah.',
        'error'
      );
      return;
    }

    // Membuat sesi berdasarkan role.
    const session = {
      role,
      identity: account.identity,
      nama: account.nama,
      email: account.email || '',
      loginAt: new Date().toISOString()
    };

    sessionStorage.setItem(
      ROLE_CONFIG[role].sessionKey,
      JSON.stringify(session)
    );

    showFeedback(
      form,
      'Login berhasil. Mengalihkan ke halaman utama...',
      'info'
    );

    // Tujuan halaman berbeda untuk setiap role.
    window.setTimeout(() => {
      window.location.href = ROLE_CONFIG[role].homeUrl;
    }, 700);
  }

  // =======================================================
  // 13. TAMPILKAN / SEMBUNYIKAN PASSWORD
  // =======================================================

  function togglePassword(button) {
    const field = document.getElementById(
      button.dataset.togglePassword
    );

    if (!field) return;

    const visible = field.type === 'password';

    field.type = visible ? 'text' : 'password';

    button.setAttribute(
      'aria-pressed',
      String(visible)
    );

    button.setAttribute(
      'aria-label',
      visible ? 'Sembunyikan password' : 'Tampilkan password'
    );
  }

  // =======================================================
  // 14. EVENT SUBMIT
  // =======================================================

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    clearFeedback(form);

    if (!validateForm(form)) return;

    const button = $('button[type="submit"]', form);
    const originalHTML = button?.innerHTML;

    // Mencegah submit berulang.
    if (button) {
      button.disabled = true;
      button.textContent = 'Memproses...';
    }

    try {
      if (form.dataset.authForm === 'register') {
        await handleRegistration(form);
      } else if (form.dataset.authForm === 'login') {
        await handleLogin(form);
      }
    } catch (error) {
      console.error('Proses autentikasi gagal:', error);

      showFeedback(
        form,
        error.message || 'Terjadi kesalahan saat memproses akun.',
        'error'
      );
    } finally {
      if (button && document.contains(button)) {
        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    }
  }

  // =======================================================
  // 15. EVENT INPUT DAN CHANGE
  // =======================================================

  function handleFieldChange(event) {
    const field = event.target;

    if (!(field instanceof HTMLInputElement)) return;

    const form = field.closest(FORM_SELECTOR);

    if (!form || !field.name) return;

    validateField(form, field);

    // Memeriksa ulang konfirmasi ketika password berubah.
    if (
      field.name === 'password' &&
      form.dataset.authForm === 'register'
    ) {
      const confirmation =
        form.elements.namedItem('password-confirm');

      if (confirmation?.value) {
        validateField(form, confirmation);
      }
    }

    clearFeedback(form);
  }

  // =======================================================
  // 16. INISIALISASI
  // =======================================================

  function initialize() {
    const forms = $$(FORM_SELECTOR);

    forms.forEach(form => {
      // Form pendaftaran mengambil role dari URL.
      if (form.dataset.authForm === 'register') {
        initializeRegistrationRole(form);
      }

      form.addEventListener('submit', handleFormSubmit);
      form.addEventListener('input', handleFieldChange);
      form.addEventListener('change', handleFieldChange);
    });

    // Event tombol tampil/sembunyikan password.
    document.addEventListener('click', event => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-toggle-password]')
        : null;

      if (button) togglePassword(button);
    });
  }

  // Jalankan setelah HTML selesai diparsing.
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
