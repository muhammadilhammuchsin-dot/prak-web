/* =========================================================
   STAFF-AUTH.JS
   AUTENTIKASI PUSTAKAWAN DAN KEPALA PERPUSTAKAAN

   Fitur:
   1. Pendaftaran menggunakan halaman terpisah.
   2. Role ditetapkan berdasarkan halaman.
   3. Login terpisah berdasarkan role.
   4. Validasi identitas dan password.
   5. Pencegahan akun duplikat.
   6. Hash password menggunakan PBKDF2-SHA256.
   7. Tampilkan/sembunyikan password.
   8. Sesi terpisah untuk setiap role.

   MODE:
   Simulasi frontend menggunakan localStorage.
   Belum terhubung ke MySQL atau PHP.
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

  // Konfigurasi setiap jenis akun.
  const ROLE_CONFIG = {
    pustakawan: {
      label: 'Pustakawan',
      loginUrl: '../login/pustakawan.html',
      homeUrl: '../../pustakawan/beranda.html',
      sessionKey: 'eperpus_pustakawan_session'
    },
    kepus: {
      label: 'Kepala Perpustakaan',
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
  // 2. FUNGSI DASAR
  // =======================================================

  // Menyamakan format identitas.
  function normalizeIdentity(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  // Memastikan role berasal dari konfigurasi.
  function isValidRole(role) {
    return Object.prototype.hasOwnProperty.call(
      ROLE_CONFIG,
      role
    );
  }

  // =======================================================
  // 3. MEMBACA DAN MENYIMPAN AKUN
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

  // Migrasi akun Pustakawan dari penyimpanan lama.
  // Akun lama tidak otomatis memperoleh hak akses Kepus.
  function getAccounts() {
    const accounts = readAccounts(ACCOUNT_KEY);
    const legacyAccounts = readAccounts(LEGACY_ACCOUNT_KEY);
    let changed = false;

    legacyAccounts.forEach(oldAccount => {
      if (!oldAccount || typeof oldAccount !== 'object') {
        return;
      }

      const identity = normalizeIdentity(oldAccount.identity);

      if (
        !identity ||
        !oldAccount.salt ||
        !oldAccount.passwordHash
      ) {
        return;
      }

      const exists = accounts.some(account =>
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
  // 4. HASH PASSWORD PBKDF2-SHA256
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
      throw new Error(
        'Browser tidak mendukung fungsi keamanan password.'
      );
    }

    return window.crypto.getRandomValues(
      new Uint8Array(16)
    );
  }

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        'Web Crypto tidak tersedia. Jalankan melalui Live Server atau HTTPS.'
      );
    }

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
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

  // Membandingkan hash.
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
      difference |=
        first.charCodeAt(i) ^ second.charCodeAt(i);
    }

    return difference === 0;
  }

  // =======================================================
  // 5. FEEDBACK DAN VALIDASI
  // =======================================================

  function showFeedback(form, message, type = 'info') {
    const feedback = $('[data-auth-feedback]', form);

    if (!feedback) return;

    feedback.textContent = message;
    feedback.className =
      `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }

  function clearFeedback(form) {
    const feedback = $('[data-auth-feedback]', form);

    if (!feedback) return;

    feedback.textContent = '';
    feedback.hidden = true;
    feedback.className = 'auth-feedback';
  }

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

  // Validasi setiap field.
  function validateField(form, field) {
    const formType = form.dataset.authForm;
    const value = String(field.value || '').trim();

    // Field wajib.
    if (field.required && !value) {
      setFieldError(
        form,
        field,
        'Bagian ini wajib diisi.'
      );

      return false;
    }

    // Field opsional boleh kosong.
    if (!value) {
      clearFieldError(form, field);
      return true;
    }

    // Validasi role.
    if (
      field.name === 'role' &&
      !isValidRole(value)
    ) {
      setFieldError(
        form,
        field,
        'Jenis akun tidak valid.'
      );

      return false;
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

    // Validasi nama lengkap.
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

    // Validasi email opsional jika field tersedia.
    if (field.name === 'email') {
      if (field.validity?.typeMismatch) {
        setFieldError(
          form,
          field,
          'Format email tidak valid.'
        );

        return false;
      }

      if (value.length > 150) {
        setFieldError(
          form,
          field,
          'Email maksimal 150 karakter.'
        );

        return false;
      }
    }

    // Password minimal 8 karakter saat pendaftaran.
    if (
      field.name === 'password' &&
      formType === 'register' &&
      field.value.length < 8
    ) {
      setFieldError(
        form,
        field,
        'Password minimal 8 karakter.'
      );

      return false;
    }

    // Konfirmasi password harus sama.
    if (
      (
        field.name === 'password-confirm' ||
        field.name === 'konfirmasi_password'
      ) &&
      formType === 'register'
    ) {
      const password =
        form.elements.namedItem('password');

      if (!password || field.value !== password.value) {
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

  // Validasi seluruh field.
  function validateForm(form) {
    const fields = $$(
      'input[name], select[name]',
      form
    );

    let valid = true;
    let firstInvalid = null;

    fields.forEach(field => {
      if (!validateField(form, field)) {
        valid = false;

        if (!firstInvalid) {
          firstInvalid = field;
        }
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
  // 6. VALIDASI ROLE HALAMAN PENDAFTARAN
  // =======================================================

  function validateRegistrationRole(form) {
    const role = form.dataset.userRole;
    const roleField = form.elements.namedItem('role');

    // Role harus cocok dengan halaman.
    if (
      !isValidRole(role) ||
      !roleField ||
      roleField.value !== role
    ) {
      showFeedback(
        form,
        'Jenis akun tidak sesuai dengan halaman pendaftaran.',
        'error'
      );

      const button = $('button[type="submit"]', form);

      if (button) {
        button.disabled = true;
      }

      return false;
    }

    return true;
  }

  // =======================================================
  // 7. PEMERIKSAAN AKUN DUPLIKAT
  // =======================================================

  function checkDuplicate(accounts, identity, email) {
    // Satu identitas hanya boleh memiliki satu role petugas.
    const existingIdentity = accounts.find(account =>
      normalizeIdentity(account.identity) === identity
    );

    if (existingIdentity) {
      const roleName =
        ROLE_CONFIG[existingIdentity.role]?.label ||
        'petugas';

      return `NIP/kode identitas sudah terdaftar sebagai ${roleName}. Gunakan identitas lain atau login dengan akun tersebut.`;
    }

    // Email tidak boleh digunakan akun petugas lain.
    if (email) {
      const existingEmail = accounts.find(account =>
        String(account.email || '')
          .trim()
          .toLowerCase() === email
      );

      if (existingEmail) {
        return 'Email sudah digunakan oleh akun petugas lain.';
      }
    }

    return '';
  }

  // =======================================================
  // 8. PROSES PENDAFTARAN
  // =======================================================

  async function handleRegistration(form) {
    const role = form.dataset.userRole;
    const roleField = form.elements.namedItem('role');

    // Memastikan role sesuai halaman.
    if (
      !isValidRole(role) ||
      !roleField ||
      roleField.value !== role
    ) {
      showFeedback(
        form,
        'Jenis akun tidak sesuai dengan halaman pendaftaran.',
        'error'
      );

      return;
    }

    const nama =
      form.elements.namedItem('nama').value.trim();

    const identity = normalizeIdentity(
      form.elements.namedItem('npm').value
    );

    // Email tidak digunakan pada form saat ini.
    const emailField =
      form.elements.namedItem('email');

    const email = emailField
      ? String(emailField.value || '')
          .trim()
          .toLowerCase()
      : '';

    const password =
      form.elements.namedItem('password').value;

    const confirmationField =
      form.elements.namedItem('konfirmasi_password') ||
      form.elements.namedItem('password-confirm');

    // Memeriksa konfirmasi password.
    if (
      !confirmationField ||
      confirmationField.value !== password
    ) {
      showFeedback(
        form,
        'Konfirmasi password tidak sama.',
        'error'
      );

      return;
    }

    const accounts = getAccounts();

    // Memeriksa identitas dan email duplikat.
    const duplicateMessage = checkDuplicate(
      accounts,
      identity,
      email
    );

    if (duplicateMessage) {
      showFeedback(
        form,
        duplicateMessage,
        'error'
      );

      return;
    }

    // Membuat salt dan hash password.
    const salt = generateSalt();
    const passwordHash = await hashPassword(
      password,
      salt
    );

    // Membuat data akun baru.
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
      `Pendaftaran ${ROLE_CONFIG[role].label} berhasil. Anda akan diarahkan ke halaman login yang sesuai.`,
      'info'
    );

    // Mengarahkan pengguna sesuai role.
    window.setTimeout(() => {
      window.location.href =
        ROLE_CONFIG[role].loginUrl;
    }, 1000);
  }

  // =======================================================
  // 9. PROSES LOGIN
  // =======================================================

  async function handleLogin(form) {
    const role = form.dataset.userRole;

    if (!isValidRole(role)) {
      showFeedback(
        form,
        'Jenis login tidak valid.',
        'error'
      );

      return;
    }

    const identity = normalizeIdentity(
      form.elements.namedItem('npm').value
    );

    const password =
      form.elements.namedItem('password').value;

    // Menghapus sesi petugas sebelumnya.
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

      if (
        otherAccount &&
        isValidRole(otherAccount.role)
      ) {
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
      throw new Error(
        'Data autentikasi akun tidak lengkap.'
      );
    }

    // Verifikasi password.
    const salt = fromBase64(account.salt);
    const inputHash = await hashPassword(
      password,
      salt
    );

    if (
      !compareHash(
        inputHash,
        account.passwordHash
      )
    ) {
      showFeedback(
        form,
        'Password yang Anda masukkan salah.',
        'error'
      );

      return;
    }

    // Membuat sesi sesuai role.
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

    // Mengarahkan ke beranda sesuai role.
    window.setTimeout(() => {
      window.location.href =
        ROLE_CONFIG[role].homeUrl;
    }, 700);
  }

  // =======================================================
  // 10. TAMPILKAN / SEMBUNYIKAN PASSWORD
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
      visible
        ? 'Sembunyikan password'
        : 'Tampilkan password'
    );
  }

  // =======================================================
  // 11. EVENT SUBMIT FORM
  // =======================================================

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    clearFeedback(form);

    // Validasi seluruh input.
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
      console.error(
        'Proses autentikasi gagal:',
        error
      );

      showFeedback(
        form,
        error.message ||
          'Terjadi kesalahan saat memproses akun.',
        'error'
      );
    } finally {
      if (
        button &&
        document.contains(button)
      ) {
        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    }
  }

  // =======================================================
  // 12. EVENT INPUT DAN VALIDASI ULANG
  // =======================================================

  function handleFieldChange(event) {
    const field = event.target;

    if (!(field instanceof HTMLInputElement)) {
      return;
    }

    const form = field.closest(FORM_SELECTOR);

    if (!form || !field.name) return;

    validateField(form, field);

    // Memeriksa ulang konfirmasi jika password berubah.
    if (
      field.name === 'password' &&
      form.dataset.authForm === 'register'
    ) {
      const confirmation =
        form.elements.namedItem('konfirmasi_password') ||
        form.elements.namedItem('password-confirm');

      if (confirmation?.value) {
        validateField(form, confirmation);
      }
    }

    clearFeedback(form);
  }

  // =======================================================
  // 13. INISIALISASI
  // =======================================================

  function initialize() {
    const forms = $$(FORM_SELECTOR);

    forms.forEach(form => {
      // Memastikan role sesuai halaman pendaftaran.
      if (form.dataset.authForm === 'register') {
        validateRegistrationRole(form);
      }

      form.addEventListener(
        'submit',
        handleFormSubmit
      );

      form.addEventListener(
        'input',
        handleFieldChange
      );
    });

    // Event tombol tampil/sembunyikan password.
    document.addEventListener('click', event => {
      const button =
        event.target instanceof Element
          ? event.target.closest('[data-toggle-password]')
          : null;

      if (button) {
        togglePassword(button);
      }
    });
  }

  // Menjalankan setelah HTML selesai diparsing.
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