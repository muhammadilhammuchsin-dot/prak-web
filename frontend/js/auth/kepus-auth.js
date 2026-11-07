
/* =========================================================
   KEPUS-AUTH.JS
   E-PERPUSTAKAAN UNIVERSITAS KHAIRUN

   KONSEP:
   - Tidak memiliki registrasi Kepus.
   - Menggunakan akun Pustakawan yang sudah terdaftar.
   - Menggunakan NIP/Kode Kepus + Password.
   - Email bersifat opsional.
   - Login berhasil menuju halaman laporan Kepus.
   - Sesi Kepus disimpan terpisah.
   - Logout menghapus sesi Kepus.

   MODE: FRONTEND TANPA DATABASE MYSQL.
   ========================================================= */

(() => {
  "use strict";

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  // Menggunakan penyimpanan akun Pustakawan.
  const ACCOUNT_KEY = "eperpus_pustakawan_accounts";

  // Sesi khusus Kepus.
  const SESSION_KEY = "eperpus_kepus_session";

  const FORM_SELECTOR = '[data-auth-form="login"]';

  // Harus sama dengan konfigurasi Pustakawan.
  const PASSWORD_ITERATIONS = 120000;

  // =======================================================
  // 2. NORMALISASI IDENTITAS
  // =======================================================

  function normalizeIdentity(value) {
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }

  // =======================================================
  // 3. MENGAMBIL DATA AKUN PUSTAKAWAN
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
  // 4. KONVERSI BYTE KE BASE64
  // =======================================================

  function toBase64(bytes) {
    let binary = "";

    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  // =======================================================
  // 5. KONVERSI BASE64 KE BYTE
  // =======================================================

  function fromBase64(value) {
    return Uint8Array.from(
      atob(value),
      character => character.charCodeAt(0)
    );
  }

  // =======================================================
  // 6. HASH PASSWORD
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
  // 7. MEMBANDINGKAN HASH PASSWORD
  // =======================================================

  function compareHash(first, second) {
    if (
      typeof first !== "string" ||
      typeof second !== "string"
    ) {
      return false;
    }

    if (first.length !== second.length) {
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
  // 8. MENAMPILKAN FEEDBACK
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
  // 9. VALIDASI INPUT
  // =======================================================

  function validateForm(form) {
    const identity = form.elements.namedItem("npm");
    const password = form.elements.namedItem("password");
    const email = form.elements.namedItem("email");

    let valid = true;

    // Validasi identitas.
    if (!identity.value.trim()) {
      showFeedback(
        form,
        "NIP/Kode Kepus wajib diisi.",
        "error"
      );

      identity.focus();
      return false;
    }

    const normalized = normalizeIdentity(identity.value);

    if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(normalized)) {
      showFeedback(
        form,
        "Format NIP/Kode Kepus tidak valid.",
        "error"
      );

      identity.focus();
      return false;
    }

    // Validasi password.
    if (!password.value) {
      showFeedback(
        form,
        "Password wajib diisi.",
        "error"
      );

      password.focus();
      return false;
    }

    // Email tidak wajib.
    // Jika diisi, formatnya harus benar.
    if (email && email.value.trim()) {
      if (email.validity.typeMismatch) {
        showFeedback(
          form,
          "Format email tidak valid.",
          "error"
        );

        email.focus();
        valid = false;
      }
    }

    return valid;
  }

  // =======================================================
  // 10. PROSES LOGIN KEPUS
  // =======================================================

  async function handleLogin(form) {
    const identity = normalizeIdentity(
      form.elements.namedItem("npm").value
    );

    const password = form.elements.namedItem("password").value;

    try {
      // Hapus sesi lama sebelum autentikasi baru.
      sessionStorage.removeItem(SESSION_KEY);

      // Ambil akun dari registrasi Pustakawan.
      const accounts = getAccounts();

      if (accounts.length === 0) {
        showFeedback(
          form,
          "Belum ada akun Pustakawan yang terdaftar. Silakan daftarkan akun terlebih dahulu.",
          "error"
        );

        return;
      }

      // Cari akun berdasarkan identitas.
      const account = accounts.find(
        item => normalizeIdentity(item.identity) === identity
      );

      if (!account) {
        showFeedback(
          form,
          "NIP/Kode Kepus belum terdaftar.",
          "error"
        );

        return;
      }

      // Pastikan data hash tersedia.
      if (!account.salt || !account.passwordHash) {
        throw new Error(
          "Data autentikasi akun tidak lengkap."
        );
      }

      // Verifikasi password menggunakan algoritma
      // yang sama dengan registrasi Pustakawan.
      const salt = fromBase64(account.salt);

      const inputHash = await hashPassword(
        password,
        salt
      );

      if (!compareHash(inputHash, account.passwordHash)) {
        showFeedback(
          form,
          "Password yang Anda masukkan salah.",
          "error"
        );

        return;
      }

      // Membuat sesi khusus Kepus.
      const session = {
        role: "kepus",
        identity: account.identity,
        nama: account.nama,
        loginAt: new Date().toISOString()
      };

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );

      showFeedback(
        form,
        "Login berhasil. Mengalihkan ke halaman laporan...",
        "info"
      );

      // Masuk ke halaman laporan Kepus.
      setTimeout(() => {
        window.location.href =
          "../../kepus/laporan.html";
      }, 700);

    } catch (error) {
      console.error("Login Kepus:", error);

      showFeedback(
        form,
        error.message || "Terjadi kesalahan saat login.",
        "error"
      );
    }
  }

  // =======================================================
  // 11. TAMPILKAN / SEMBUNYIKAN PASSWORD
  // =======================================================

  function togglePassword(button) {
    const field = document.getElementById(
      button.dataset.togglePassword
    );

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
  // 12. SUBMIT FORM
  // =======================================================

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    clearFeedback(form);

    if (!validateForm(form)) return;

    const button = form.querySelector(
      'button[type="submit"]'
    );

    const originalHTML = button?.innerHTML;

    if (button) {
      button.disabled = true;
      button.textContent = "Memproses...";
    }

    try {
      await handleLogin(form);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    }
  }

  // =======================================================
  // 13. PROTEKSI HALAMAN LAPORAN
  // =======================================================

  function protectKepusPage() {
    if (
      document.body.dataset.kepusProtected !== "true"
    ) {
      return;
    }

    let session = null;

    try {
      session = JSON.parse(
        sessionStorage.getItem(SESSION_KEY)
      );
    } catch (error) {
      session = null;
    }

    if (!session || session.role !== "kepus") {
      window.location.replace(
        "../auth/login/kepus.html"
      );
    }
  }

  // =======================================================
  // 14. LOGOUT
  // =======================================================

  function handleLogout(event) {
    const button = event.target.closest(
      "[data-kepus-logout]"
    );

    if (!button) return;

    event.preventDefault();

    sessionStorage.removeItem(SESSION_KEY);

    window.location.href =
      "../auth/login/kepus.html";
  }

  // =======================================================
  // 15. INISIALISASI
  // =======================================================

  function initializeAuth() {
    // Form login.
    document.querySelectorAll(FORM_SELECTOR).forEach(form => {
      form.addEventListener(
        "submit",
        handleFormSubmit
      );
    });

    // Tombol password dan logout.
    document.addEventListener("click", event => {
      const toggleButton = event.target.closest(
        "[data-toggle-password]"
      );

      if (toggleButton) {
        togglePassword(toggleButton);
      }

      handleLogout(event);
    });

    // Proteksi halaman laporan.
    protectKepusPage();
  }

  // =======================================================
  // 16. JALANKAN PROGRAM
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
