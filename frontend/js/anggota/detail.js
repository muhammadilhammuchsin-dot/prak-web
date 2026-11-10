/* E-PERPUSTAKAAN: DETAIL BUKU ANGGOTA.
   Mengambil buku dari katalog HTML dan IndexedDB pustakawan.
   Buku admin memakai kolom id_buku, judul, penulis, kategori, stok, deskripsi, gambar.
   Kategori dan ID dikirim ke transaksi agar aktivitas masuk ke profil KNN. */
(() => {
  'use strict';
  const DB_NAME = 'eperpus_pustakawan';
  const DB_VERSION = 1;
  const STORE_NAME = 'books';
  const CATEGORY_PAGES = [
    { key: 'informatika', label: 'Informatika & Komputer', file: 'cari-informatika.html' },
    { key: 'sains', label: 'Sains & Matematika', file: 'cari-sains.html' },
    { key: 'sosial', label: 'Sosial & Bisnis', file: 'cari-sosial.html' },
    { key: 'sastra', label: 'Sastra & Bahasa', file: 'cari-sastra.html' }
  ];
  const FALLBACKS = {
    '0001': {
      stock: 4,
      description: 'Landasan teoretis dan penerapan struktur data: Linear Lists, Stack, Trees, B-Tree, Heap, hingga Graph, lengkap dengan kompleksitas Big-O.',
      borrowExtra: '(12 kali oleh Informatika)'
    }
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const objectUrls = [];

  // Menyamakan teks dan kategori.
  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('id').replace(/\s+/g, ' ').trim();
  }
  function mapCategory(value) {
    const text = normalizeText(value);
    if (text.includes('informatika') || text.includes('komputer') || text.includes('sistem informasi')) return 'informatika';
    if (text.includes('sains') || text.includes('matematika')) return 'sains';
    if (text.includes('sosial') || text.includes('bisnis')) return 'sosial';
    if (text.includes('sastra') || text.includes('bahasa')) return 'sastra';
    return '';
  }
  function getCategoryLabel(key) {
    return CATEGORY_PAGES.find(item => item.key === key)?.label || 'Kategori lainnya';
  }

  // Membaca semua buku admin dari IndexedDB yang dipakai form tambah buku.
  function getAdminBooks() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve([]);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id_buku' });
      };
      request.onerror = () => reject(request.error || new Error('IndexedDB gagal dibuka.'));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const requestAll = tx.objectStore(STORE_NAME).getAll();
        requestAll.onsuccess = () => resolve(Array.isArray(requestAll.result) ? requestAll.result : []);
        requestAll.onerror = () => reject(requestAll.error || new Error('Data buku admin gagal dibaca.'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    });
  }

  // Mengubah record admin ke format detail buku.
  function normalizeAdminBook(record) {
    const id = String(record.id_buku || '').trim();
    const title = String(record.judul || '').trim();
    const key = mapCategory(record.kategori);
    if (!id || !title || !key) return null;
    let image = '';
    if (record.gambar instanceof Blob && record.gambar.size) {
      image = URL.createObjectURL(record.gambar);
      objectUrls.push(image);
    } else if (typeof record.gambar === 'string') {
      image = record.gambar;
    }
    const stock = Number(record.stok);
    return {
      id,
      title,
      author: String(record.penulis || '').trim() || 'Data penulis belum tersedia',
      category: String(record.kategori || getCategoryLabel(key)),
      categoryKey: key,
      image,
      imageAlt: `Sampul ${title}`,
      description: String(record.deskripsi || '').trim(),
      stock: Number.isFinite(stock) ? stock : null,
      borrowCount: null,
      source: 'indexeddb'
    };
  }

  // Mengambil ID buku dari kartu katalog statis.
  function getStaticBookId(card) {
    const label = card.querySelector('.cover__label')?.textContent || '';
    const labelMatch = label.match(/ID\s*:\s*([\w-]+)/i);
    if (labelMatch) return labelMatch[1];
    const imagePath = card.querySelector('.cover__image')?.getAttribute('src') || '';
    const imageMatch = imagePath.match(/(?:^|\/)([\w-]+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i);
    return card.dataset.bookId || imageMatch?.[1] || '';
  }

  // Mengambil metadata buku dari halaman kategori HTML.
  function parseStaticCard(card, category, pageUrl) {
    const title = card.querySelector('.book-card__title')?.textContent.replace(/\s+/g, ' ').trim() || '';
    if (!title) return null;
    const imageElement = card.querySelector('.cover__image');
    const imagePath = imageElement?.getAttribute('src') || '';
    let image = '';
    try {
      if (imagePath) image = new URL(imagePath, pageUrl).href;
    } catch (_) {}
    const badge = card.querySelector('.badge')?.textContent || '';
    const borrowMatch = badge.match(/(\d+)\s*x/i);
    return {
      id: getStaticBookId(card),
      title,
      author: card.querySelector('.book-card__author')?.textContent.trim() || 'Data penulis belum tersedia',
      category: card.querySelector('.tag')?.textContent.trim() || category.label,
      categoryKey: category.key,
      image,
      imageAlt: imageElement?.alt || `Sampul ${title}`,
      description: card.querySelector('.book-card__text, .book-card__description, [data-book-description]')?.textContent.trim() || '',
      stock: null,
      borrowCount: borrowMatch ? Number(borrowMatch[1]) : null,
      source: 'html'
    };
  }

  // Menggabungkan katalog statis dan buku yang dimasukkan admin.
  async function loadCatalog() {
    const pages = await Promise.allSettled(CATEGORY_PAGES.map(async category => {
      const url = new URL(category.file, window.location.href);
      const response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${category.file}: HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return [...doc.querySelectorAll('.book-grid .book-card')]
        .map(card => parseStaticCard(card, category, url))
        .filter(Boolean);
    }));
    const books = new Map();
    pages.forEach(result => {
      if (result.status === 'fulfilled') {
        result.value.forEach(book => {
          if (book.id && !books.has(book.id)) books.set(book.id, book);
        });
      } else {
        console.warn('Salah satu halaman katalog statis gagal dimuat:', result.reason);
      }
    });
    const adminBooks = await getAdminBooks().catch(error => {
      console.warn('Data buku admin tidak dapat dibaca:', error);
      return [];
    });
    adminBooks.map(normalizeAdminBook).filter(Boolean).forEach(book => {
      if (books.has(book.id)) {
        console.warn(`ID ${book.id} sudah dipakai katalog statis; record admin dilewati untuk mencegah ID ganda.`);
      } else {
        books.set(book.id, book);
      }
    });
    return [...books.values()];
  }

  // Mengambil jumlah peminjaman historis untuk statistik buku.
  function getBorrowCount(bookId) {
    try {
      const records = JSON.parse(localStorage.getItem('eperpus_demo_transactions') || '[]');
      if (!Array.isArray(records)) return null;
      return records.filter(item =>
        String(item.bookId || '') === String(bookId) &&
        !['batal', 'dibatalkan', 'cancelled'].includes(normalizeText(item.status))
      ).length;
    } catch (_) {
      return null;
    }
  }

  // Menampilkan informasi buku dan mengirim kategori ke modul transaksi.
  function renderBook(book) {
    $('[data-book-title]').textContent = book.title;
    $('[data-book-id]').textContent = book.id;
    $('[data-book-author]').textContent = book.author;
    $('[data-book-category]').textContent = book.category;
    const image = $('[data-book-image]');
    if (book.image) {
      image.src = book.image;
      image.alt = book.imageAlt;
      image.hidden = false;
    } else {
      image.hidden = true;
    }
    const fallback = FALLBACKS[book.id] || {};
    const stock = book.stock ?? fallback.stock ?? null;
    $('[data-book-stock]').textContent = stock === null ? 'Belum tersedia' : String(stock);
    $('[data-book-description]').textContent = book.description || fallback.description || 'Deskripsi buku belum tersedia.';
    const count = book.borrowCount ?? getBorrowCount(book.id);
    $('[data-book-borrow-count]').textContent = count === null ? 'Data peminjaman belum tersedia' : `Dipinjam ${count}x`;
    $('[data-book-borrow-extra]').textContent = fallback.borrowExtra || '';
    const button = $('[data-action="borrow"]');
    button.dataset.bookId = book.id;
    button.dataset.bookTitle = book.title;
    button.dataset.bookCategoryKey = book.categoryKey;
    button.dataset.bookSource = book.source || 'html';
    button.dataset.bookStock = stock === null ? '' : String(stock);
    button.disabled = stock !== null && stock <= 0;
    if (stock !== null && stock <= 0) button.textContent = 'Stok Buku Habis';
    document.title = `${book.title} - E-Perpustakaan`;
    document.dispatchEvent(new CustomEvent('eperpus:book-loaded', { detail: book }));
  }

  // Membuat kartu buku serupa dengan aman menggunakan textContent.
  function createRelatedCard(book) {
    const card = document.createElement('article');
    card.className = 'book-card';
    const figure = document.createElement('figure');
    figure.className = 'cover cover--small';
    if (book.image) {
      const img = document.createElement('img');
      img.className = 'cover__image';
      img.src = book.image;
      img.alt = book.imageAlt;
      img.loading = 'lazy';
      figure.appendChild(img);
    } else {
      figure.classList.add('cover--placeholder');
      const caption = document.createElement('figcaption');
      caption.textContent = book.title;
      figure.appendChild(caption);
    }
    const title = document.createElement('h3');
    title.className = 'book-card__title book-card__title--small';
    title.textContent = book.title;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = book.category;
    const link = document.createElement('a');
    link.className = 'btn btn--light btn--block btn--small';
    link.href = `detail.html?id=${encodeURIComponent(book.id)}`;
    link.dataset.route = link.href;
    link.textContent = 'Detail';
    card.append(figure, tag, title, link);
    return card;
  }

  // Menampilkan maksimal tiga buku yang memiliki kategori sama.
  function renderRelatedBooks(currentBook, catalog) {
    const container = $('[data-related-books]');
    container.replaceChildren();
    const related = catalog.filter(book =>
      book.id !== currentBook.id &&
      book.categoryKey === currentBook.categoryKey &&
      (book.stock === null || book.stock > 0)
    ).slice(0, 3);
    if (!related.length) {
      const message = document.createElement('p');
      message.textContent = 'Belum ada buku serupa yang tersedia dalam kategori ini.';
      container.appendChild(message);
      return;
    }
    related.forEach(book => container.appendChild(createRelatedCard(book)));
  }

  // Menampilkan pesan apabila buku tidak ditemukan.
  function showError(message) {
    const messageElement = $('[data-detail-message]');
    messageElement.textContent = message;
    messageElement.hidden = false;
    $('[data-book-title]').textContent = 'Buku tidak ditemukan';
    $('[data-action="borrow"]').disabled = true;
    $('[data-related-books]').replaceChildren();
  }

  // Inisialisasi halaman detail berdasarkan ID dari URL.
  async function initialize() {
    const id = (new URLSearchParams(window.location.search).get('id') || '').trim();
    if (!id) return showError('ID buku tidak ditemukan. Silakan kembali ke katalog.');
    try {
      const catalog = await loadCatalog();
      const book = catalog.find(item => item.id === id);
      if (!book) return showError(`Buku dengan ID ${id} tidak ditemukan. Periksa kembali ID buku.`);
      renderBook(book);
      renderRelatedBooks(book, catalog);
    } catch (error) {
      console.error('Gagal memuat detail buku:', error);
      showError('Data buku gagal dimuat. Jalankan aplikasi melalui Live Server.');
    }
  }

  // Membersihkan URL sementara untuk gambar yang berasal dari Blob.
  window.addEventListener('pagehide', () => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();