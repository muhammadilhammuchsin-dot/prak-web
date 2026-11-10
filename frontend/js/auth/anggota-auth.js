
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
  // 19. LUPA PASSWORD ANGGOTA
  // HTML asli menggunakan DIV dan tombol type=button, bukan form submit.
  function initializeForgotPassword() {
    const container = document.querySelector('[data-auth-form="forgot-password"][data-user-role="anggota"]');
    if (!container || container.dataset.forgotInitialized === "true") return;
    container.dataset.forgotInitialized = "true";
    const emailField = container.querySelector('[name="email"]');
    const passwordField = container.querySelector('[name="password"]');
    const confirmField = container.querySelector('[name="password-confirm"], [name="passwordConfirm"]');
    const otpField = container.querySelector('[name="otp"]');
    const saveButton = container.querySelector('[data-auth-action="forgot-password"]');
    if (!emailField || !passwordField || !confirmField || !saveButton) {
      console.error("Elemen Lupa Password Anggota tidak lengkap.");
      return;
    }
    let isSubmitting = false;
    let feedback = container.querySelector('[data-auth-feedback]');
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.className = "auth-feedback";
      feedback.dataset.authFeedback = "";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      feedback.hidden = true;
      saveButton.insertAdjacentElement("afterend", feedback);
    }
    function setForgotError(field, message) {
      const group = field.closest(".form__group") || field.parentElement;
      let error = group.querySelector(".form__error");
      if (!error) {
        error = document.createElement("p");
        error.className = "form__error";
        error.setAttribute("role", "alert");
        group.appendChild(error);
      }
      error.dataset.errorFor = field.name;
      error.textContent = message;
      error.hidden = !message;
      field.classList.toggle("form__input--error", Boolean(message));
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
    function showForgotFeedback(message, type = "info") {
      feedback.textContent = message;
      feedback.className = `auth-feedback auth-feedback--${type}`;
      feedback.hidden = false;
    }
    function clearForgotFeedback() {
      feedback.textContent = "";
      feedback.hidden = true;
    }
    function validateForgotField(field) {
      const value = field.value.trim();
      let message = "";
      if (!value) message = "Bagian ini wajib diisi.";
      else if (field === emailField && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "Format email tidak valid.";
      else if (field === passwordField && field.value.length < 8) message = "Password minimal 8 karakter.";
      else if (field === confirmField && field.value !== passwordField.value) message = "Konfirmasi password tidak sama.";
      setForgotError(field, message);
      return !message;
    }
    async function resetMemberPassword() {
      if (isSubmitting) return;
      clearForgotFeedback();
      const valid = [emailField, passwordField, confirmField].map(validateForgotField).every(Boolean);
      if (!valid) {
        showForgotFeedback("Periksa kembali data yang Anda masukkan.", "error");
        return;
      }
      isSubmitting = true;
      const originalText = saveButton.textContent;
      saveButton.disabled = true;
      saveButton.textContent = "Memproses...";
      try {
        const email = emailField.value.trim().toLowerCase();
        const accounts = getAccounts();
        const index = accounts.findIndex(account => String(account.email || "").trim().toLowerCase() === email);
        if (index < 0) {
          showForgotFeedback("Email tidak ditemukan pada akun anggota.", "error");
          return;
        }
        // OTP tidak diverifikasi karena layanan pengiriman OTP belum tersedia.
        // Password baru menggunakan fungsi hash yang sama dengan login.
        const salt = generateSalt();
        const passwordHash = await hashPassword(passwordField.value, salt);
        accounts[index] = {
          ...accounts[index],
          salt: toBase64(salt),
          passwordHash,
          passwordUpdatedAt: new Date().toISOString()
        };
        saveAccounts(accounts);
        emailField.value = "";
        passwordField.value = "";
        confirmField.value = "";
        if (otpField) otpField.value = "";
        [emailField, passwordField, confirmField].forEach(field => setForgotError(field, ""));
        showForgotFeedback("Password berhasil diperbarui. Silakan login kembali.", "success");
        window.setTimeout(() => {
          window.location.href = "../login/anggota.html";
        }, 1200);
      } catch (error) {
        console.error("Lupa password anggota:", error);
        showForgotFeedback(error.message || "Password gagal diperbarui.", "error");
      } finally {
        isSubmitting = false;
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    }
    [emailField, passwordField, confirmField].forEach(field => {
      ["input", "change"].forEach(eventName => {
        field.addEventListener(eventName, () => {
          validateForgotField(field);
          if (field === passwordField && confirmField.value) validateForgotField(confirmField);
          clearForgotFeedback();
        });
      });
      field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          resetMemberPassword();
        }
      });
      setForgotError(field, "");
    });
    saveButton.addEventListener("click", resetMemberPassword);
    // Ikon mata pada HTML asli menggunakan span .input-field__toggle.
    container.querySelectorAll(".input-field__toggle").forEach(toggle => {
      const input = toggle.closest(".input-field")?.querySelector("input[type='password'], input[type='text']");
      if (!input) return;
      toggle.setAttribute("role", "button");
      toggle.setAttribute("tabindex", "0");
      toggle.setAttribute("aria-label", "Tampilkan password");
      const changeVisibility = () => {
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        toggle.setAttribute("aria-pressed", String(visible));
        toggle.setAttribute("aria-label", visible ? "Sembunyikan password" : "Tampilkan password");
      };
      toggle.addEventListener("click", changeVisibility);
      toggle.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          changeVisibility();
        }
      });
    });
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
