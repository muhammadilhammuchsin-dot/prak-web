/* =====================================================
   PUSTAKAWAN - TAMBAH BUKU DAN STOK BERANDA

   Penyimpanan saat ini menggunakan IndexedDB browser.
   Data tetap tersedia setelah halaman dimuat ulang
   pada browser yang sama.

   Integrasi MySQL belum aktif karena endpoint backend
   dan skema SQL pada arsip proyek masih kosong.
   ===================================================== */

(() => {
  'use strict';

  // ===================================================
  // KONFIGURASI DATABASE BROWSER
  // ===================================================

  const DB_NAME = 'eperpus_pustakawan';
  const DB_VERSION = 1;
  const STORE_NAME = 'books';
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const objectUrls = new Set();

  // ===================================================
  // MEMBUKA DATABASE
  // ===================================================

  function openDatabase() {
    return new Promise((resolve, reject) => {

      if (!('indexedDB' in window)) {
        reject(
          new Error(
            'Browser ini tidak mendukung penyimpanan IndexedDB.'
          )
        );
        return;
      }

      const request = indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

      request.onupgradeneeded = () => {

        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {

          database.createObjectStore(STORE_NAME, {
            keyPath: 'id_buku'
          });

        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {

        reject(
          request.error ||
          new Error('Database browser gagal dibuka.')
        );

      };

    });
  }

  // ===================================================
  // OPERASI DATABASE
  // ===================================================

  function runStore(mode, operation) {

    return openDatabase().then(database => {

      return new Promise((resolve, reject) => {

        let result;

        const transaction = database.transaction(
          STORE_NAME,
          mode
        );

        const request = operation(
          transaction.objectStore(STORE_NAME)
        );

        request.onsuccess = () => {
          result = request.result;
        };

        request.onerror = () => {

          reject(
            request.error ||
            new Error('Operasi penyimpanan gagal.')
          );

        };

        transaction.oncomplete = () => {

          database.close();

          resolve(result);

        };

        transaction.onerror = () => {

          database.close();

          reject(
            transaction.error ||
            request.error ||
            new Error('Transaksi database gagal.')
          );

        };

        transaction.onabort = () => {

          database.close();

          reject(
            transaction.error ||
            request.error ||
            new Error('Transaksi database dibatalkan.')
          );

        };

      });

    });

  }

  // Mengambil seluruh data buku.
  function getAllBooks() {

    return runStore(
      'readonly',
      store => store.getAll()
    );

  }

  // Menambahkan buku baru.
  function addBook(book) {

    return runStore(
      'readwrite',
      store => store.add(book)
    );

  }

  // ===================================================
  // NOTIFIKASI FORM
  // ===================================================

  function showFeedback(
    message,
    type = 'success'
  ) {

    const feedback = $('#bookFeedback');

    if (!feedback) return;

    feedback.textContent = message;

    feedback.hidden = !message;

    feedback.className =
      `pb-feedback${message ? ` pb-feedback--${type}` : ''}`;

  }

  // ===================================================
  // PENGELOLAAN OBJECT URL GAMBAR
  // ===================================================

  function createObjectUrl(blob) {

    const url = URL.createObjectURL(blob);

    objectUrls.add(url);

    return url;

  }

  function revokeObjectUrl(url) {

    if (!url || !objectUrls.has(url)) return;

    URL.revokeObjectURL(url);

    objectUrls.delete(url);

  }

  // ===================================================
  // MENGHAPUS PREVIEW GAMBAR
  // ===================================================

  function clearImagePreview() {

    const preview = $('#coverPreview');

    const placeholder = $('#uploadPlaceholder');

    if (preview) {

      revokeObjectUrl(preview.dataset.objectUrl);

      preview.removeAttribute('src');

      delete preview.dataset.objectUrl;

      preview.hidden = true;

    }

    if (placeholder) {

      placeholder.hidden = false;

    }

  }

  // ===================================================
  // PREVIEW GAMBAR SAMPUL
  // ===================================================

  function initializeImagePreview() {

    const input = $('#gambar');

    const preview = $('#coverPreview');

    const placeholder = $('#uploadPlaceholder');

    if (!input || !preview || !placeholder) return;

    input.addEventListener('change', () => {

      const file = input.files?.[0];

      if (!file) {

        clearImagePreview();

        return;

      }

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      // Validasi format gambar.
      if (!allowedTypes.includes(file.type)) {

        input.value = '';

        clearImagePreview();

        showFeedback(
          'Format gambar harus JPG, PNG, atau WEBP.',
          'error'
        );

        return;

      }

      // Validasi ukuran gambar.
      if (file.size > MAX_IMAGE_SIZE) {

        input.value = '';

        clearImagePreview();

        showFeedback(
          'Ukuran gambar maksimal 5 MB.',
          'error'
        );

        return;

      }

      clearImagePreview();

      const url = createObjectUrl(file);

      preview.src = url;

      preview.dataset.objectUrl = url;

      preview.hidden = false;

      placeholder.hidden = true;

      showFeedback('');

    });

  }

  // ===================================================
  // VALIDASI FORM TAMBAH BUKU
  // ===================================================

  function validateBookForm(form) {

    const id =
      form.elements.id_buku.value.trim();

    const title =
      form.elements.judul.value.trim();

    const author =
      form.elements.penulis.value.trim();

    const category =
      form.elements.kategori.value;

    const stockValue =
      form.elements.stok.value.trim();

    // Memeriksa kolom wajib.
    if (
      !id ||
      !title ||
      !author ||
      !category ||
      stockValue === ''
    ) {

      showFeedback(
        'Lengkapi judul, ID buku, penulis, kategori, dan stok.',
        'error'
      );

      return false;

    }

    // Validasi ID buku.
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {

      showFeedback(
        'ID buku hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.',
        'error'
      );

      return false;

    }

    // Validasi stok.
    const stock = Number(stockValue);

    if (
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {

      showFeedback(
        'Stok harus berupa bilangan bulat nol atau lebih.',
        'error'
      );

      return false;

    }

    // Validasi gambar jika diunggah.
    const image =
      form.elements.gambar.files?.[0];

    if (image) {

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowedTypes.includes(image.type)) {

        showFeedback(
          'Format gambar harus JPG, PNG, atau WEBP.',
          'error'
        );

        return false;

      }

      if (image.size > MAX_IMAGE_SIZE) {

        showFeedback(
          'Ukuran gambar maksimal 5 MB.',
          'error'
        );

        return false;

      }

    }

    return true;

  }

  // ===================================================
  // MENYIMPAN BUKU
  // ===================================================

  async function saveBook(event) {

    event.preventDefault();

    const form = event.currentTarget;

    const button = $('#saveBookButton');

    if (!validateBookForm(form)) return;

    const image =
      form.elements.gambar.files?.[0] || null;

    // Membentuk objek buku.
    const book = {

      id_buku:
        form.elements.id_buku.value.trim(),

      judul:
        form.elements.judul.value.trim(),

      penulis:
        form.elements.penulis.value.trim(),

      kategori:
        form.elements.kategori.value,

      stok:
        Number(form.elements.stok.value),

      deskripsi:
        form.elements.deskripsi.value.trim(),

      gambar:
        image,

      created_at:
        new Date().toISOString()

    };

    try {

      button.disabled = true;

      button.textContent = 'Menyimpan...';

      showFeedback('');

      // Menyimpan data ke IndexedDB.
      await addBook(book);

      showFeedback(
        'Buku berhasil disimpan dan akan ditampilkan di Beranda.',
        'success'
      );

      // Mengosongkan form.
      form.reset();

      clearImagePreview();

      // Kembali ke Beranda.
      window.setTimeout(() => {

        window.location.href = 'beranda.html';

      }, 700);

    } catch (error) {

      console.error(
        'Gagal menyimpan buku:',
        error
      );

      // ID duplikat.
      if (error?.name === 'ConstraintError') {

        showFeedback(
          'ID buku sudah digunakan. Masukkan ID buku yang berbeda.',
          'error'
        );

      } else {

        showFeedback(
          error.message ||
          'Buku gagal disimpan. Periksa dukungan penyimpanan browser.',
          'error'
        );

      }

    } finally {

      if (button) {

        button.disabled = false;

        button.textContent = 'Simpan';

      }

    }

  }

  // ===================================================
  // MENGISI INFORMASI DETAIL BUKU
  // ===================================================

  function setDetailValue(id, value) {

    const element = document.getElementById(id);

    if (element) {

      element.textContent = value || '-';

    }

  }

  // ===================================================
  // MEMBUKA DETAIL BUKU
  // ===================================================

  function openBookDetail(button) {

    const dialog = $('#bookDetailDialog');

    if (!dialog) return;

    setDetailValue(
      'bookDetailTitle',
      button.dataset.bookTitle || 'Detail Buku'
    );

    setDetailValue(
      'bookDetailAuthor',
      button.dataset.bookAuthor
    );

    setDetailValue(
      'bookDetailCategory',
      button.dataset.bookCategory
    );

    setDetailValue(
      'bookDetailStock',
      button.dataset.bookStock
    );

    setDetailValue(
      'bookDetailDescription',
      button.dataset.bookDescription
    );

    if (typeof dialog.showModal === 'function') {

      dialog.showModal();

    }

  }

  // ===================================================
  // MEMBUAT KARTU BUKU DI BERANDA
  // ===================================================

  function createHomeBookCard(book) {

    const card = document.createElement('article');

    card.className = 'book-card book-card--added';

    // Sampul buku.
    const cover = document.createElement('figure');

    cover.className = 'cover cover--banner';

    if (book.gambar instanceof Blob) {

      const image = document.createElement('img');

      image.className = 'cover__image';

      image.src = createObjectUrl(book.gambar);

      image.alt = `Sampul buku ${book.judul}`;

      image.loading = 'lazy';

      cover.appendChild(image);

    } else {

      cover.classList.add('cover--placeholder');

      const caption = document.createElement('figcaption');

      caption.textContent = book.judul;

      cover.appendChild(caption);

    }

    // Judul buku.
    const title = document.createElement('h3');

    title.className = 'book-card__title';

    title.textContent = book.judul;

    // Stok buku.
    const stock = document.createElement('span');

    stock.className = 'badge';

    stock.textContent =
      `Stok tersedia ${book.stok} Eks`;

    // Tombol detail.
    const detailButton =
      document.createElement('button');

    detailButton.type = 'button';

    detailButton.className =
      'btn btn--navy btn--block btn--small';

    detailButton.dataset.bookDetail = '';

    detailButton.dataset.bookTitle =
      book.judul;

    detailButton.dataset.bookAuthor =
      book.penulis;

    detailButton.dataset.bookCategory =
      book.kategori;

    detailButton.dataset.bookStock =
      `${book.stok} eksemplar`;

    detailButton.dataset.bookDescription =
      book.deskripsi || 'Tidak ada deskripsi.';

    detailButton.textContent = 'Detail';

    // Memasukkan seluruh elemen ke kartu.
    card.append(
      cover,
      title,
      stock,
      detailButton
    );

    return card;

  }

  // ===================================================
  // MENAMPILKAN BUKU TERSIMPAN DI BERANDA
  // ===================================================

  async function renderHomeBooks() {

    const container =
      $('[data-home-book-list]');

    if (!container) return;

    try {

      const books = await getAllBooks();

      // Hanya menampilkan buku dengan stok positif.
      books
        .filter(book => Number(book.stok) > 0)

        // Buku terbaru ditampilkan lebih dahulu.
        .sort((a, b) =>
          String(b.created_at).localeCompare(
            String(a.created_at)
          )
        )

        // Membuat kartu untuk setiap buku.
        .forEach(book => {

          container.appendChild(
            createHomeBookCard(book)
          );

        });

    } catch (error) {

      console.error(
        'Gagal memuat buku tersimpan:',
        error
      );

      const feedback =
        document.createElement('p');

      feedback.className = 'pb-stock-empty';

      feedback.textContent =
        'Data buku tersimpan tidak dapat dimuat dari penyimpanan browser.';

      container.appendChild(feedback);

    }

  }

  // ===================================================
  // INISIALISASI
  // ===================================================

  document.addEventListener(
    'DOMContentLoaded',
    () => {

      const form = $('#bookForm');

      if (form) {

        initializeImagePreview();

        form.addEventListener(
          'submit',
          saveBook
        );

      }

      renderHomeBooks();

    }
  );

  // ===================================================
  // EVENT DETAIL BUKU
  // ===================================================

  document.addEventListener(
    'click',
    event => {

      const target = event.target;

      if (!(target instanceof Element)) return;

      const detailButton =
        target.closest('[data-book-detail]');

      if (detailButton) {

        openBookDetail(detailButton);

        return;

      }

      if (
        target.closest('[data-close-book-detail]')
      ) {

        $('#bookDetailDialog')?.close();

      }

    }
  );

  // ===================================================
  // MEMBERSIHKAN OBJECT URL
  // ===================================================

  window.addEventListener(
    'pagehide',
    () => {

      objectUrls.forEach(url => {

        URL.revokeObjectURL(url);

      });

      objectUrls.clear();

    }
  );

})();