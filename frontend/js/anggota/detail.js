
/* =========================================================
   E-PERPUSTAKAAN
   MODUL DETAIL BUKU ANGGOTA

   Fitur:
   1. Membaca ID buku dari URL.
   2. Mengambil data dari empat halaman kategori.
   3. Menampilkan detail sesuai buku yang dipilih.
   4. Menampilkan buku serupa.
   5. Mengirim identitas buku ke modul transaksi.

   Sumber data: HTML kategori, bukan database.
   ========================================================= */

(() => {
  'use strict';

  // Daftar halaman sumber katalog.
  const CATEGORY_PAGES = [
    {
      key: 'informatika',
      label: 'Informatika & Komputer',
      file: 'cari-informatika.html'
    },
    {
      key: 'sains',
      label: 'Sains & Matematika',
      file: 'cari-sains.html'
    },
    {
      key: 'sosial',
      label: 'Sosial & Bisnis',
      file: 'cari-sosial.html'
    },
    {
      key: 'sastra',
      label: 'Sastra & Bahasa',
      file: 'cari-sastra.html'
    }
  ];

  // Data tambahan yang memang tersedia pada HTML detail lama.
  const DETAIL_FALLBACKS = {
    '0001': {
      stock: 4,
      description: 'Landasan teoretis dan penerapan struktur data: Linear Lists, Stack, Trees, B-Tree, Heap, hingga Graph, lengkap dengan kompleksitas Big-O.',
      borrowExtra: '(12 kali oleh Informatika)'
    }
  };

  // Mengambil satu elemen HTML.
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Menormalkan teks.
  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Mengambil ID dari kartu buku.
  function getBookId(card) {
    // Prioritaskan ID yang sudah tersimpan.
    if (card.dataset.bookId) {
      return card.dataset.bookId.trim();
    }

    // Mengambil ID dari label sampul.
    const label = $('.cover__label', card)?.textContent || '';

    const labelMatch = label.match(
      /ID\s*:\s*(\d+)/i
    );

    if (labelMatch) return labelMatch[1];

    // Mengambil ID dari nama file gambar.
    const image = $('.cover__image', card);
    const imagePath = image?.getAttribute('src') || '';

    const imageMatch = imagePath.match(
      /(?:^|\/)(\d+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i
    );

    return imageMatch ? imageMatch[1] : '';
  }

  // Mengambil angka statistik peminjaman.
  function getBorrowCount(card) {
    const badge = $('.badge', card)?.textContent || '';
    const match = badge.match(/(\d+)\s*x/i);

    return match ? Number(match[1]) : null;
  }

  // Mengambil angka stok apabila sumber menyediakannya.
  function getStock(card) {
    const element = $('[data-book-stock], .stock-badge', card);

    if (!element) return null;

    const match = element.textContent.match(/\d+/);

    return match ? Number(match[0]) : null;
  }

  // Mengambil informasi satu buku dari kartu HTML.
  function parseBookCard(card, category, pageUrl) {
    const title = normalizeText(
      $('.book-card__title', card)?.textContent
    );

    if (!title) return null;

    const image = $('.cover__image', card);
    const imagePath = image?.getAttribute('src') || '';

    let imageUrl = '';

    // Mengubah alamat gambar menjadi URL lengkap.
    if (imagePath) {
      imageUrl = new URL(imagePath, pageUrl).href;
    }

    // Mengambil deskripsi jika tersedia.
    const description = normalizeText(
      $('.book-card__text, .book-card__description, [data-book-description]', card)?.textContent
    );

    // Mengambil kategori dari label buku.
    const tag = normalizeText(
      $('.tag', card)?.textContent
    );

    return {
      id: getBookId(card),
      title,
      author: normalizeText(
        $('.book-card__author', card)?.textContent
      ) || 'Data penulis belum tersedia',
      category: tag || category.label,
      categoryKey: category.key,
      image: imageUrl,
      imageAlt: image?.getAttribute('alt') || `Sampul ${title}`,
      description,
      stock: getStock(card),
      borrowCount: getBorrowCount(card),
      borrowExtra: normalizeText(
        card.dataset.borrowExtra || ''
      )
    };
  }

  // Mengambil seluruh buku dari empat halaman kategori.
  async function loadCatalog() {
    const results = await Promise.all(
      CATEGORY_PAGES.map(async category => {
        const pageUrl = new URL(
          category.file,
          window.location.href
        );

        try {
          const response = await fetch(pageUrl.href, {
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();

          // Mengubah HTML menjadi dokumen yang dapat dibaca.
          const parsed = new DOMParser().parseFromString(
            html,
            'text/html'
          );

          return {
            category,
            pageUrl,
            cards: [
              ...parsed.querySelectorAll(
                '.book-grid .book-card'
              )
            ]
          };
        } catch (error) {
          console.error(
            `Gagal membaca ${category.file}:`,
            error
          );

          return null;
        }
      })
    );

    // Menyimpan buku berdasarkan ID agar tidak duplikat.
    const catalog = new Map();

    results.filter(Boolean).forEach(
      ({ category, pageUrl, cards }) => {
        cards.forEach(card => {
          const book = parseBookCard(
            card,
            category,
            pageUrl
          );

          if (book?.id && !catalog.has(book.id)) {
            catalog.set(book.id, book);
          }
        });
      }
    );

    return [...catalog.values()];
  }

  // Mengisi seluruh informasi detail buku.
  function renderBook(book) {
    const fallback = DETAIL_FALLBACKS[book.id] || {};

    // Mengisi informasi identitas buku.
    $('[data-book-title]').textContent = book.title;
    $('[data-book-id]').textContent = book.id;
    $('[data-book-author]').textContent = book.author;
    $('[data-book-category]').textContent = book.category;

    // Mengatur sampul buku.
    const image = $('[data-book-image]');

    if (book.image) {
      image.src = book.image;
      image.alt = book.imageAlt;
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    // Data stok hanya ditampilkan jika tersedia.
    const stock = book.stock ?? fallback.stock;
    const stockElement = $('[data-book-stock]');

    stockElement.textContent =
      stock === null || stock === undefined
        ? 'Belum tersedia'
        : String(stock);

    // Mengisi deskripsi buku.
    // Tidak membuat deskripsi baru apabila sumber tidak menyediakannya.
    $('[data-book-description]').textContent =
      book.description ||
      fallback.description ||
      'Deskripsi buku belum tersedia.';

    // Mengisi statistik peminjaman.
    const borrowCount =
      book.borrowCount ?? fallback.borrowCount;

    $('[data-book-borrow-count]').textContent =
      borrowCount === null || borrowCount === undefined
        ? 'Data peminjaman belum tersedia'
        : `Dipinjam ${borrowCount}x`;

    // Mengisi informasi tambahan peminjaman.
    $('[data-book-borrow-extra]').textContent =
      book.borrowExtra || fallback.borrowExtra || '';

    // Mengirim ID dan judul ke tombol transaksi.
    const borrowButton = $('[data-action="borrow"]');

    borrowButton.dataset.bookId = book.id;
    borrowButton.dataset.bookTitle = book.title;
    borrowButton.disabled = stock === 0;

    // Memperbarui judul tab browser.
    document.title = `${book.title} - E-Perpustakaan`;

    // Memberitahu transaksi bahwa detail buku sudah dimuat.
    document.dispatchEvent(
      new CustomEvent('eperpus:book-loaded', {
        detail: book
      })
    );
  }

  // Membuat satu kartu rekomendasi buku.
  function createRelatedCard(book) {
    const article = document.createElement('article');
    article.className = 'book-card';

    const top = document.createElement('div');
    top.className = 'book-card__top';

    // Membuat area sampul.
    const figure = document.createElement('figure');
    figure.className = 'cover cover--small';

    if (book.image) {
      const image = document.createElement('img');

      image.className = 'cover__image';
      image.src = book.image;
      image.alt = book.imageAlt;
      image.loading = 'lazy';

      figure.appendChild(image);
    } else {
      figure.classList.add('cover--placeholder');

      const caption = document.createElement('figcaption');
      caption.textContent = book.title;

      figure.appendChild(caption);
    }

    // Membuat informasi buku.
    const body = document.createElement('div');
    body.className = 'book-card__body';

    const title = document.createElement('h3');
    title.className = 'book-card__title book-card__title--small';
    title.textContent = book.title;

    const badge = document.createElement('span');
    badge.className = 'badge';

    badge.textContent = book.borrowCount === null
      ? 'Data peminjaman belum tersedia'
      : `dipinjam ${book.borrowCount}x`;

    body.append(title, badge);
    top.append(figure, body);

    // Membuat tombol Detail dengan ID yang benar.
    const link = document.createElement('a');

    link.className = 'btn btn--light btn--block btn--small';

    const detailUrl =
      `detail.html?id=${encodeURIComponent(book.id)}`;

    link.href = detailUrl;
    link.dataset.route = detailUrl;
    link.textContent = 'Detail';

    article.append(top, link);

    return article;
  }

  // Menampilkan buku lain dari kategori yang sama.
  function renderRelatedBooks(currentBook, catalog) {
    const container = $('[data-related-books]');

    container.replaceChildren();

    // Mengambil maksimal tiga buku dari kategori yang sama.
    const related = catalog
      .filter(book =>
        book.id !== currentBook.id &&
        book.categoryKey === currentBook.categoryKey
      )
      .slice(0, 3);

    // Menampilkan pesan jika tidak ada buku serupa.
    if (related.length === 0) {
      const message = document.createElement('p');

      message.textContent =
        'Belum ada buku serupa dalam kategori ini.';

      container.appendChild(message);
      return;
    }

    // Menampilkan seluruh kartu rekomendasi.
    related.forEach(book => {
      container.appendChild(
        createRelatedCard(book)
      );
    });
  }

  // Menampilkan pesan apabila buku tidak ditemukan.
  function showError(message) {
    const messageElement = $('[data-detail-message]');

    messageElement.textContent = message;
    messageElement.hidden = false;

    // Mengubah judul dan menonaktifkan tombol peminjaman.
    $('[data-book-title]').textContent =
      'Buku tidak ditemukan';

    $('[data-action="borrow"]').disabled = true;

    // Menghapus rekomendasi karena data buku tidak valid.
    $('[data-related-books]').replaceChildren();
  }

  // Inisialisasi halaman detail buku.
  async function initialize() {
    const params = new URLSearchParams(
      window.location.search
    );

    // Mengambil ID buku dari URL.
    const bookId = (params.get('id') || '').trim();

    // Tidak menggunakan ID default agar kesalahan navigasi
    // tidak membuat semua buku menampilkan detail yang sama.
    if (!bookId) {
      showError(
        'ID buku tidak ditemukan. Silakan kembali ke katalog dan pilih buku yang ingin dilihat.'
      );
      return;
    }

    try {
      // Mengambil katalog dari empat halaman kategori.
      const catalog = await loadCatalog();

      // Mencari buku berdasarkan ID yang dipilih.
      const selectedBook = catalog.find(book =>
        book.id === bookId
      );

      // Menampilkan pesan jika ID tidak ditemukan.
      if (!selectedBook) {
        showError(
          `Buku dengan ID ${bookId} tidak ditemukan. Periksa data katalog.`
        );
        return;
      }

      // Menampilkan detail buku yang sesuai.
      renderBook(selectedBook);

      // Menampilkan rekomendasi buku serupa.
      renderRelatedBooks(selectedBook, catalog);
    } catch (error) {
      console.error(
        'Gagal memuat detail buku:',
        error
      );

      showError(
        'Data buku gagal dimuat. Pastikan proyek dijalankan melalui Live Server.'
      );
    }
  }

  // Menjalankan setelah HTML selesai diparsing.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
