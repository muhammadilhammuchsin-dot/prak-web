
/* =========================================================
   ANGGOTA-AUTH.JS - E-PERPUSTAKAAN
   MODE: SIMULASI FRONTEND (TANPA DATABASE)
   FITUR:
   1. Registrasi anggota.
   2. Login menggunakan NPM dan password.
   3. Validasi seluruh input.
   4. Pemeriksaan NPM dan email duplikat.
   5. Hash password menggunakan PBKDF2.
   6. Tampilkan/sembunyikan password.
   7. Penyimpanan akun sementara di localStorage.
   8. Pengelolaan sesi sementara.
   9. Navigasi ke Beranda setelah login berhasil.
   10. Pemulihan password berdasarkan email.
   CATATAN:
   Ini hanya untuk pengujian frontend.
   Autentikasi produksi harus menggunakan backend.
   ========================================================= */
(() => {
  "use strict";
  // 1. KONFIGURASI
  const ACCOUNT_KEY = "eperpus_demo_accounts";
  const SESSION_KEY = "eperpus_demo_session";
  const FORM_SELECTOR = "form[data-auth-form]";
  const FIELD_SELECTOR = "input[name]";
  const NPM_PATTERN = /^[0-9]{8,20}$/;
  const PASSWORD_ITERATIONS = 120000;
  // 2. MENGAMBIL ELEMEN PESAN ERROR
  function getErrorElement(form, fieldName) {
    return Array.from(form.querySelectorAll("[data-error-for]")).find(element => element.dataset.errorFor === fieldName) || null;
  }
  // 3. MENAMPILKAN ERROR INPUT
  function setFieldError(form, field, message) {
    const error = getErrorElement(form, field.name);
    field.setAttribute("aria-invalid", "true");
    field.classList.add("form__input--error");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }
  // 4. MENGHAPUS ERROR INPUT
  function clearFieldError(form, field) {
    const error = getErrorElement(form, field.name);
    field.removeAttribute("aria-invalid");
    field.classList.remove("form__input--error");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }
  // 5. PESAN FEEDBACK
  function showFeedback(form, message, type = "info") {
    const feedback = form.querySelector("[data-auth-feedback]");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }
  function clearFeedback(form) {
    const feedback = form.querySelector("[data-auth-feedback]");
    if (!feedback) return;
    feedback.textContent = "";
    feedback.hidden = true;
  }
  // 6. VALIDASI INPUT
  function getValidationMessage(form, field) {
    const formType = form.dataset.authForm;
    const value = field.type === "password" ? field.value : field.value.trim();
    if (field.required && !value) return "Bagian ini wajib diisi.";
    if (!value) return "";
    if (field.name === "npm" && !NPM_PATTERN.test(value)) return "NPM harus terdiri dari 8 sampai 20 angka.";
    if (field.name === "nama" && (value.length < 3 || value.length > 100)) return "Nama harus terdiri dari 3 sampai 100 karakter.";
    if (field.name === "prodi" && (value.length < 2 || value.length > 100)) return "Nama program studi tidak valid.";
    if (field.name === "email") {
      if (field.validity.typeMismatch) return "Format email tidak valid.";
      if (value.length > 150) return "Email maksimal 150 karakter.";
    }
    if (field.name === "password" && formType === "register" && Array.from(value).length < 8) return "Password minimal 8 karakter.";
    if (field.name === "passwordConfirm" && formType === "register") {
      const password = form.elements.namedItem("password");
      if (password && value !== password.value) return "Konfirmasi password tidak sama.";
    }
    return "";
  }
  // 7. VALIDASI SATU INPUT
  function validateField(form, field) {
    const message = getValidationMessage(form, field);
    if (message) {
      setFieldError(form, field, message);
      return false;
    }
    clearFieldError(form, field);
    return true;
  }
  // 8. VALIDASI SELURUH FORM
  function validateForm(form) {
    const fields = Array.from(form.querySelectorAll(FIELD_SELECTOR));
    let valid = true;
    let firstInvalid = null;
    fields.forEach(field => {
      const result = validateField(form, field);
      if (!result) {
        valid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return valid;
  }
  // 9. MENGAMBIL DATA AKUN
  function getAccounts() {
    const data = localStorage.getItem(ACCOUNT_KEY);
    if (!data) return [];
    const accounts = JSON.parse(data);
    if (!Array.isArray(accounts)) throw new Error("Data akun tidak valid.");
    return accounts;
  }
  // 10. MENYIMPAN DATA AKUN
  function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
  }
  // 11. KONVERSI DATA BYTE KE BASE64
  function toBase64(bytes) {
    let binary = "";
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }
  function fromBase64(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  // 12. MEMBUAT HASH PASSWORD
  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) throw new Error("Web Crypto tidak tersedia. Jalankan melalui Live Server.");
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const hash = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: salt,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256"
    }, keyMaterial, 256);
    return toBase64(new Uint8Array(hash));
  }
  // 13. MEMBUAT SALT RANDOM
  function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }
  // 14. MEMBANDINGKAN HASH PASSWORD
  function compareHash(hash1, hash2) {
    if (hash1.length !== hash2.length) return false;
    let difference = 0;
    for (let i = 0; i < hash1.length; i++) difference |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
    return difference === 0;
  }
  // 15. MENAMPILKAN PASSWORD
  function togglePassword(button) {
    const fieldId = button.dataset.togglePassword;
    const field = document.getElementById(fieldId);
    if (!field) return;
    const visible = field.type === "password";
    field.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Sembunyikan password" : "Tampilkan password");
  }
  // 16. MEMERIKSA DUPLIKASI AKUN
  function checkDuplicateAccount(accounts, npm, email) {
    const duplicateNpm = accounts.some(account => account.npm === npm);
    const duplicateEmail = accounts.some(account => String(account.email || "").toLowerCase() === email.toLowerCase());
    if (duplicateNpm) return "NPM sudah terdaftar. Silakan login.";
    if (duplicateEmail) return "Email sudah digunakan oleh akun lain.";
    return "";
  }
  // 17. PROSES REGISTRASI
  async function handleRegistration(form) {
    const nama = form.elements.nama.value.trim();
    const npm = form.elements.npm.value.trim();
    const prodi = form.elements.prodi.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    try {
      const accounts = getAccounts();
      const duplicateMessage = checkDuplicateAccount(accounts, npm, email);
      if (duplicateMessage) {
        showFeedback(form, duplicateMessage, "error");
        return;
      }
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const newAccount = {
        nama,
        npm,
        prodi,
        email: email.toLowerCase(),
        salt: toBase64(salt),
        passwordHash,
        createdAt: new Date().toISOString()
      };
      accounts.push(newAccount);
      saveAccounts(accounts);
      showFeedback(form, "Pendaftaran berhasil. Silakan login menggunakan NPM dan password Anda.", "info");
      setTimeout(() => {
        window.location.href = "../login/anggota.html";
      }, 1200);
    } catch (error) {
      console.error("Registrasi gagal:", error);
      showFeedback(form, error.message || "Terjadi kesalahan saat pendaftaran.", "error");
    }
  }
  // 18. PROSES LOGIN
  async function handleLogin(form) {
    const npm = form.elements.npm.value.trim();
    const password = form.elements.password.value;
    try {
      const accounts = getAccounts();
      const account = accounts.find(item => item.npm === npm);
      if (!account) {
        showFeedback(form, "Akun belum terdaftar. Silakan daftar terlebih dahulu.", "error");
        return;
      }
      const salt = fromBase64(account.salt);
      const inputHash = await hashPassword(password, salt);
      const passwordValid = compareHash(inputHash, account.passwordHash);
      if (!passwordValid) {
        showFeedback(form, "Password yang Anda masukkan salah.", "error");
        return;
      }
      const session = {
        npm: account.npm,
        nama: account.nama,
        prodi: account.prodi,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      showFeedback(form, "Login berhasil. Mengalihkan ke halaman beranda...", "info");
      setTimeout(() => {
        window.location.href = "../../anggota/beranda.html";
      }, 700);
    } catch (error) {
      console.error("Login gagal:", error);
      showFeedback(form, error.message || "Terjadi kesalahan saat login.", "error");
    }
  }
  // 19. LUPA PASSWORD ANGGOTA — ALUR EMAIL > OTP > PASSWORD BARU
  // Mode proyek saat ini masih frontend/localStorage. OTP dibuat sebagai simulasi
  // dan ditampilkan di feedback agar alur dapat diuji tanpa layanan email.
  function initializeForgotPassword() {
    const form = document.querySelector('form[data-auth-form="forgot-password"][data-user-role="anggota"]');
    if (!form || form.dataset.forgotInitialized === "true") return;
    form.dataset.forgotInitialized = "true";

    const emailField = form.querySelector('[name="email"]');
    const passwordField = form.querySelector('[name="password"]');
    const confirmField = form.querySelector('[name="password-confirm"]');
    const sendButton = form.querySelector('[data-forgot-action="send-otp"]');
    const verifyButton = form.querySelector('[data-forgot-action="verify-otp"]');
    const resendButton = form.querySelector('[data-forgot-action="resend-otp"]');
    const saveButton = form.querySelector('[data-forgot-action="save-password"]');
    const otpDigits = [...form.querySelectorAll("[data-otp-digit]")];
    const steps = [...form.querySelectorAll("[data-forgot-step]")];
    const progress = [...form.querySelectorAll("[data-forgot-progress]")];
    const title = form.querySelector("[data-forgot-title]");
    const caption = form.querySelector("[data-forgot-caption]");
    const backLogin = document.querySelector("[data-forgot-back-login]");
    const backStep = document.querySelector("[data-forgot-back]");
    const destination = form.querySelector("[data-forgot-destination]");
    const timerLabel = form.querySelector("[data-otp-timer]");
    const otpError = form.querySelector('[data-forgot-error="otp"]');
    const feedback = form.querySelector("[data-auth-feedback]");

    if (!emailField || !passwordField || !confirmField || !sendButton || !verifyButton || !saveButton || otpDigits.length !== 6) {
      console.error("Elemen Lupa Password Anggota tidak lengkap.");
      return;
    }

    const titles = {1: "Pulihkan Password", 2: "Verifikasi OTP", 3: "Password Baru"};
    let currentStep = 1;
    let currentOtp = "";
    let otpExpiresAt = 0;
    let otpTimer = null;
    let verifiedEmail = "";
    let otpVerified = false;
    let isSubmitting = false;

    function showMessage(message, type = "info") {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `auth-feedback auth-feedback--${type}`;
      feedback.hidden = false;
    }

    function clearMessage() {
      if (!feedback) return;
      feedback.textContent = "";
      feedback.hidden = true;
      feedback.className = "auth-feedback";
    }

    function setFieldError(field, message) {
      const error = form.querySelector(`[data-error-for="${field.name}"]`);
      field.classList.toggle("form__input--error", Boolean(message));
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
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
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      });
    }

    function clearOtpInputs() {
      otpDigits.forEach(input => {
        input.value = "";
        input.removeAttribute("aria-invalid");
      });
      setOtpError("");
    }

    function showStep(step) {
      currentStep = step;
      steps.forEach(section => {
        const active = Number(section.dataset.forgotStep) === step;
        section.hidden = !active;
        section.classList.toggle("is-active", active);
      });
      progress.forEach(item => {
        item.classList.toggle("is-active", Number(item.dataset.forgotProgress) <= step);
      });
      if (title) title.textContent = titles[step];
      if (caption) caption.textContent = `Langkah ${step} dari 3`;
      if (backLogin) backLogin.hidden = step !== 1;
      if (backStep) {
        backStep.hidden = step === 1;
        backStep.dataset.targetStep = String(step - 1);
      }
      clearMessage();
    }

    function maskEmail(value) {
      const parts = value.split("@");
      if (parts.length !== 2) return value;
      const name = parts[0];
      const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
      return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${parts[1]}`;
    }

    function createOtp() {
      if (!window.crypto?.getRandomValues) {
        throw new Error("Browser tidak mendukung generator kode aman. Jalankan melalui Live Server atau HTTPS.");
      }
      const random = new Uint32Array(1);
      window.crypto.getRandomValues(random);
      currentOtp = String(100000 + (random[0] % 900000));
      otpVerified = false;
      otpExpiresAt = Date.now() + 5 * 60 * 1000;
      clearOtpInputs();
      startOtpTimer();
      showMessage(`MODE SIMULASI — Kode OTP untuk pengujian: ${currentOtp}. Kode belum dikirim melalui email karena layanan email belum terhubung.`, "info");
    }

    function startOtpTimer() {
      if (otpTimer) window.clearInterval(otpTimer);
      const update = () => {
        const remaining = Math.max(0, otpExpiresAt - Date.now());
        const minutes = String(Math.floor(remaining / 60000)).padStart(2, "0");
        const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
        if (timerLabel) timerLabel.textContent = remaining > 0 ? `Kode berlaku ${minutes}:${seconds}` : "Kode OTP kedaluwarsa";
        if (remaining <= 0 && otpTimer) {
          window.clearInterval(otpTimer);
          otpTimer = null;
        }
      };
      update();
      otpTimer = window.setInterval(update, 1000);
    }

    function sendOtp() {
      clearMessage();
      const email = emailField.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError(emailField, email ? "Format email tidak valid." : "Email wajib diisi.");
        emailField.focus();
        return;
      }
      setFieldError(emailField, "");
      let account;
      try {
        const accounts = getAccounts();
        account = accounts.find(item => String(item.email || "").trim().toLowerCase() === email);
      } catch (error) {
        showMessage(error.message || "Data akun anggota tidak dapat dibaca.", "error");
        return;
      }
      if (!account) {
        showMessage("Email tidak ditemukan pada akun anggota. Pastikan menggunakan email yang sama saat registrasi.", "error");
        return;
      }
      verifiedEmail = email;
      if (destination) destination.textContent = maskEmail(email);
      try {
        createOtp();
        showStep(2);
        if (destination) destination.textContent = maskEmail(email);
        // Tampilkan kode simulasi setelah berpindah ke layar OTP.
        showMessage(`MODE SIMULASI — Kode OTP: ${currentOtp}. Email belum benar-benar dikirim karena backend email belum tersedia.`, "info");
        otpDigits[0].focus();
      } catch (error) {
        showMessage(error.message, "error");
      }
    }

    function verifyOtp() {
      clearMessage();
      const enteredOtp = otpDigits.map(input => input.value.trim()).join("");
      if (enteredOtp.length !== 6 || !/^\d{6}$/.test(enteredOtp)) {
        setOtpError("Masukkan seluruh 6 digit kode OTP.");
        otpDigits.find(input => !input.value)?.focus();
        return;
      }
      if (!currentOtp || Date.now() > otpExpiresAt) {
        setOtpError("Kode OTP sudah kedaluwarsa. Silakan kirim ulang kode.");
        return;
      }
      if (enteredOtp !== currentOtp) {
        setOtpError("Kode OTP yang Anda masukkan tidak sesuai.");
        return;
      }
      setOtpError("");
      otpVerified = true;
      if (otpTimer) window.clearInterval(otpTimer);
      otpTimer = null;
      showStep(3);
      showMessage("Email berhasil diverifikasi. Silakan buat password baru.", "info");
      passwordField.focus();
    }

    async function saveNewPassword() {
      if (isSubmitting) return;
      clearMessage();
      const password = passwordField.value;
      const confirmation = confirmField.value;
      let valid = true;

      if (password.length < 8) {
        setFieldError(passwordField, "Password minimal 8 karakter.");
        valid = false;
      } else {
        setFieldError(passwordField, "");
      }
      if (!confirmation) {
        setFieldError(confirmField, "Konfirmasi password wajib diisi.");
        valid = false;
      } else if (confirmation !== password) {
        setFieldError(confirmField, "Konfirmasi password tidak sama.");
        valid = false;
      } else {
        setFieldError(confirmField, "");
      }
      if (!valid) {
        showMessage("Periksa kembali password baru Anda.", "error");
        return;
      }
      if (!verifiedEmail || !otpVerified) {
        showMessage("Verifikasi OTP tidak ditemukan atau sudah kedaluwarsa. Ulangi proses pemulihan password.", "error");
        showStep(1);
        return;
      }

      isSubmitting = true;
      saveButton.disabled = true;
      const originalText = saveButton.textContent;
      saveButton.textContent = "Menyimpan...";
      try {
        const accounts = getAccounts();
        const index = accounts.findIndex(item => String(item.email || "").trim().toLowerCase() === verifiedEmail);
        if (index < 0) throw new Error("Akun tidak ditemukan. Silakan mulai ulang proses pemulihan.");
        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        accounts[index] = {
          ...accounts[index],
          salt: toBase64(salt),
          passwordHash,
          passwordUpdatedAt: new Date().toISOString()
        };
        saveAccounts(accounts);
        showMessage("Password berhasil diperbarui. Anda akan diarahkan ke halaman login.", "success");
        currentOtp = "";
        verifiedEmail = "";
        otpVerified = false;
        window.setTimeout(() => {
          window.location.href = "../login/anggota.html";
        }, 1300);
      } catch (error) {
        console.error("Lupa Password Anggota:", error);
        showMessage(error.message || "Password gagal diperbarui.", "error");
      } finally {
        isSubmitting = false;
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    }

    sendButton.addEventListener("click", sendOtp);
    verifyButton.addEventListener("click", verifyOtp);
    resendButton?.addEventListener("click", () => {
      if (!verifiedEmail) {
        showStep(1);
        return;
      }
      try {
        createOtp();
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
    saveButton.addEventListener("click", saveNewPassword);

    backStep?.addEventListener("click", () => {
      const target = Number(backStep.dataset.targetStep || currentStep - 1);
      if (target === 1) {
        verifiedEmail = "";
        currentOtp = "";
        otpVerified = false;
        if (otpTimer) window.clearInterval(otpTimer);
        otpTimer = null;
      }
      showStep(target);
    });

    emailField.addEventListener("input", () => {
      setFieldError(emailField, "");
      clearMessage();
      if (verifiedEmail && emailField.value.trim().toLowerCase() !== verifiedEmail) {
        verifiedEmail = "";
        currentOtp = "";
        otpVerified = false;
      }
    });

    passwordField.addEventListener("input", () => {
      if (passwordField.value.length >= 8) setFieldError(passwordField, "");
      if (confirmField.value && confirmField.value !== passwordField.value) {
        setFieldError(confirmField, "Konfirmasi password tidak sama.");
      } else if (confirmField.value) {
        setFieldError(confirmField, "");
      }
    });
    confirmField.addEventListener("input", () => {
      setFieldError(confirmField, confirmField.value === passwordField.value ? "" : "Konfirmasi password tidak sama.");
    });

    otpDigits.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        setOtpError("");
        if (input.value && otpDigits[index + 1]) otpDigits[index + 1].focus();
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !input.value && otpDigits[index - 1]) otpDigits[index - 1].focus();
      });
      input.addEventListener("paste", event => {
        const pasted = (event.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;
        event.preventDefault();
        pasted.split("").forEach((digit, digitIndex) => {
          if (otpDigits[digitIndex]) otpDigits[digitIndex].value = digit;
        });
        otpDigits[Math.min(pasted.length, 5)].focus();
        setOtpError("");
      });
    });

    // Menangani tombol Enter sesuai tahap aktif tanpa menjalankan submit login/registrasi.
    form.addEventListener("submit", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (currentStep === 1) sendOtp();
      else if (currentStep === 2) verifyOtp();
      else saveNewPassword();
    }, true);

    showStep(1);
  }
  // 20. EVENT SUBMIT LOGIN DAN REGISTRASI
  async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFeedback(form);
    if (!validateForm(form)) {
      showFeedback(form, "Periksa kembali data yang Anda masukkan.", "error");
      return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Memproses...";
    }
    try {
      const formType = form.dataset.authForm;
      if (formType === "register") await handleRegistration(form);
      else if (formType === "login") await handleLogin(form);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }
  // 21. EVENT INPUT DAN CHANGE
  function handleFieldChange(event) {
    const field = event.target;
    const form = field.closest(FORM_SELECTOR);
    if (!form || !field.matches(FIELD_SELECTOR)) return;
    validateField(form, field);
    if (field.name === "password" && form.dataset.authForm === "register") {
      const confirmField = form.elements.namedItem("passwordConfirm");
      if (confirmField && confirmField.value) validateField(form, confirmField);
    }
    clearFeedback(form);
  }
  // 22. EVENT CLICK
  function handleDocumentClick(event) {
    const button = event.target.closest("[data-toggle-password]");
    if (button) togglePassword(button);
  }
  // 23. INISIALISASI
  function initializeAuth() {
    const forms = document.querySelectorAll(FORM_SELECTOR);
    forms.forEach(form => {
      form.addEventListener("submit", handleFormSubmit);
      form.addEventListener("input", handleFieldChange);
      form.addEventListener("change", handleFieldChange);
    });
    document.addEventListener("click", handleDocumentClick);
    initializeForgotPassword();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAuth);
  } else {
    initializeAuth();
  }
})();
