
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

  // 11. LUPA PASSWORD PETUGAS — ALUR EMAIL/IDENTITAS > OTP > PASSWORD BARU
  // Mode proyek saat ini masih frontend/localStorage. OTP dibuat sebagai simulasi
  // dan ditampilkan di feedback untuk pengujian; belum ada pengiriman email.
  function initializeForgotPassword() {
    const form = document.querySelector('form[data-auth-form="forgot-password"][data-user-role]');
    if (!form || form.dataset.forgotInitialized === 'true') return;
    const role = form.dataset.userRole;
    const roleConfig = ROLE_CONFIG[role];
    if (!roleConfig) return;
    form.dataset.forgotInitialized = 'true';

    const identityField = form.querySelector('[name="email"]');
    const passwordField = form.querySelector('[name="password"]');
    const confirmField = form.querySelector('[name="password-confirm"]');
    const sendButton = form.querySelector('[data-forgot-action="send-otp"]');
    const verifyButton = form.querySelector('[data-forgot-action="verify-otp"]');
    const resendButton = form.querySelector('[data-forgot-action="resend-otp"]');
    const saveButton = form.querySelector('[data-forgot-action="save-password"]');
    const otpDigits = $$('[data-otp-digit]', form);
    const steps = $$('[data-forgot-step]', form);
    const progress = $$('[data-forgot-progress]', form);
    const title = $('[data-forgot-title]', form);
    const caption = $('[data-forgot-caption]', form);
    const backLogin = $('[data-forgot-back-login]');
    const backStep = $('[data-forgot-back]');
    const destination = $('[data-forgot-destination]', form);
    const timerLabel = $('[data-otp-timer]', form);
    const otpError = $('[data-forgot-error="otp"]', form);
    const feedback = $('[data-auth-feedback]', form);

    if (!identityField || !passwordField || !confirmField || !sendButton || !verifyButton || !saveButton || otpDigits.length !== 6) {
      console.error('Elemen Lupa Password petugas tidak lengkap:', role);
      return;
    }

    const titles = {1: 'Pulihkan Password', 2: 'Verifikasi OTP', 3: 'Password Baru'};
    let currentStep = 1;
    let currentOtp = '';
    let otpExpiresAt = 0;
    let otpTimer = null;
    let matchedIdentity = '';
    let matchedEmail = '';
    let otpVerified = false;
    let isSubmitting = false;

    function showForgotFeedback(message, type = 'info') {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `auth-feedback auth-feedback--${type}`;
      feedback.hidden = false;
    }

    function clearForgotFeedback() {
      if (!feedback) return;
      feedback.textContent = '';
      feedback.hidden = true;
      feedback.className = 'auth-feedback';
    }

    function setForgotError(field, message) {
      const error = form.querySelector(`[data-error-for="${field.name}"]`);
      field.classList.toggle('form__input--error', Boolean(message));
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
    }

    function setOtpError(message) {
      if (otpError) {
        otpError.textContent = message;
        otpError.hidden = !message;
      }
      otpDigits.forEach(input => {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      });
    }

    function clearOtpInputs() {
      otpDigits.forEach(input => {
        input.value = '';
        input.removeAttribute('aria-invalid');
      });
      setOtpError('');
    }

    function showStep(step) {
      currentStep = step;
      steps.forEach(section => {
        const active = Number(section.dataset.forgotStep) === step;
        section.hidden = !active;
        section.classList.toggle('is-active', active);
      });
      progress.forEach(item => item.classList.toggle('is-active', Number(item.dataset.forgotProgress) <= step));
      if (title) title.textContent = titles[step];
      if (caption) caption.textContent = `Langkah ${step} dari 3`;
      if (backLogin) backLogin.hidden = step !== 1;
      if (backStep) {
        backStep.hidden = step === 1;
        backStep.dataset.targetStep = String(step - 1);
      }
      clearForgotFeedback();
    }

    function maskEmail(value) {
      const parts = value.split('@');
      if (parts.length !== 2) return value;
      const visible = parts[0].length > 2 ? parts[0].slice(0, 2) : parts[0].slice(0, 1);
      return `${visible}${'*'.repeat(Math.max(3, parts[0].length - visible.length))}@${parts[1]}`;
    }

    function findStaffAccount(value) {
      const accounts = getAccounts();
      const entered = String(value || '').trim();
      const isEmail = entered.includes('@');
      const account = accounts.find(item => {
        if (item.role !== role) return false;
        if (isEmail) return String(item.email || '').trim().toLowerCase() === entered.toLowerCase();
        return normalizeIdentity(item.identity) === normalizeIdentity(entered);
      });
      return account || null;
    }

    function createOtp() {
      if (!window.crypto?.getRandomValues) {
        throw new Error('Browser tidak mendukung generator kode aman. Jalankan melalui Live Server atau HTTPS.');
      }
      const random = new Uint32Array(1);
      window.crypto.getRandomValues(random);
      currentOtp = String(100000 + (random[0] % 900000));
      otpExpiresAt = Date.now() + 5 * 60 * 1000;
      otpVerified = false;
      clearOtpInputs();
      startOtpTimer();
    }

    function startOtpTimer() {
      if (otpTimer) window.clearInterval(otpTimer);
      const update = () => {
        const remaining = Math.max(0, otpExpiresAt - Date.now());
        const minutes = String(Math.floor(remaining / 60000)).padStart(2, '0');
        const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
        if (timerLabel) timerLabel.textContent = remaining > 0 ? `Kode berlaku ${minutes}:${seconds}` : 'Kode OTP kedaluwarsa';
        if (remaining <= 0 && otpTimer) {
          window.clearInterval(otpTimer);
          otpTimer = null;
        }
      };
      update();
      otpTimer = window.setInterval(update, 1000);
    }

    function sendOtp() {
      clearForgotFeedback();
      const entered = identityField.value.trim();
      if (!entered) {
        setForgotError(identityField, 'Email atau identitas akun wajib diisi.');
        identityField.focus();
        return;
      }
      if (entered.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entered)) {
        setForgotError(identityField, 'Format email tidak valid.');
        identityField.focus();
        return;
      }
      if (!entered.includes('@') && !/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(normalizeIdentity(entered))) {
        setForgotError(identityField, 'NIP atau kode akun tidak valid.');
        identityField.focus();
        return;
      }
      setForgotError(identityField, '');
      let account;
      try {
        account = findStaffAccount(entered);
      } catch (error) {
        showForgotFeedback(error.message || 'Data akun petugas tidak dapat dibaca.', 'error');
        return;
      }
      if (!account) {
        showForgotFeedback(
          entered.includes('@')
            ? `Email tidak ditemukan pada akun ${roleConfig.label}. Untuk akun lama tanpa email, gunakan NIP/kode akun.`
            : `NIP/kode akun tidak ditemukan pada akun ${roleConfig.label}.`,
          'error'
        );
        return;
      }

      matchedIdentity = normalizeIdentity(account.identity);
      matchedEmail = String(account.email || '').trim().toLowerCase();
      if (destination) {
        destination.textContent = matchedEmail
          ? maskEmail(matchedEmail)
          : `Akun ${roleConfig.label}: ${account.identityDisplay || account.identity}`;
      }
      try {
        createOtp();
        showStep(2);
        showForgotFeedback(`MODE SIMULASI — Kode OTP untuk pengujian: ${currentOtp}. Email belum benar-benar dikirim karena backend email belum tersedia.`, 'info');
        otpDigits[0].focus();
      } catch (error) {
        showForgotFeedback(error.message, 'error');
      }
    }

    function verifyOtp() {
      clearForgotFeedback();
      const enteredOtp = otpDigits.map(input => input.value.trim()).join('');
      if (enteredOtp.length !== 6 || !/^\d{6}$/.test(enteredOtp)) {
        setOtpError('Masukkan seluruh 6 digit kode OTP.');
        otpDigits.find(input => !input.value)?.focus();
        return;
      }
      if (!currentOtp || Date.now() > otpExpiresAt) {
        setOtpError('Kode OTP sudah kedaluwarsa. Silakan kirim ulang kode.');
        return;
      }
      if (enteredOtp !== currentOtp) {
        setOtpError('Kode OTP yang Anda masukkan tidak sesuai.');
        return;
      }
      setOtpError('');
      otpVerified = true;
      if (otpTimer) window.clearInterval(otpTimer);
      otpTimer = null;
      showStep(3);
      showForgotFeedback('Identitas akun berhasil diverifikasi. Silakan buat password baru.', 'info');
      passwordField.focus();
    }

    async function saveNewPassword() {
      if (isSubmitting) return;
      clearForgotFeedback();
      const password = passwordField.value;
      const confirmation = confirmField.value;
      let valid = true;

      if (password.length < 8) {
        setForgotError(passwordField, 'Password minimal 8 karakter.');
        valid = false;
      } else {
        setForgotError(passwordField, '');
      }
      if (!confirmation) {
        setForgotError(confirmField, 'Konfirmasi password wajib diisi.');
        valid = false;
      } else if (confirmation !== password) {
        setForgotError(confirmField, 'Konfirmasi password tidak sama.');
        valid = false;
      } else {
        setForgotError(confirmField, '');
      }
      if (!valid) {
        showForgotFeedback('Periksa kembali password baru Anda.', 'error');
        return;
      }
      if (!otpVerified || !matchedIdentity) {
        showForgotFeedback('Verifikasi OTP belum berhasil. Ulangi proses pemulihan password.', 'error');
        showStep(1);
        return;
      }

      isSubmitting = true;
      saveButton.disabled = true;
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Menyimpan...';
      try {
        const accounts = getAccounts();
        const index = accounts.findIndex(item => item.role === role && normalizeIdentity(item.identity) === matchedIdentity);
        if (index < 0) throw new Error('Akun tidak ditemukan. Silakan mulai ulang proses pemulihan.');
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        accounts[index] = {
          ...accounts[index],
          salt: toBase64(salt),
          passwordHash,
          passwordUpdatedAt: new Date().toISOString()
        };
        saveAccounts(accounts);
        showForgotFeedback('Password berhasil diperbarui. Anda akan diarahkan ke halaman login.', 'success');
        matchedIdentity = '';
        matchedEmail = '';
        currentOtp = '';
        otpVerified = false;
        window.setTimeout(() => {
          window.location.href = roleConfig.loginUrl;
        }, 1300);
      } catch (error) {
        console.error('Lupa Password petugas:', error);
        showForgotFeedback(error.message || 'Password gagal diperbarui.', 'error');
      } finally {
        isSubmitting = false;
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    }

    sendButton.addEventListener('click', sendOtp);
    verifyButton.addEventListener('click', verifyOtp);
    resendButton?.addEventListener('click', () => {
      if (!matchedIdentity) {
        showStep(1);
        return;
      }
      try {
        createOtp();
        showForgotFeedback(`MODE SIMULASI — Kode OTP baru: ${currentOtp}. Email belum benar-benar dikirim.`, 'info');
      } catch (error) {
        showForgotFeedback(error.message, 'error');
      }
    });
    saveButton.addEventListener('click', saveNewPassword);

    backStep?.addEventListener('click', () => {
      const target = Number(backStep.dataset.targetStep || currentStep - 1);
      if (target === 1) {
        matchedIdentity = '';
        matchedEmail = '';
        currentOtp = '';
        otpVerified = false;
        if (otpTimer) window.clearInterval(otpTimer);
        otpTimer = null;
      }
      showStep(target);
    });

    identityField.addEventListener('input', () => {
      setForgotError(identityField, '');
      clearForgotFeedback();
      if (matchedIdentity) {
        matchedIdentity = '';
        matchedEmail = '';
        currentOtp = '';
        otpVerified = false;
      }
    });

    passwordField.addEventListener('input', () => {
      if (passwordField.value.length >= 8) setForgotError(passwordField, '');
      if (confirmField.value && confirmField.value !== passwordField.value) {
        setForgotError(confirmField, 'Konfirmasi password tidak sama.');
      } else if (confirmField.value) {
        setForgotError(confirmField, '');
      }
    });
    confirmField.addEventListener('input', () => {
      setForgotError(confirmField, confirmField.value === passwordField.value ? '' : 'Konfirmasi password tidak sama.');
    });

    otpDigits.forEach((input, index) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        setOtpError('');
        if (input.value && otpDigits[index + 1]) otpDigits[index + 1].focus();
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Backspace' && !input.value && otpDigits[index - 1]) otpDigits[index - 1].focus();
      });
      input.addEventListener('paste', event => {
        const pasted = (event.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        event.preventDefault();
        pasted.split('').forEach((digit, digitIndex) => {
          if (otpDigits[digitIndex]) otpDigits[digitIndex].value = digit;
        });
        otpDigits[Math.min(pasted.length, 5)].focus();
        setOtpError('');
      });
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (currentStep === 1) sendOtp();
      else if (currentStep === 2) verifyOtp();
      else saveNewPassword();
    }, true);

    showStep(1);
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
    // Inisialisasi halaman lupa password.
    initializeForgotPassword();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
