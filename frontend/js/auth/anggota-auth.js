
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

   CATATAN:
   Ini hanya untuk pengujian frontend.
   Autentikasi produksi harus menggunakan backend.
   ========================================================= */

(() => {
  "use strict";

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const ACCOUNT_KEY = "eperpus_demo_accounts";
  const SESSION_KEY = "eperpus_demo_session";

  const FORM_SELECTOR = "[data-auth-form]";
  const FIELD_SELECTOR = "input[name]";

  const NPM_PATTERN = /^[0-9]{8,20}$/;
  const PASSWORD_ITERATIONS = 120000;

  // =======================================================
  // 2. MENGAMBIL ELEMEN PESAN ERROR
  // =======================================================

  function getErrorElement(form, fieldName) {
    return Array.from(
      form.querySelectorAll("[data-error-for]")
    ).find(
      element => element.dataset.errorFor === fieldName
    ) || null;
  }

  // =======================================================
  // 3. MENAMPILKAN ERROR INPUT
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
  // 4. MENGHAPUS ERROR INPUT
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
  // 5. PESAN FEEDBACK
  // =======================================================

  function showFeedback(form, message, type = "info") {
    const feedback = form.querySelector(
      "[data-auth-feedback]"
    );

    if (!feedback) return;

    feedback.textContent = message;
    feedback.className = `auth-feedback auth-feedback--${type}`;
    feedback.hidden = false;
  }

  function clearFeedback(form) {
    const feedback = form.querySelector(
      "[data-auth-feedback]"
    );

    if (!feedback) return;

    feedback.textContent = "";
    feedback.hidden = true;
  }

  // =======================================================
  // 6. VALIDASI INPUT
  // =======================================================

  function getValidationMessage(form, field) {
    const formType = form.dataset.authForm;
    const value = field.type === "password"
      ? field.value
      : field.value.trim();

    // Input wajib diisi.
    if (field.required && !value) {
      return "Bagian ini wajib diisi.";
    }

    // Input opsional yang kosong tidak perlu divalidasi.
    if (!value) return "";

    // Validasi NPM.
    if (field.name === "npm") {
      if (!NPM_PATTERN.test(value)) {
        return "NPM harus terdiri dari 8 sampai 20 angka.";
      }
    }

    // Validasi nama.
    if (field.name === "nama") {
      if (value.length < 3 || value.length > 100) {
        return "Nama harus terdiri dari 3 sampai 100 karakter.";
      }
    }

    // Validasi program studi.
    if (field.name === "prodi") {
      if (value.length < 2 || value.length > 100) {
        return "Nama program studi tidak valid.";
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

    // Validasi password registrasi.
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
      field.name === "passwordConfirm" &&
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
  // 7. VALIDASI SATU INPUT
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
  // 8. VALIDASI SELURUH FORM
  // =======================================================

  function validateForm(form) {
    const fields = Array.from(
      form.querySelectorAll(FIELD_SELECTOR)
    );

    let valid = true;
    let firstInvalid = null;

    fields.forEach(field => {
      const result = validateField(form, field);

      if (!result) {
        valid = false;

        if (!firstInvalid) {
          firstInvalid = field;
        }
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
    }

    return valid;
  }

  // =======================================================
  // 9. MENGAMBIL DATA AKUN
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
  // 10. MENYIMPAN DATA AKUN
  // =======================================================

  function saveAccounts(accounts) {
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify(accounts)
    );
  }

  // =======================================================
  // 11. KONVERSI DATA BYTE KE BASE64
  // =======================================================

  function toBase64(bytes) {
    let binary = "";

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(value);

    return Uint8Array.from(
      binary,
      character => character.charCodeAt(0)
    );
  }

  // =======================================================
  // 12. MEMBUAT HASH PASSWORD
  // =======================================================

  async function hashPassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        "Web Crypto tidak tersedia. Jalankan melalui Live Server."
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
  // 13. MEMBUAT SALT RANDOM
  // =======================================================

  function generateSalt() {
    const salt = crypto.getRandomValues(
      new Uint8Array(16)
    );

    return salt;
  }

  // =======================================================
  // 14. MEMBANDINGKAN HASH PASSWORD
  // =======================================================

  function compareHash(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < hash1.length; i++) {
      difference |= hash1.charCodeAt(i) ^
        hash2.charCodeAt(i);
    }

    return difference === 0;
  }

  // =======================================================
  // 15. MENAMPILKAN PASSWORD
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
  // 16. MEMERIKSA DUPLIKASI AKUN
  // =======================================================

  function checkDuplicateAccount(accounts, npm, email) {
    const duplicateNpm = accounts.some(
      account => account.npm === npm
    );

    const duplicateEmail = accounts.some(
      account => account.email.toLowerCase() ===
        email.toLowerCase()
    );

    if (duplicateNpm) {
      return "NPM sudah terdaftar. Silakan login.";
    }

    if (duplicateEmail) {
      return "Email sudah digunakan oleh akun lain.";
    }

    return "";
  }

  // =======================================================
  // 17. PROSES REGISTRASI
  // =======================================================

  async function handleRegistration(form) {
    const nama = form.elements.nama.value.trim();
    const npm = form.elements.npm.value.trim();
    const prodi = form.elements.prodi.value.trim();
    const email = form.elements.email.value.trim();

    const password = form.elements.password.value;

    try {
      // Ambil akun yang sudah terdaftar.
      const accounts = getAccounts();

      // Periksa NPM dan email duplikat.
      const duplicateMessage = checkDuplicateAccount(
        accounts,
        npm,
        email
      );

      if (duplicateMessage) {
        showFeedback(form, duplicateMessage, "error");
        return;
      }

      // Buat salt dan hash password.
      const salt = generateSalt();

      const passwordHash = await hashPassword(
        password,
        salt
      );

      // Susun data akun baru.
      const newAccount = {
        nama: nama,
        npm: npm,
        prodi: prodi,
        email: email.toLowerCase(),
        salt: toBase64(salt),
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      };

      // Simpan akun ke browser.
      accounts.push(newAccount);

      saveAccounts(accounts);

      // Tampilkan pemberitahuan berhasil.
      showFeedback(
        form,
        "Pendaftaran berhasil. Silakan login menggunakan NPM dan password Anda.",
        "info"
      );

      // Arahkan ke halaman login.
      setTimeout(() => {
        window.location.href = "../login/anggota.html";
      }, 1200);

    } catch (error) {
      console.error("Registrasi gagal:", error);

      showFeedback(
        form,
        error.message || "Terjadi kesalahan saat pendaftaran.",
        "error"
      );
    }
  }

  // =======================================================
  // 18. PROSES LOGIN
  // =======================================================

  async function handleLogin(form) {
    const npm = form.elements.npm.value.trim();

    const password = form.elements.password.value;

    try {
      // Ambil daftar akun.
      const accounts = getAccounts();

      // Cari akun berdasarkan NPM.
      const account = accounts.find(
        item => item.npm === npm
      );

      // Jika NPM belum terdaftar.
      if (!account) {
        showFeedback(
          form,
          "Akun belum terdaftar. Silakan daftar terlebih dahulu.",
          "error"
        );

        return;
      }

      // Hitung ulang hash password.
      const salt = fromBase64(account.salt);

      const inputHash = await hashPassword(
        password,
        salt
      );

      // Periksa kecocokan password.
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

      // Buat sesi sementara.
      const session = {
        npm: account.npm,
        nama: account.nama,
        prodi: account.prodi,
        loginAt: new Date().toISOString()
      };

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );

      // Tampilkan pesan berhasil.
      showFeedback(
        form,
        "Login berhasil. Mengalihkan ke halaman beranda...",
        "info"
      );

      // Masuk ke Beranda Anggota.
      setTimeout(() => {
        window.location.href =
          "../../anggota/beranda.html";
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
  // 19. EVENT SUBMIT
  // =======================================================

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    clearFeedback(form);

    // Periksa seluruh input.
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

    const originalText = submitButton?.textContent;

    // Cegah klik berulang selama proses.
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Memproses...";
    }

    try {
      const formType = form.dataset.authForm;

      if (formType === "register") {
        await handleRegistration(form);
      } else if (formType === "login") {
        await handleLogin(form);
      }

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  // =======================================================
  // 20. EVENT INPUT DAN CHANGE
  // =======================================================

  function handleFieldChange(event) {
    const field = event.target;

    const form = field.closest(FORM_SELECTOR);

    if (!form || !field.matches(FIELD_SELECTOR)) {
      return;
    }

    validateField(form, field);

    // Validasi ulang konfirmasi jika password berubah.
    if (
      field.name === "password" &&
      form.dataset.authForm === "register"
    ) {
      const confirmField = form.elements.namedItem(
        "passwordConfirm"
      );

      if (confirmField && confirmField.value) {
        validateField(form, confirmField);
      }
    }

    clearFeedback(form);
  }

  // =======================================================
  // 21. EVENT CLICK
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
  // 22. INISIALISASI FORM
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
  // 23. MENJALANKAN PROGRAM
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
