
/* =========================================================
   PUSTAKAWAN-AUTH.JS
   E-PERPUSTAKAAN UNIVERSITAS KHAIRUN

   FITUR:
   1. Registrasi pustakawan.
   2. Login menggunakan NIP/Kode Kepus + Password.
   3. Email opsional saat login.
   4. Validasi seluruh input.
   5. Pemeriksaan akun duplikat.
   6. Hash password menggunakan PBKDF2.
   7. Tampilkan/sembunyikan password.
   8. Penyimpanan akun sementara.
   9. Pengelolaan sesi login.
   10. Navigasi ke beranda pustakawan.

   MODE: FRONTEND TANPA DATABASE MYSQL
   ========================================================= */

(() => {
  "use strict";

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const ACCOUNT_KEY = "eperpus_pustakawan_accounts";
  const SESSION_KEY = "eperpus_pustakawan_session";

  const FORM_SELECTOR = "[data-auth-form]";
  const PASSWORD_ITERATIONS = 120000;

  // =======================================================
  // 2. NORMALISASI NIP / KODE KEPUS
  // =======================================================

  function normalizeIdentity(value) {
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }

  // =======================================================
  // 3. MENGAMBIL DATA AKUN
  // =======================================================

  function getAccounts() {
    const data = localStorage.getItem(ACCOUNT_KEY);

    if (!data) return [];

    const accounts = JSON.parse(data);

    if (!Array.isArray(accounts)) {
      throw new Error("Data akun tidak valid.");
    }

    return accounts;
  }

  // =======================================================
  // 4. MENYIMPAN DATA AKUN
  // =======================================================

  function saveAccounts(accounts) {
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify(accounts)
    );
  }

  // =======================================================
  // 5. MENGAMBIL ELEMEN ERROR
  // =======================================================

  function getErrorElement(form, fieldName) {
    return Array.from(
      form.querySelectorAll("[data-error-for]")
    ).find(
      element => element.dataset.errorFor === fieldName
    ) || null;
  }

  // =======================================================
  // 6. MENAMPILKAN ERROR
  // =======================================================

  function setFieldError(form, field, message) {
    const error = getErrorElement(form, field.name);

    field.setAttribute("aria-invalid", "true");
    field.classList.add("form__input--error");

    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  // =======================================================
  // 7. MENGHAPUS ERROR
  // =======================================================

  function clearFieldError(form, field) {
    const error = getErrorElement(form, field.name);

    field.removeAttribute("aria-invalid");
    field.classList.remove("form__input--error");

    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  // =======================================================
  // 8. MENAMPILKAN PESAN FEEDBACK
  // =======================================================

  function showFeedback(form, message, type = "info") {
    const feedback = form.querySelector(
      "[data-auth-feedback]"
    );

    if (!feedback) return;

    feedback.textContent = message;
    feedback.className =
      `auth-feedback auth-feedback--${type}`;

    feedback.hidden = false;
  }

  // =======================================================
  // 9. MENGHAPUS PESAN FEEDBACK
  // =======================================================

  function clearFeedback(form) {
    const feedback = form.querySelector(
      "[data-auth-feedback]"
    );

    if (!feedback) return;

    feedback.textContent = "";
    feedback.hidden = true;
    feedback.className = "auth-feedback";
  }

  // =======================================================
  // 10. VALIDASI INPUT
  // =======================================================

  function getValidationMessage(form, field) {
    const formType = form.dataset.authForm;

    const value = field.type === "password"
      ? field.value
      : field.value.trim();

    // Validasi input wajib.
    if (field.required && !value) {
      return "Bagian ini wajib diisi.";
    }

    // Input opsional yang kosong tidak perlu divalidasi.
    if (!value) return "";

    // Validasi NIP / Kode Kepus.
    if (field.name === "npm") {
      const identity = normalizeIdentity(value);

      if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(identity)) {
        return "NIP atau Kode Kepus tidak valid.";
      }
    }

    // Validasi nama.
    if (field.name === "nama") {
      if (value.length < 3 || value.length > 100) {
        return "Nama harus terdiri dari 3 sampai 100 karakter.";
      }
    }

    // Validasi email.
    if (field.name === "email") {
      if (field.validity.typeMismatch) {
        return "Format email tidak valid.";
      }

      if (value.length > 150) {
        return "Email maksimal 150 karakter.";
      }
    }

    // Validasi password saat registrasi.
    if (
      field.name === "password" &&
      formType === "register"
    ) {
      if (Array.from(value).length < 8) {
        return "Password minimal 8 karakter.";
      }
    }

    // Validasi konfirmasi password.
    if (
      field.name === "password-confirm" &&
      formType === "register"
    ) {
      const password = form.elements.namedItem("password");

      if (password && value !== password.value) {
        return "Konfirmasi password tidak sama.";
      }
    }

    return "";
  }

  // =======================================================
  // 11. VALIDASI SATU INPUT
  // =======================================================

  function validateField(form, field) {
    const message = getValidationMessage(form, field);

    if (message) {
      setFieldError(form, field, message);
      return false;
    }

    clearFieldError(form, field);
    return true;
  }

  // =======================================================
  // 12. VALIDASI SELURUH FORM
  // =======================================================

  function validateForm(form) {
    const fields = Array.from(
      form.querySelectorAll("input[name]")
    );

    let isValid = true;
    let firstInvalidField = null;

    fields.forEach(field => {
      const valid = validateField(form, field);

      if (!valid) {
        isValid = false;

        if (!firstInvalidField) {
          firstInvalidField = field;
        }
      }
    });

    if (firstInvalidField) {
      firstInvalidField.focus();
    }

    return isValid;
  }

  // =======================================================
  // 13. KONVERSI BYTE KE BASE64
  // =======================================================

  function toBase64(bytes) {
    let binary = "";

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  // =======================================================
  // 14. KONVERSI BASE64 KE BYTE
  // =======================================================

  function fromBase64(value) {
    return Uint8Array.from(
      atob(value),
      character => character.charCodeAt(0)
    );
  }

  // =======================================================
  // 15. MEMBUAT SALT RANDOM
  // =======================================================

  function generateSalt() {
    return crypto.getRandomValues(
      new Uint8Array(16)
    );
  }

  // =======================================================
  // 16. HASH PASSWORD
  // =======================================================

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        "Web Crypto tidak tersedia. Jalankan menggunakan Live Server."
      );
    }

    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PASSWORD_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

    return toBase64(new Uint8Array(hash));
  }

  // =======================================================
  // 17. MEMBANDINGKAN HASH PASSWORD
  // =======================================================

  function compareHash(first, second) {
    if (first.length !== second.length) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < first.length; i++) {
      difference |= first.charCodeAt(i) ^
        second.charCodeAt(i);
    }

    return difference === 0;
  }

  // =======================================================
  // 18. MEMERIKSA AKUN DUPLIKAT
  // =======================================================

  function checkDuplicate(accounts, identity, email) {
    const duplicateIdentity = accounts.some(
      account => account.identity === identity
    );

    const duplicateEmail = accounts.some(
      account =>
        account.email.toLowerCase() === email.toLowerCase()
    );

    if (duplicateIdentity) {
      return "NIP atau Kode Kepus sudah terdaftar.";
    }

    if (duplicateEmail) {
      return "Email sudah digunakan oleh akun lain.";
    }

    return "";
  }

  // =======================================================
  // 19. REGISTRASI PUSTAKAWAN
  // =======================================================

  async function handleRegistration(form) {
    const nama = form.elements.nama.value.trim();

    const identity = normalizeIdentity(
      form.elements.npm.value
    );

    const email = form.elements.email.value
      .trim()
      .toLowerCase();

    const password = form.elements.password.value;

    try {
      // Mengambil akun yang sudah terdaftar.
      const accounts = getAccounts();

      // Memeriksa NIP dan email duplikat.
      const duplicateMessage = checkDuplicate(
        accounts,
        identity,
        email
      );

      if (duplicateMessage) {
        showFeedback(
          form,
          duplicateMessage,
          "error"
        );

        return;
      }

      // Membuat salt dan hash password.
      const salt = generateSalt();

      const passwordHash = await hashPassword(
        password,
        salt
      );

      // Membuat objek akun baru.
      const newAccount = {
        nama: nama,
        identity: identity,
        email: email,
        salt: toBase64(salt),
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      };

      // Menambahkan akun ke penyimpanan browser.
      accounts.push(newAccount);

      saveAccounts(accounts);

      // Menampilkan pesan berhasil.
      showFeedback(
        form,
        "Pendaftaran berhasil. Silakan login menggunakan NIP/Kode Kepus dan password.",
        "info"
      );

      // Mengarahkan pengguna ke halaman login.
      setTimeout(() => {
        window.location.href =
          "../login/pustakawan.html";
      }, 1200);

    } catch (error) {
      console.error("Registrasi gagal:", error);

      showFeedback(
        form,
        error.message || "Pendaftaran gagal.",
        "error"
      );
    }
  }

  // =======================================================
  // 20. LOGIN PUSTAKAWAN
  // =======================================================

  async function handleLogin(form) {
    const identity = normalizeIdentity(
      form.elements.npm.value
    );

    const password = form.elements.password.value;

    try {
      // Mengambil seluruh akun pustakawan.
      const accounts = getAccounts();

      // Mencari akun berdasarkan NIP/Kode Kepus.
      const account = accounts.find(
        item => item.identity === identity
      );

      // Jika akun tidak ditemukan.
      if (!account) {
        showFeedback(
          form,
          "NIP/Kode Kepus belum terdaftar. Silakan periksa kembali.",
          "error"
        );

        return;
      }

      // Mengambil salt akun.
      const salt = fromBase64(account.salt);

      // Menghitung hash password yang dimasukkan.
      const inputHash = await hashPassword(
        password,
        salt
      );

      // Memeriksa kecocokan password.
      const passwordValid = compareHash(
        inputHash,
        account.passwordHash
      );

      if (!passwordValid) {
        showFeedback(
          form,
          "Password yang Anda masukkan salah.",
          "error"
        );

        return;
      }

      // Membuat sesi login pustakawan.
      const session = {
        role: "pustakawan",
        identity: account.identity,
        nama: account.nama,
        email: account.email,
        loginAt: new Date().toISOString()
      };

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );

      // Menampilkan pesan berhasil.
      showFeedback(
        form,
        "Login berhasil. Mengalihkan ke beranda...",
        "info"
      );

      // Masuk ke Beranda Pustakawan.
      setTimeout(() => {
        window.location.href =
          "../../pustakawan/beranda.html";
      }, 700);

    } catch (error) {
      console.error("Login gagal:", error);

      showFeedback(
        form,
        error.message || "Terjadi kesalahan saat login.",
        "error"
      );
    }
  }

  // =======================================================
  // 21. TAMPILKAN / SEMBUNYIKAN PASSWORD
  // =======================================================

  function togglePassword(button) {
    const fieldId = button.dataset.togglePassword;

    const field = document.getElementById(fieldId);

    if (!field) return;

    const visible = field.type === "password";

    field.type = visible ? "text" : "password";

    button.setAttribute(
      "aria-pressed",
      String(visible)
    );

    button.setAttribute(
      "aria-label",
      visible
        ? "Sembunyikan password"
        : "Tampilkan password"
    );
  }

  // =======================================================
  // 22. EVENT SUBMIT
  // =======================================================

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    clearFeedback(form);

    // Validasi seluruh input.
    if (!validateForm(form)) {
      showFeedback(
        form,
        "Periksa kembali data yang Anda masukkan.",
        "error"
      );

      return;
    }

    const submitButton = form.querySelector(
      'button[type="submit"]'
    );

    const originalHTML = submitButton?.innerHTML;

    // Mencegah klik berulang.
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Memproses...";
    }

    try {
      if (form.dataset.authForm === "register") {
        await handleRegistration(form);
      } else if (form.dataset.authForm === "login") {
        await handleLogin(form);
      }

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalHTML;
      }
    }
  }

  // =======================================================
  // 23. EVENT INPUT DAN CHANGE
  // =======================================================

  function handleFieldChange(event) {
    const field = event.target;

    const form = field.closest(FORM_SELECTOR);

    if (!form || !field.matches("input[name]")) {
      return;
    }

    validateField(form, field);

    // Memeriksa ulang konfirmasi password.
    if (
      field.name === "password" &&
      form.dataset.authForm === "register"
    ) {
      const confirmField = form.elements.namedItem(
        "password-confirm"
      );

      if (confirmField && confirmField.value) {
        validateField(form, confirmField);
      }
    }

    clearFeedback(form);
  }

  // =======================================================
  // 24. EVENT CLICK
  // =======================================================

  function handleDocumentClick(event) {
    const button = event.target.closest(
      "[data-toggle-password]"
    );

    if (button) {
      togglePassword(button);
    }
  }

  // =======================================================
  // 25. INISIALISASI FORM
  // =======================================================

  function initializeAuth() {
    const forms = document.querySelectorAll(
      FORM_SELECTOR
    );

    forms.forEach(form => {
      form.addEventListener(
        "submit",
        handleFormSubmit
      );

      form.addEventListener(
        "input",
        handleFieldChange
      );

      form.addEventListener(
        "change",
        handleFieldChange
      );
    });

    document.addEventListener(
      "click",
      handleDocumentClick
    );
  }

  // =======================================================
  // 26. MENJALANKAN PROGRAM
  // =======================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeAuth
    );
  } else {
    initializeAuth();
  }

})();
