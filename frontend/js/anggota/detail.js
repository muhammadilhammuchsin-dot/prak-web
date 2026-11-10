
/* E-PERPUSTAKAAN: DETAIL BUKU ANGGOTA.
   Mengambil data buku berdasarkan ID.
   Memuat gambar sampul sesuai ID buku.
   Menggabungkan katalog HTML dan IndexedDB pustakawan. */
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

  // Pemetaan sampul berdasarkan ID. Buku 0003 belum memiliki gambar.
  const STATIC_COVERS = {
    '0001': '../assets/covers/0001.jpg',
    '0002': '../assets/covers/0002.jpg',
    '0004': '../assets/covers/0004.jpg',
    '0005': '../assets/covers/0005.jpg',
    '0006': '../assets/covers/0006.jpg',
    '0007': '../assets/covers/0007.jpg',
    '0008': '../assets/covers/0008.jpg',
    '0009': '../assets/covers/0009.jpg',
    '0010': '../assets/covers/0010.jpg',
    '0011': '../assets/covers/0011.jpg',
    '0012': '../assets/covers/0012.jpg',
    '0013': '../assets/covers/0013.jpg',
    '0014': '../assets/covers/0014.jpg',
    '0015': '../assets/covers/0015.jpg',
    '0016': '../assets/covers/0016.jpg'
  };

  // Data cadangan apabila halaman katalog tidak berhasil dimuat.
  const STATIC_BOOKS = [
    { id: '0002', title: 'Rekayasa Perangkat Lunak Terapan', author: 'Dr. Eng. Ir. M. Hidayat, M.Kom', category: 'Informatika', categoryKey: 'informatika' },
    { id: '0004', title: 'Kecerdasan Buatan & Jaringan Syaraf', author: 'Prof. Fahri A. Salim, Ph.D.', category: 'Sains Data', categoryKey: 'informatika' },
    { id: '0003', title: 'Basis Data Relasional & Manajemen SQL', author: 'Siti Rahmawati, S.T., M.Cs.', category: 'Sistem Informasi', categoryKey: 'informatika' },
    { id: '0001', title: 'Struktur Data & Analisis Algoritma', author: 'Dr. Hendra Gunawan, S.Kom., M.T.', category: 'Informatika', categoryKey: 'informatika', description: 'Landasan teoretis dan penerapan struktur data: Linear Lists, Stack, Trees, B-Tree, Heap, hingga Graph, lengkap dengan kompleksitas Big-O.' },
    { id: '0011', title: 'Matematika dalam Sains', author: 'Dr. Ir. Taufik Abdullah, M.Pd', category: 'Sains & Matematika', categoryKey: 'sains' },
    { id: '0005', title: 'Matematika dalam Bencana', author: 'Prof. Fahri A. Salim, Ph.D.', category: 'Sains & Matematika', categoryKey: 'sains' },
    { id: '0006', title: 'Matematika dalam Perjalanan', author: 'Siti Rahmawati, S.T., M.Cs.', category: 'Sains & Matematika', categoryKey: 'sains' },
    { id: '0012', title: 'Matematika dalam Masyarakat', author: 'Dr. Ir. Taufik Abdullah, M.Sc.', category: 'Sains & Matematika', categoryKey: 'sains' },
    { id: '0014', title: 'Proposal Bisnis', author: 'Dr. Hendra Gunawan, S.Kom., M.T.', category: 'Sosial & Bisnis', categoryKey: 'sosial' },
    { id: '0007', title: 'Bisnis dan Sosial', author: 'Prof. Muhammad Yunus, Ph.D.', category: 'Sosial & Bisnis', categoryKey: 'sosial' },
    { id: '0008', title: 'Komunikasi Bisnis', author: 'Siti Rahmawati, S.T., M.Cs.', category: 'Sosial & Bisnis', categoryKey: 'sosial' },
    { id: '0013', title: 'Tanggung Jawab Sosial Perusahaan', author: 'Dr. Ir. Taufik Abdullah, M.Sc.', category: 'Sosial & Bisnis', categoryKey: 'sosial' },
    { id: '0015', title: 'Sastra Indonesia Lengkap', author: 'Prof. Fahri A. Salim, Ph.D.', category: 'Sastra & Bahasa', categoryKey: 'sastra' },
    { id: '0009', title: 'Bahasa dan Sastra Indonesia', author: 'Prof. Fahri A. Salim, Ph.D.', category: 'Sastra & Bahasa', categoryKey: 'sastra' },
    { id: '0016', title: 'Bahasa Indonesia untuk Perguruan Tinggi', author: 'Siti Rahmawati, S.T., M.Cs.', category: 'Sastra & Bahasa', categoryKey: 'sastra' },
    { id: '0010', title: 'Macam-Macam Karya Sastra Modern', author: 'Dr. Ir. Taufik Abdullah, M.Sc.', category: 'Sastra & Bahasa', categoryKey: 'sastra' }
  ];

  const FALLBACKS = {
    '0001': { stock: 4, borrowExtra: '(12 kali oleh Informatika)' }
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const objectUrls = [];

  // Normalisasi teks.
  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('id').replace(/\s+/g, ' ').trim();
  }

  // Menentukan kategori buku.
  function mapCategory(value) {
    const text = normalizeText(value);
    if (text.includes('informatika') || text.includes('komputer') || text.includes('sistem informasi') || text.includes('teknologi informasi')) return 'informatika';
    if (text.includes('sains') || text.includes('matematika')) return 'sains';
    if (text.includes('sosial') || text.includes('bisnis') || text.includes('ekonomi') || text.includes('manajemen')) return 'sosial';
    if (text.includes('sastra') || text.includes('bahasa')) return 'sastra';
    return '';
  }

  function getCategoryLabel(key) {
    return CATEGORY_PAGES.find(item => item.key === key)?.label || 'Kategori lainnya';
  }

  // Menghasilkan URL sampul berdasarkan ID.
  function getStaticCover(id) {
    const path = STATIC_COVERS[String(id || '').trim()];
    return path ? new URL(path, window.location.href).href : '';
  }

  // Membaca buku yang dimasukkan pustakawan dari IndexedDB.
  function getAdminBooks() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve([]);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id_buku' });
        }
      };
      request.onerror = () => reject(request.error || new Error('IndexedDB gagal dibuka.'));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          resolve([]);
          return;
        }
        let transaction;
        try {
          transaction = db.transaction(STORE_NAME, 'readonly');
        } catch (error) {
          db.close();
          reject(error);
          return;
        }
        const getAll = transaction.objectStore(STORE_NAME).getAll();
        getAll.onsuccess = () => resolve(Array.isArray(getAll.result) ? getAll.result : []);
        getAll.onerror = () => reject(getAll.error || new Error('Data buku admin gagal dibaca.'));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      };
    });
  }

  // Mengubah gambar admin dari Blob, data URL, atau alamat file.
  function resolveAdminImage(record, id) {
    if (record.gambar instanceof Blob && record.gambar.size > 0) {
      const url = URL.createObjectURL(record.gambar);
      objectUrls.push(url);
      return url;
    }
    if (typeof record.gambar === 'string' && record.gambar.trim()) {
      const source = record.gambar.trim();
      if (/^(data:image\/|blob:|https?:\/\/)/i.test(source)) return source;
      try {
        return new URL(source, window.location.href).href;
      } catch (_) {
        return '';
      }
    }
    return getStaticCover(id);
  }

  // Menyesuaikan record buku admin.
  function normalizeAdminBook(record) {
    const id = String(record.id_buku || '').trim();
    const title = String(record.judul || '').trim();
    const categoryKey = mapCategory(record.kategori);
    if (!id || !title || !categoryKey) return null;
    const stockValue = Number(record.stok);
    const stock = record.stok === '' || record.stok === null || record.stok === undefined
      ? null
      : (Number.isFinite(stockValue) ? stockValue : null);
    return {
      id,
      title,
      author: String(record.penulis || '').trim() || 'Data penulis belum tersedia',
      category: String(record.kategori || getCategoryLabel(categoryKey)),
      categoryKey,
      image: resolveAdminImage(record, id),
      imageAlt: `Sampul ${title}`,
      description: String(record.deskripsi || '').trim(),
      stock,
      borrowCount: null,
      source: 'indexeddb'
    };
  }

  // Mengambil ID dari kartu berdasarkan atribut, label, gambar, atau judul.
  function getStaticBookId(card) {
    const explicitId = String(card.dataset.bookId || '').trim();
    if (explicitId) return explicitId;
    const label = card.querySelector('.cover__label')?.textContent || '';
    const labelMatch = label.match(/ID\s*:\s*([\w-]+)/i);
    if (labelMatch) return labelMatch[1];
    const imagePath = card.querySelector('.cover__image')?.getAttribute('src') || '';
    const imageMatch = imagePath.match(/(?:^|\/)([\w-]+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i);
    if (imageMatch) return imageMatch[1];
    const title = normalizeText(card.querySelector('.book-card__title')?.textContent);
    return STATIC_BOOKS.find(book => normalizeText(book.title) === title)?.id || '';
  }

  // Membaca metadata buku dari halaman katalog.
  function parseStaticCard(card, category, pageUrl) {
    const title = card.querySelector('.book-card__title')?.textContent.replace(/\s+/g, ' ').trim() || '';
    if (!title) return null;
    const id = getStaticBookId(card);
    if (!id) {
      console.warn('ID buku tidak ditemukan:', title);
      return null;
    }
    const imageElement = card.querySelector('.cover__image');
    const imagePath = imageElement?.getAttribute('src') || '';
    let image = '';
    try {
      image = imagePath ? new URL(imagePath, pageUrl).href : getStaticCover(id);
    } catch (_) {
      image = getStaticCover(id);
    }
    const badge = card.querySelector('.badge')?.textContent || '';
    const borrowMatch = badge.match(/(\d+)\s*x/i);
    return {
      id,
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

  // Data cadangan jika fetch halaman katalog gagal.
  function getStaticFallbackBooks() {
    return STATIC_BOOKS.map(book => ({
      ...book,
      image: getStaticCover(book.id),
      imageAlt: `Sampul ${book.title}`,
      description: book.description || '',
      stock: FALLBACKS[book.id]?.stock ?? null,
      borrowCount: null,
      source: 'fallback'
    }));
  }

  // Menggabungkan data dari katalog dan IndexedDB.
  async function loadCatalog() {
    const pageResults = await Promise.allSettled(CATEGORY_PAGES.map(async category => {
      const pageUrl = new URL(category.file, window.location.href);
      const response = await fetch(pageUrl.href, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${category.file}: HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return [...doc.querySelectorAll('.book-grid .book-card')]
        .map(card => parseStaticCard(card, category, pageUrl))
        .filter(Boolean);
    }));

    const books = new Map();
    pageResults.forEach(result => {
      if (result.status === 'fulfilled') {
        result.value.forEach(book => {
          if (book.id && !books.has(book.id)) books.set(book.id, book);
        });
      } else {
        console.warn('Halaman katalog gagal dimuat:', result.reason);
      }
    });

    // Data cadangan tidak menimpa data yang berhasil dimuat.
    getStaticFallbackBooks().forEach(book => {
      if (!books.has(book.id)) books.set(book.id, book);
    });

    const adminBooks = await getAdminBooks().catch(error => {
      console.warn('Data buku admin tidak dapat dibaca:', error);
      return [];
    });
    adminBooks.map(normalizeAdminBook).filter(Boolean).forEach(book => {
      if (!books.has(book.id)) books.set(book.id, book);
    });
    return [...books.values()];
  }

  // Menghitung riwayat peminjaman buku.
  function getBorrowCount(bookId) {
    try {
      const records = JSON.parse(localStorage.getItem('eperpus_demo_transactions') || '[]');
      if (!Array.isArray(records)) return null;
      return records.filter(item =>
        String(item.bookId || item.id_buku || '') === String(bookId) &&
        !['batal', 'dibatalkan', 'cancelled', 'ditolak'].includes(normalizeText(item.status))
      ).length;
    } catch (_) {
      return null;
    }
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  // Menampilkan gambar yang sesuai dengan ID buku.
  function renderCover(book) {
    const image = $('[data-book-image]');
    const placeholder = $('[data-book-cover-placeholder]');
    if (!image || !placeholder) return;

    const coverUrl = book.image || getStaticCover(book.id);
    image.onerror = () => {
      image.hidden = true;
      image.removeAttribute('src');
      placeholder.textContent = 'Sampul buku belum tersedia.';
      placeholder.hidden = false;
    };

    if (!coverUrl) {
      image.hidden = true;
      image.removeAttribute('src');
      placeholder.textContent = 'Sampul buku belum tersedia.';
      placeholder.hidden = false;
      return;
    }

    image.hidden = false;
    image.alt = book.imageAlt || `Sampul ${book.title}`;
    placeholder.hidden = true;
    image.src = coverUrl;
  }

  // Menampilkan informasi buku.
  function renderBook(book) {
    setText('[data-book-title]', book.title);
    setText('[data-book-id]', book.id);
    setText('[data-book-author]', book.author);
    setText('[data-book-category]', book.category);
    renderCover(book);

    const fallback = FALLBACKS[book.id] || {};
    const stock = book.stock ?? fallback.stock ?? null;
    setText('[data-book-stock]', stock === null ? 'Belum tersedia' : String(stock));
    setText('[data-book-description]', book.description || fallback.description || 'Deskripsi buku belum tersedia.');

    const count = book.borrowCount ?? getBorrowCount(book.id);
    setText('[data-book-borrow-count]', count === null ? 'Data peminjaman belum tersedia' : `Dipinjam ${count}x`);
    setText('[data-book-borrow-extra]', fallback.borrowExtra || '');

    const button = $('[data-action="borrow"]');
    if (button) {
      button.dataset.bookId = book.id;
      button.dataset.bookTitle = book.title;
      button.dataset.bookCategoryKey = book.categoryKey;
      button.dataset.bookSource = book.source || 'html';
      button.dataset.bookStock = stock === null ? '' : String(stock);
      button.disabled = stock !== null && stock <= 0;
      button.textContent = stock !== null && stock <= 0 ? 'Stok Buku Habis' : 'Pinjam Buku';
    }

    const message = $('[data-detail-message]');
    if (message) message.hidden = true;
    document.title = `${book.title} - E-Perpustakaan`;
    document.dispatchEvent(new CustomEvent('eperpus:book-loaded', { detail: book }));
  }

  // Membuat kartu buku serupa.
  function createRelatedCard(book) {
    const card = document.createElement('article');
    card.className = 'book-card';
    const figure = document.createElement('figure');
    figure.className = 'cover cover--small';

    if (book.image || getStaticCover(book.id)) {
      const img = document.createElement('img');
      img.className = 'cover__image';
      img.src = book.image || getStaticCover(book.id);
      img.alt = book.imageAlt || `Sampul ${book.title}`;
      img.loading = 'lazy';
      img.onerror = () => {
        img.remove();
        figure.classList.add('cover--placeholder');
        figure.textContent = 'Sampul belum tersedia';
      };
      figure.appendChild(img);
    } else {
      figure.classList.add('cover--placeholder');
      figure.textContent = 'Sampul belum tersedia';
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
    link.dataset.route = link.getAttribute('href');
    link.textContent = 'Detail';
    card.append(figure, tag, title, link);
    return card;
  }

  // Menampilkan maksimal tiga buku dalam kategori yang sama.
  function renderRelatedBooks(currentBook, catalog) {
    const container = $('[data-related-books]');
    if (!container) return;
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

  // Menampilkan pesan jika ID atau data buku tidak ditemukan.
  function showError(message) {
    const messageElement = $('[data-detail-message]');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.hidden = false;
    }
    setText('[data-book-title]', 'Buku tidak ditemukan');
    setText('[data-book-id]', '—');
    setText('[data-book-author]', '—');
    setText('[data-book-category]', '—');
    setText('[data-book-stock]', '—');
    setText('[data-book-description]', message);

    const image = $('[data-book-image]');
    const placeholder = $('[data-book-cover-placeholder]');
    if (image) {
      image.hidden = true;
      image.removeAttribute('src');
    }
    if (placeholder) {
      placeholder.textContent = 'Sampul tidak tersedia';
      placeholder.hidden = false;
    }
    const button = $('[data-action="borrow"]');
    if (button) button.disabled = true;
    $('[data-related-books]')?.replaceChildren();
  }

  // Mengambil ID buku dari URL dan memuat datanya.
  async function initialize() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get('id') || '').trim();

    if (!id) {
      showError('ID buku tidak ditemukan. Silakan kembali ke katalog dan pilih buku melalui tombol Detail.');
      return;
    }

    try {
      const catalog = await loadCatalog();
      const book = catalog.find(item => String(item.id) === id);
      if (!book) {
        showError(`Buku dengan ID ${id} tidak ditemukan dalam katalog.`);
        return;
      }
      renderBook(book);
      renderRelatedBooks(book, catalog);
    } catch (error) {
      console.error('Gagal memuat detail buku:', error);
      showError('Data buku gagal dimuat. Pastikan aplikasi dijalankan melalui Live Server.');
    }
  }

  // Membersihkan URL sementara dari gambar Blob.
  window.addEventListener('pagehide', () => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
