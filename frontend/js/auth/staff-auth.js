
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
   9. Pemulihan password Pustakawan dan Kepus.
   MODE:
   Simulasi frontend menggunakan localStorage.
   Belum terhubung ke MySQL atau PHP.
   ========================================================= */
(() => {
  'use strict';
  // 1. KONFIGURASI
  const ACCOUNT_KEY = 'eperpus_staff_accounts';
  const LEGACY_ACCOUNT_KEY = 'eperpus_pustakawan_accounts';
  const PASSWORD_ITERATIONS = 120000;
  const FORM_SELECTOR = 'form[data-auth-form]';
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
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  // 2. FUNGSI DASAR
  function normalizeIdentity(value) {
    return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
  }
  function isValidRole(role) {
    return Object.prototype.hasOwnProperty.call(ROLE_CONFIG, role);
  }
  // 3. MEMBACA DAN MENYIMPAN AKUN
  function readAccounts(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const accounts = JSON.parse(raw);
      if (!Array.isArray(accounts)) throw new Error('Format data akun tidak valid.');
      return accounts;
    } catch (error) {
      console.error(`Gagal membaca ${key}:`, error);
      throw new Error('Data akun tidak dapat dibaca. Periksa penyimpanan browser.');
    }
  }
  function saveAccounts(accounts) {
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
      return true;
    } catch (error) {
      console.error('Gagal menyimpan akun:', error);
      throw new Error('Akun gagal disimpan. Periksa kapasitas penyimpanan browser.');
    }
  }
  // Migrasi akun Pustakawan dari penyimpanan lama.
  function getAccounts() {
    const accounts = readAccounts(ACCOUNT_KEY);
    const legacyAccounts = readAccounts(LEGACY_ACCOUNT_KEY);
    let changed = false;
    legacyAccounts.forEach(oldAccount => {
      if (!oldAccount || typeof oldAccount !== 'object') return;
      const identity = normalizeIdentity(oldAccount.identity);
      if (!identity || !oldAccount.salt || !oldAccount.passwordHash) return;
      const exists = accounts.some(account => normalizeIdentity(account.identity) === identity);
      if (!exists) {
        accounts.push({
          role: 'pustakawan',
          nama: oldAccount.nama || '',
          identity,
          email: oldAccount.email || '',
          salt: oldAccount.salt,
          passwordHash: oldAccount.passwordHash,
          createdAt: oldAccount.createdAt || new Date().toISOString()
        });
        changed = true;
      }
    });
    if (changed) saveAccounts(accounts);
    return accounts;
  }
  // 4. HASH PASSWORD PBKDF2-SHA256
  function toBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }
  function fromBase64(value) {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }
  function generateSalt() {
    if (!window.crypto?.getRandomValues) throw new Error('Browser tidak mendukung fungsi keamanan password.');
    return window.crypto.getRandomValues(new Uint8Array(16));
  }
  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto tidak tersedia. Jalankan melalui Live Server atau HTTPS.');
    const keyMaterial = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return toBase64(new Uint8Array(hash));
  }
  function compareHash(first, second) {
    if (typeof first !== 'string' || typeof second !== 'string' || first.length !== second.length) return false;
    let difference = 0;
    for (let i = 0; i < first.length; i++) difference |= first.charCodeAt(i) ^ second.charCodeAt(i);
    return difference === 0;
  }
  // 5. FEEDBACK DAN VALIDASI
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
  function getErrorElement(form, name) {
    return $$('[data-error-for]', form).find(element => element.dataset.errorFor === name) || null;
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
    if (field.required && !value) {
      setFieldError(form, field, 'Bagian ini wajib diisi.');
      return false;
    }
    if (!value) {
      clearFieldError(form, field);
      return true;
    }
    if (field.name === 'role' && !isValidRole(value)) {
      setFieldError(form, field, 'Jenis akun tidak valid.');
      return false;
    }
    if (field.name === 'npm' && !/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(normalizeIdentity(value))) {
      setFieldError(form, field, 'NIP atau kode identitas tidak valid.');
      return false;
    }
    if (field.name === 'nama' && (value.length < 3 || value.length > 100)) {
      setFieldError(form, field, 'Nama harus terdiri dari 3 sampai 100 karakter.');
      return false;
    }
    if (field.name === 'email') {
      if (field.validity?.typeMismatch) {
        setFieldError(form, field, 'Format email tidak valid.');
        return false;
      }
      if (value.length > 150) {
        setFieldError(form, field, 'Email maksimal 150 karakter.');
        return false;
      }
    }
    if (field.name === 'password' && formType === 'register' && field.value.length < 8) {
      setFieldError(form, field, 'Password minimal 8 karakter.');
      return false;
    }
    if (['password-confirm', 'konfirmasi_password'].includes(field.name) && formType === 'register') {
      const password = form.elements.namedItem('password');
      if (!password || field.value !== password.value) {
        setFieldError(form, field, 'Konfirmasi password tidak sama.');
        return false;
      }
    }
    clearFieldError(form, field);
    return true;
  }
  // Validasi seluruh field.
  function validateForm(form) {
    const fields = $$('input[name], select[name]', form);
    let valid = true;
    let firstInvalid = null;
    fields.forEach(field => {
      if (!validateField(form, field)) {
        valid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      showFeedback(form, 'Periksa kembali data yang Anda masukkan.', 'error');
    }
    return valid;
  }
  // 6. VALIDASI ROLE HALAMAN PENDAFTARAN
  function validateRegistrationRole(form) {
    const role = form.dataset.userRole;
    const roleField = form.elements.namedItem('role');
    if (!isValidRole(role) || !roleField || roleField.value !== role) {
      showFeedback(form, 'Jenis akun tidak sesuai dengan halaman pendaftaran.', 'error');
      const button = $('button[type="submit"]', form);
      if (button) button.disabled = true;
      return false;
    }
    return true;
  }
  // 7. PEMERIKSAAN AKUN DUPLIKAT
  function checkDuplicate(accounts, identity, email) {
    const existingIdentity = accounts.find(account => normalizeIdentity(account.identity) === identity);
    if (existingIdentity) {
      const roleName = ROLE_CONFIG[existingIdentity.role]?.label || 'petugas';
      return `NIP/kode identitas sudah terdaftar sebagai ${roleName}. Gunakan identitas lain atau login dengan akun tersebut.`;
    }
    if (email) {
      const existingEmail = accounts.find(account => String(account.email || '').trim().toLowerCase() === email);
      if (existingEmail) return 'Email sudah digunakan oleh akun petugas lain.';
    }
    return '';
  }
  // 8. PROSES PENDAFTARAN
  async function handleRegistration(form) {
    const role = form.dataset.userRole;
    const roleField = form.elements.namedItem('role');
    if (!isValidRole(role) || !roleField || roleField.value !== role) {
      showFeedback(form, 'Jenis akun tidak sesuai dengan halaman pendaftaran.', 'error');
      return;
    }
    const nama = form.elements.namedItem('nama').value.trim();
    const identityInput = String(form.elements.namedItem('npm').value || '').trim();
    const identity = normalizeIdentity(identityInput);
    const emailField = form.elements.namedItem('email');
    const email = emailField ? String(emailField.value || '').trim().toLowerCase() : '';
    const password = form.elements.namedItem('password').value;
    const confirmationField = form.elements.namedItem('konfirmasi_password') || form.elements.namedItem('password-confirm');
    if (!confirmationField || confirmationField.value !== password) {
      showFeedback(form, 'Konfirmasi password tidak sama.', 'error');
      return;
    }
    const accounts = getAccounts();
    const duplicateMessage = checkDuplicate(accounts, identity, email);
    if (duplicateMessage) {
      showFeedback(form, duplicateMessage, 'error');
      return;
    }
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const newAccount = {
      role,
      nama,
      identity,
      identityDisplay: identityInput,
      email,
      salt: toBase64(salt),
      passwordHash,
      createdAt: new Date().toISOString()
    };
    accounts.push(newAccount);
    saveAccounts(accounts);
    showFeedback(form, `Pendaftaran ${ROLE_CONFIG[role].label} berhasil. Anda akan diarahkan ke halaman login yang sesuai.`, 'info');
    window.setTimeout(() => {
      window.location.href = ROLE_CONFIG[role].loginUrl;
    }, 1000);
  }
  // 9. PROSES LOGIN
  async function handleLogin(form) {
    const role = form.dataset.userRole;
    if (!isValidRole(role)) {
      showFeedback(form, 'Jenis login tidak valid.', 'error');
      return;
    }
    const identity = normalizeIdentity(form.elements.namedItem('npm').value);
    const password = form.elements.namedItem('password').value;
    Object.values(ROLE_CONFIG).forEach(config => sessionStorage.removeItem(config.sessionKey));
    const accounts = getAccounts();
    const account = accounts.find(item => normalizeIdentity(item.identity) === identity && item.role === role);
    if (!account) {
      const otherAccount = accounts.find(item => normalizeIdentity(item.identity) === identity);
      if (otherAccount && isValidRole(otherAccount.role)) {
        showFeedback(form, `Akun ini terdaftar sebagai ${ROLE_CONFIG[otherAccount.role].label}. Gunakan halaman login yang sesuai.`, 'error');
      } else {
        showFeedback(form, 'NIP atau kode identitas belum terdaftar.', 'error');
      }
      return;
    }
    if (!account.salt || !account.passwordHash) throw new Error('Data autentikasi akun tidak lengkap.');
    const salt = fromBase64(account.salt);
    const inputHash = await hashPassword(password, salt);
    if (!compareHash(inputHash, account.passwordHash)) {
      showFeedback(form, 'Password yang Anda masukkan salah.', 'error');
      return;
    }
    const session = {
      role,
      identity: account.identity,
      identityDisplay: account.identityDisplay || account.identity,
      nama: account.nama,
      email: account.email || '',
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem(ROLE_CONFIG[role].sessionKey, JSON.stringify(session));
    showFeedback(form, 'Login berhasil. Mengalihkan ke halaman utama...', 'info');
    window.setTimeout(() => {
      window.location.href = ROLE_CONFIG[role].homeUrl;
    }, 700);
  }
  // 10. TAMPILKAN / SEMBUNYIKAN PASSWORD
  function togglePassword(button) {
    const field = document.getElementById(button.dataset.togglePassword);
    if (!field) return;
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Sembunyikan password' : 'Tampilkan password');
  }
  // 11. LUPA PASSWORD PETUGAS
  // HTML asli memakai DIV dan tombol type=button, bukan form submit.
  function initializeForgotPassword() {
    const containers = $$('[data-auth-form="forgot-password"][data-user-role]');
    containers.forEach(container => {
      if (container.dataset.forgotInitialized === 'true') return;
      container.dataset.forgotInitialized = 'true';
      const role = container.dataset.userRole;
      const roleConfig = ROLE_CONFIG[role];
      const identityField = container.querySelector('[name="email"], [name="npm"], [name="identity"]');
      const passwordField = container.querySelector('[name="password"]');
      const confirmField = container.querySelector('[name="password-confirm"], [name="passwordConfirm"], [name="konfirmasi_password"]');
      const otpField = container.querySelector('[name="otp"]');
      const saveButton = container.querySelector('[data-auth-action="forgot-password"]');
      if (!roleConfig || !identityField || !passwordField || !confirmField || !saveButton) {
        console.error('Elemen Lupa Password petugas tidak lengkap:', role);
        return;
      }
      // Pendaftaran petugas menyimpan NIP/kode, bukan email.
      // Kolom identitas dapat menerima email jika memang tersimpan,
      // atau NIP/kode akun jika email belum didaftarkan.
      const identityLabel = container.querySelector('label[for="email"], label[for="npm"]');
      if (identityLabel) identityLabel.textContent = 'Masukkan email atau NIP / Kode akun';
      identityField.placeholder = 'Masukkan email atau NIP / Kode akun';
      identityField.setAttribute('autocomplete', 'username');
      let isSubmitting = false;
      let feedback = container.querySelector('[data-auth-feedback]');
      if (!feedback) {
        feedback = document.createElement('p');
        feedback.className = 'auth-feedback';
        feedback.dataset.authFeedback = '';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        feedback.hidden = true;
        saveButton.insertAdjacentElement('afterend', feedback);
      }
      function setForgotError(field, message) {
        const group = field.closest('.form__group') || field.parentElement;
        let error = group.querySelector('.form__error');
        if (!error) {
          error = document.createElement('p');
          error.className = 'form__error';
          error.setAttribute('role', 'alert');
          group.appendChild(error);
        }
        error.dataset.errorFor = field.name;
        error.textContent = message;
        error.hidden = !message;
        field.classList.toggle('form__input--error', Boolean(message));
        if (message) field.setAttribute('aria-invalid', 'true');
        else field.removeAttribute('aria-invalid');
      }
      function showForgotFeedback(message, type = 'info') {
        feedback.textContent = message;
        feedback.className = `auth-feedback auth-feedback--${type}`;
        feedback.hidden = false;
      }
      function clearForgotFeedback() {
        feedback.textContent = '';
        feedback.hidden = true;
      }
      function validateForgotField(field) {
        const value = field.value.trim();
        let message = '';
        if (!value) {
          message = 'Bagian ini wajib diisi.';
        } else if (field === identityField && value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          message = 'Format email tidak valid.';
        } else if (field === identityField && !value.includes('@') && !/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(normalizeIdentity(value))) {
          message = 'NIP atau kode identitas tidak valid.';
        } else if (field === passwordField && field.value.length < 8) {
          message = 'Password minimal 8 karakter.';
        } else if (field === confirmField && field.value !== passwordField.value) {
          message = 'Konfirmasi password tidak sama.';
        }
        setForgotError(field, message);
        return !message;
      }
      async function resetStaffPassword() {
        if (isSubmitting) return;
        clearForgotFeedback();
        const valid = [identityField, passwordField, confirmField].map(validateForgotField).every(Boolean);
        if (!valid) {
          showForgotFeedback('Periksa kembali data yang Anda masukkan.', 'error');
          return;
        }
        isSubmitting = true;
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Memproses...';
        try {
          const entered = identityField.value.trim();
          const isEmail = entered.includes('@');
          const accounts = getAccounts();
          const index = accounts.findIndex(account => {
            if (account.role !== role) return false;
            if (isEmail) return String(account.email || '').trim().toLowerCase() === entered.toLowerCase();
            return normalizeIdentity(account.identity) === normalizeIdentity(entered);
          });
          if (index < 0) {
            showForgotFeedback(
              isEmail
                ? `Email tidak ditemukan pada akun ${roleConfig.label}. Jika email belum didaftarkan, gunakan NIP/kode akun.`
                : `NIP/kode tidak ditemukan pada akun ${roleConfig.label}.`,
              'error'
            );
            return;
          }
          // OTP belum diverifikasi karena layanan pengiriman OTP belum tersedia.
          // Hash dan salt dibuat dengan metode yang sama seperti proses login.
          const salt = generateSalt();
          const passwordHash = await hashPassword(passwordField.value, salt);
          accounts[index] = {
            ...accounts[index],
            salt: toBase64(salt),
            passwordHash,
            passwordUpdatedAt: new Date().toISOString()
          };
          saveAccounts(accounts);
          identityField.value = '';
          passwordField.value = '';
          confirmField.value = '';
          if (otpField) otpField.value = '';
          [identityField, passwordField, confirmField].forEach(field => setForgotError(field, ''));
          showForgotFeedback('Password berhasil diperbarui. Silakan login kembali.', 'success');
          window.setTimeout(() => {
            window.location.href = roleConfig.loginUrl;
          }, 1200);
        } catch (error) {
          console.error('Lupa password petugas:', error);
          showForgotFeedback(error.message || 'Password gagal diperbarui.', 'error');
        } finally {
          isSubmitting = false;
          saveButton.disabled = false;
          saveButton.textContent = originalText;
        }
      }
      [identityField, passwordField, confirmField].forEach(field => {
        ['input', 'change'].forEach(eventName => {
          field.addEventListener(eventName, () => {
            validateForgotField(field);
            if (field === passwordField && confirmField.value) validateForgotField(confirmField);
            clearForgotFeedback();
          });
        });
        field.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            resetStaffPassword();
          }
        });
        setForgotError(field, '');
      });
      saveButton.addEventListener('click', resetStaffPassword);
      // Ikon mata pada HTML asli menggunakan span .input-field__toggle.
      container.querySelectorAll('.input-field__toggle').forEach(toggle => {
        const input = toggle.closest('.input-field')?.querySelector('input[type="password"], input[type="text"]');
        if (!input) return;
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('aria-label', 'Tampilkan password');
        const changeVisibility = () => {
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          toggle.setAttribute('aria-pressed', String(visible));
          toggle.setAttribute('aria-label', visible ? 'Sembunyikan password' : 'Tampilkan password');
        };
        toggle.addEventListener('click', changeVisibility);
        toggle.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            changeVisibility();
          }
        });
      });
    });
  }
  // 12. EVENT SUBMIT FORM
  async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFeedback(form);
    if (!validateForm(form)) return;
    const button = $('button[type="submit"]', form);
    const originalHTML = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.textContent = 'Memproses...';
    }
    try {
      if (form.dataset.authForm === 'register') await handleRegistration(form);
      else if (form.dataset.authForm === 'login') await handleLogin(form);
    } catch (error) {
      console.error('Proses autentikasi gagal:', error);
      showFeedback(form, error.message || 'Terjadi kesalahan saat memproses akun.', 'error');
    } finally {
      if (button && document.contains(button)) {
        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    }
  }
  // 13. EVENT INPUT DAN VALIDASI ULANG
  function handleFieldChange(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) return;
    const form = field.closest(FORM_SELECTOR);
    if (!form || !field.name) return;
    validateField(form, field);
    if (field.name === 'password' && form.dataset.authForm === 'register') {
      const confirmation = form.elements.namedItem('konfirmasi_password') || form.elements.namedItem('password-confirm');
      if (confirmation?.value) validateField(form, confirmation);
    }
    clearFeedback(form);
  }
  // 14. INISIALISASI
  function initialize() {
    const forms = $$(FORM_SELECTOR);
    forms.forEach(form => {
      if (form.dataset.authForm === 'register') validateRegistrationRole(form);
      form.addEventListener('submit', handleFormSubmit);
      form.addEventListener('input', handleFieldChange);
    });
    document.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('[data-toggle-password]') : null;
      if (button) togglePassword(button);
    });
    // Inisialisasi halaman lupa password yang memakai DIV.
    initializeForgotPassword();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
