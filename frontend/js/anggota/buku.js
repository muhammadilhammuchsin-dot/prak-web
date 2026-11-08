
/* =========================================================
   E-PERPUSTAKAAN
   MODUL ANGGOTA: PENCARIAN DAN BOOKMARK BUKU

   Fitur:
   1. Pencarian berdasarkan judul buku.
   2. Pencarian berdasarkan nama penulis.
   3. Pencarian berdasarkan kategori.
   4. Pencarian berdasarkan ID buku.
   5. Menampilkan kembali seluruh buku jika pencarian kosong.
   6. Menambahkan dan menghapus bookmark.

   Penyimpanan bookmark menggunakan localStorage.
   ========================================================= */

(() => {
  'use strict';

  // Kunci penyimpanan bookmark.
  const BOOKMARK_KEY = 'eperpus_anggota_bookmarks';

  // Mengambil elemen HTML.
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Mengambil seluruh elemen HTML yang sesuai.
  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  // Mengambil input pencarian.
  const searchInput = $('#keyword');

  // Mengambil tombol pencarian.
  const searchButton = $('[data-action="search"]');

  // Mengambil seluruh kartu buku.
  function getBookCards() {
    return $$('.book-card').filter(card =>
      $('.book-card__title', card)
    );
  }

  // Mengubah teks menjadi format huruf kecil.
  function normalizeText(value) {
    return String(value || '')
      .toLocaleLowerCase('id')
      .trim();
  }

  // Mengambil ID buku dari nama file gambar.
  function getBookId(card) {
    // Memeriksa ID yang mungkin sudah tersedia pada HTML.
    if (card.dataset.bookId) {
      return card.dataset.bookId;
    }

    // Mengambil ID dari teks label sampul buku.
    const coverLabel = $('.cover__label', card);

    if (coverLabel) {
      const match = coverLabel.textContent.match(/\b\d+\b/);

      if (match) return match[0];
    }

    // Mengambil ID dari nama file gambar.
    const image = $('.cover__image', card);

    if (image) {
      const imagePath = image.getAttribute('src') || '';

      const match = imagePath.match(
        /\/(\d+)\.(jpg|jpeg|png|webp)(?:[?#]|$)/i
      );

      if (match) return match[1];
    }

    return '';
  }

  // Mengumpulkan seluruh informasi buku untuk pencarian.
  function getSearchableText(card) {
    const title = $('.book-card__title', card)?.textContent || '';
    const author = $('.book-card__author', card)?.textContent || '';
    const category = $('.tag', card)?.textContent || '';
    const bookId = getBookId(card);

    // Memasukkan teks alternatif gambar agar dapat dicari.
    const imageAlt = $('.cover__image', card)?.getAttribute('alt') || '';

    return normalizeText([
      title,
      author,
      category,
      bookId,
      imageAlt,
      card.textContent
    ].join(' '));
  }

  // Menampilkan atau menyembunyikan kartu buku.
  function setCardVisibility(card, isVisible) {
    card.hidden = !isVisible;

    // Memastikan CSS tidak membuat buku tersembunyi tetap terlihat.
    card.style.display = isVisible ? '' : 'none';
  }

  // Fungsi utama pencarian buku.
  function searchBooks(keyword) {
    const query = normalizeText(keyword);

    const cards = getBookCards();

    // Kata kunci kosong berarti tampilkan seluruh buku.
    if (!query) {
      cards.forEach(card => {
        setCardVisibility(card, true);
      });

      return;
    }

    // Memisahkan kata kunci berdasarkan spasi.
    const keywords = query.split(/\s+/);

    cards.forEach(card => {
      const searchableText = getSearchableText(card);

      // Semua kata kunci harus ditemukan pada informasi buku.
      const isMatch = keywords.every(keyword =>
        searchableText.includes(keyword)
      );

      setCardVisibility(card, isMatch);
    });
  }

  // Membaca data bookmark dari localStorage.
  function getBookmarks() {
    try {
      const data = localStorage.getItem(BOOKMARK_KEY);

      if (data === null) return null;

      const parsed = JSON.parse(data);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Gagal membaca bookmark:', error);
      return [];
    }
  }

  // Menyimpan bookmark ke localStorage.
  function saveBookmarks(bookmarks) {
    try {
      localStorage.setItem(
        BOOKMARK_KEY,
        JSON.stringify(bookmarks)
      );

      return true;
    } catch (error) {
      console.error('Gagal menyimpan bookmark:', error);

      window.EPerpus?.notify(
        'Bookmark gagal disimpan.',
        'error'
      );

      return false;
    }
  }

  // Memperbarui tampilan tombol bookmark.
  function updateBookmarkButton(button, isSaved) {
    button.classList.toggle(
      'book-card__bookmark--saved',
      isSaved
    );

    button.setAttribute(
      'aria-pressed',
      String(isSaved)
    );

    button.setAttribute(
      'aria-label',
      isSaved ? 'Hapus dari bookmark' : 'Simpan buku'
    );
  }

  // Menambahkan atau menghapus bookmark.
  function toggleBookmark(button) {
    const card = button.closest('.book-card');

    if (!card) return;

    const title = $('.book-card__title', card)
      ?.textContent.trim();

    if (!title) {
      window.EPerpus?.notify(
        'Judul buku tidak ditemukan.',
        'error'
      );

      return;
    }

    const bookmarks = getBookmarks() || [];

    const index = bookmarks.indexOf(title);

    // Jika belum disimpan, tambahkan bookmark.
    if (index === -1) {
      bookmarks.push(title);

      if (!saveBookmarks(bookmarks)) return;

      updateBookmarkButton(button, true);

      window.EPerpus?.notify(
        'Buku berhasil ditambahkan ke bookmark.'
      );

      return;
    }

    // Jika sudah disimpan, hapus bookmark.
    bookmarks.splice(index, 1);

    if (!saveBookmarks(bookmarks)) return;

    updateBookmarkButton(button, false);

    window.EPerpus?.notify(
      'Buku berhasil dihapus dari bookmark.'
    );
  }

  // Menginisialisasi status bookmark.
  function initializeBookmarks() {
    const cards = getBookCards();

    let bookmarks = getBookmarks();

    // Jika belum pernah menyimpan bookmark,
    // pertahankan status awal yang sudah ada di HTML.
    if (bookmarks === null) {
      bookmarks = cards
        .filter(card =>
          $('.book-card__bookmark', card)
            ?.classList.contains('book-card__bookmark--saved')
        )
        .map(card =>
          $('.book-card__title', card).textContent.trim()
        );

      saveBookmarks(bookmarks);
    }

    // Memperbarui seluruh tombol bookmark.
    cards.forEach(card => {
      const button = $('.book-card__bookmark', card);
      const title = $('.book-card__title', card)
        ?.textContent.trim();

      if (!button || !title) return;

      updateBookmarkButton(
        button,
        bookmarks.includes(title)
      );
    });
  }

  // Event input: pencarian berjalan ketika pengguna mengetik.
  document.addEventListener('input', event => {
    if (event.target === searchInput) {
      searchBooks(searchInput.value);
    }
  });

  // Event change: memperbarui hasil ketika nilai input berubah.
  document.addEventListener('change', event => {
    if (event.target === searchInput) {
      searchBooks(searchInput.value);
    }
  });

  // Event click: menjalankan pencarian melalui tombol Cari.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target
      : event.target.parentElement;

    if (!target) return;

    // Memeriksa tombol pencarian.
    const clickedSearchButton = target.closest(
      '[data-action="search"]'
    );

    if (clickedSearchButton) {
      searchBooks(searchInput?.value || '');
      return;
    }

    // Memeriksa tombol bookmark.
    const clickedBookmarkButton = target.closest(
      '[data-action="bookmark"]'
    );

    if (clickedBookmarkButton) {
      toggleBookmark(clickedBookmarkButton);
    }
  });

  // Event keydown: pencarian dapat dijalankan dengan Enter.
  document.addEventListener('keydown', event => {
    if (
      event.target === searchInput &&
      event.key === 'Enter'
    ) {
      event.preventDefault();

      searchBooks(searchInput.value);
    }
  });

  // Inisialisasi ketika halaman selesai dimuat.
  function initialize() {
    initializeBookmarks();

    // Memastikan seluruh buku terlihat pada awal halaman.
    searchBooks('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize
    );
  } else {
    initialize();
  }

})();
