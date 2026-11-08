/* =====================================================
   E-PERPUSTAKAAN
   PENGELOLAAN BUKU PUSTAKAWAN

   Fungsi:
   1. Menambahkan buku melalui API backend.
   2. Mengirim data ke database MySQL melalui backend.
   3. Validasi ID dan stok.
   4. Preview sampul buku.
   5. Menampilkan buku pada Beranda.
   ===================================================== */

(() => {
  'use strict';

  // ===================================================
  // KONFIGURASI API
  // ===================================================

  // Jika frontend dan backend menggunakan origin yang sama:
  const API_BASE = '/api/buku';

  // Jika backend berjalan pada port 3000 dan frontend
  // menggunakan Live Server, gunakan:
  // const API_BASE = 'http://localhost:3000/api/buku';

  // ===================================================
  // HELPER
  // ===================================================

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message ||
        result.error ||
        `Permintaan gagal (${response.status}).`
      );
    }

    return result;
  }

  function extractBooks(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.books)) return result.books;

    return [];
  }

  function getBookId(book) {
    return String(
      book.id_buku ??
      book.id ??
      book.kode_buku ??
      ''
    );
  }

  function getBookTitle(book) {
    return String(
      book.judul ??
      book.judul_buku ??
      book.title ??
      'Tanpa judul'
    );
  }

  function getBookStock(book) {
    return Number(
      book.stok ??
      book.stok_tersedia ??
      book.stock ??
      0
    );
  }

  function getBookCover(book) {
    return (
      book.gambar_url ||
      book.cover_url ||
      book.gambar ||
      book.cover ||
      ''
    );
  }

  function showFeedback(message, type = 'success') {
    const feedback = $('#bookFeedback');

    if (!feedback) return;

    feedback.textContent = message;

    feedback.className = `pb-feedback pb-feedback--${type}`;
  }

  // ===================================================
  // PREVIEW GAMBAR
  // ===================================================

  function initializeImagePreview() {
    const input = $('#gambar');
    const preview = $('#coverPreview');
    const placeholder = $('#uploadPlaceholder');

    if (!input || !preview || !placeholder) return;

    let currentObjectUrl = null;

    input.addEventListener('change', () => {
      const file = input.files?.[0];

      if (!file) return;

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowedTypes.includes(file.type)) {
        input.value = '';

        showFeedback(
          'Format gambar harus JPG, PNG, atau WEBP.',
          'error'
        );

        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        input.value = '';

        showFeedback(
          'Ukuran gambar maksimal 5 MB.',
          'error'
        );

        return;
      }

      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }

      currentObjectUrl = URL.createObjectURL(file);

      preview.src = currentObjectUrl;
      preview.hidden = false;
      placeholder.hidden = true;

      showFeedback('');
    });
  }

  // ===================================================
  // VALIDASI FORM
  // ===================================================

  function validateBookForm(form) {
    const id = form.elements.id_buku.value.trim();
    const title = form.elements.judul.value.trim();
    const author = form.elements.penulis.value.trim();
    const category = form.elements.kategori.value;
    const stock = form.elements.stok.value;

    if (!title || !id || !author || !category || stock === '') {
      showFeedback(
        'Semua kolom wajib harus diisi.',
        'error'
      );

      return false;
    }

    if (!/^\d+$/.test(stock)) {
      showFeedback(
        'Stok harus berupa bilangan bulat nonnegatif.',
        'error'
      );

      return false;
    }

    if (!Number.isSafeInteger(Number(stock))) {
      showFeedback(
        'Jumlah stok tidak valid.',
        'error'
      );

      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      showFeedback(
        'ID buku hanya boleh menggunakan huruf, angka, tanda hubung, dan garis bawah.',
        'error'
      );

      return false;
    }

    return true;
  }

  // ===================================================
  // TAMBAH BUKU
  // ===================================================

  async function saveBook(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = $('#saveBookButton');

    if (!validateBookForm(form)) return;

    const image = form.elements.gambar.files?.[0];

    if (!image) {
      showFeedback(
        'Silakan unggah gambar sampul buku.',
        'error'
      );

      return;
    }

    const formData = new FormData();

    formData.append(
      'id_buku',
      form.elements.id_buku.value.trim()
    );

    formData.append(
      'judul',
      form.elements.judul.value.trim()
    );

    formData.append(
      'penulis',
      form.elements.penulis.value.trim()
    );

    formData.append(
      'kategori',
      form.elements.kategori.value
    );

    formData.append(
      'stok',
      String(Number(form.elements.stok.value))
    );

    formData.append(
      'deskripsi',
      form.elements.deskripsi.value.trim()
    );

    formData.append('gambar', image);

    try {
      button.disabled = true;
      button.textContent = 'Menyimpan...';

      await apiRequest(API_BASE, {
        method: 'POST',
        body: formData
      });

      showFeedback(
        'Buku berhasil ditambahkan.',
        'success'
      );

      form.reset();

      const preview = $('#coverPreview');
      const placeholder = $('#uploadPlaceholder');

      preview.hidden = true;
      preview.removeAttribute('src');

      placeholder.hidden = false;

      // Kembali ke halaman Data Buku.
      // Buku akan dimuat pada Beranda dari database.
      setTimeout(() => {
        window.location.href = 'data-buku.html';
      }, 700);

    } catch (error) {
      console.error('Gagal menambahkan buku:', error);

      showFeedback(
        error.message || 'Buku gagal disimpan.',
        'error'
      );

    } finally {
      button.disabled = false;
      button.textContent = 'Simpan';
    }
  }

  // ===================================================
  // MEMUAT DATA BUKU DARI BACKEND
  // ===================================================

  async function loadBooks() {
    const result = await apiRequest(API_BASE, {
      method: 'GET'
    });

    return extractBooks(result);
  }

  // ===================================================
  // MEMBUAT KARTU BUKU PADA BERANDA
  // ===================================================

  function createBookCard(book) {
    const card = document.createElement('article');

    card.className = 'pb-stock-card';

    // Sampul.
    const cover = document.createElement('div');

    cover.className = 'pb-stock-cover';

    const imageUrl = getBookCover(book);

    if (imageUrl) {
      const image = document.createElement('img');

      image.src = imageUrl;
      image.alt = `Sampul ${getBookTitle(book)}`;
      image.loading = 'lazy';

      cover.appendChild(image);

    } else {
      const placeholder = document.createElement('div');

      placeholder.className = 'pb-stock-placeholder';
      placeholder.textContent = getBookTitle(book);

      cover.appendChild(placeholder);
    }

    // Judul.
    const title = document.createElement('h3');

    title.className = 'pb-stock-title';
    title.textContent = getBookTitle(book);

    // Stok.
    const quantity = document.createElement('span');

    quantity.className = 'pb-stock-quantity';
    quantity.textContent = `Stok tersedia ${getBookStock(book)} Eks`;

    // Kartu.
    card.append(
      cover,
      title,
      quantity
    );

    return card;
  }

  // ===================================================
  // MENAMPILKAN STOK PADA BERANDA
  // ===================================================

  async function renderHomeBooks() {
    const container = $('[data-stok-buku]');

    if (!container) return;

    container.setAttribute('aria-live', 'polite');

    container.innerHTML = '';

    try {
      const books = await loadBooks();

      // Hanya buku dengan stok lebih dari nol.
      const availableBooks = books.filter(book =>
        getBookStock(book) > 0
      );

      if (availableBooks.length === 0) {
        const empty = document.createElement('p');

        empty.className = 'pb-stock-empty';

        empty.textContent =
          'Belum ada buku dengan stok tersedia.';

        container.appendChild(empty);

        return;
      }

      availableBooks.forEach(book => {
        container.appendChild(
          createBookCard(book)
        );
      });

    } catch (error) {
      console.error('Gagal memuat stok buku:', error);

      const message = document.createElement('p');

      message.className = 'pb-stock-empty';

      message.textContent =
        'Data buku gagal dimuat. Periksa koneksi server.';

      container.appendChild(message);
    }
  }

  // ===================================================
  // INISIALISASI
  // ===================================================

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#bookForm');

    if (form) {
      initializeImagePreview();

      form.addEventListener('submit', saveBook);
    }

    renderHomeBooks();
  });

})();