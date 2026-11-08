
/* =========================================================
   E-PERPUSTAKAAN
   MODUL ANGGOTA: KATALOG GLOBAL, PENCARIAN, FILTER KATEGORI,
   BOOKMARK, DAN NAVIGASI DETAIL BUKU.

   Fitur:
   1. Menggabungkan buku dari empat halaman kategori.
   2. Menampilkan seluruh buku pada halaman cari.html.
   3. Mencari berdasarkan judul, penulis, ID, dan kategori.
   4. Memfilter buku berdasarkan kategori secara opsional.
   5. Menyimpan pilihan kategori pada URL.
   6. Menambah dan menghapus bookmark.
   7. Menghubungkan tombol Detail dengan ID buku yang benar.

   Penyimpanan bookmark menggunakan localStorage.
   Katalog mengambil data langsung dari file HTML.
   ========================================================= */

(() => {
  'use strict';

  // Kunci penyimpanan bookmark.
  const BOOKMARK_KEY = 'eperpus_anggota_bookmarks';

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

  // Mengambil satu elemen HTML.
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Mengambil seluruh elemen HTML.
  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  // Variabel untuk menyimpan kondisi katalog.
  let bookCards = [];
  let selectedCategory = 'all';
  let catalogReady = false;
  let initialBookmarkTitles = [];

  // Menyamakan format teks agar pencarian tidak sensitif
  // terhadap huruf besar, kecil, dan spasi berlebihan.
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('id')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Mengambil kartu buku dari halaman.
  function getBookCards(root = document) {
    return $$('.book-grid .book-card', root).filter(card =>
      $('.book-card__title', card)
    );
  }

  // Mengambil nama file halaman yang sedang dibuka.
  function getCurrentFile() {
    return window.location.pathname
      .split('/')
      .pop()
      .toLowerCase();
  }

  // Menentukan kategori awal berdasarkan URL atau halaman aktif.
  function getInitialCategory() {
    const params = new URLSearchParams(window.location.search);
    const queryCategory = params.get('kategori');

    if (queryCategory === 'all') return 'all';

    const validCategory = CATEGORY_PAGES.find(item =>
      item.key === queryCategory
    );

    if (validCategory) return validCategory.key;

    const currentPage = CATEGORY_PAGES.find(item =>
      item.file === getCurrentFile()
    );

    return currentPage ? currentPage.key : 'all';
  }

  // Mengambil ID buku dari label sampul atau nama file gambar.
  function getBookId(card) {
    const coverLabel = $('.cover__label', card)?.textContent || '';

    const labelMatch = coverLabel.match(
      /\bID\s*:\s*(\d+)\b/i
    );

    if (labelMatch) return labelMatch[1];

    const image = $('.cover__image', card);
    const imagePath = image?.getAttribute('src') || '';

    const imageMatch = imagePath.match(
      /(?:^|\/)(\d+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i
    );

    if (imageMatch) return imageMatch[1];

    return card.dataset.bookId || '';
  }

  // Memastikan setiap tombol Detail membawa ID buku yang benar.
  function updateDetailLinks() {
    bookCards.forEach(card => {
      const bookId = getBookId(card);

      // Lewati kartu yang tidak memiliki ID.
      if (!bookId) {
        console.warn(
          'ID buku tidak ditemukan:',
          getBookTitle(card)
        );
        return;
      }

      // Membuat alamat detail sesuai ID buku.
      const detailUrl =
        `detail.html?id=${encodeURIComponent(bookId)}`;

      // Memperbarui seluruh tautan Detail pada kartu.
      $$('a', card).forEach(link => {
        const href = link.getAttribute('href') || '';
        const route = link.dataset.route || '';

        // Hanya mengubah tautan yang menuju detail.html.
        if (
          href.includes('detail.html') ||
          route.includes('detail.html')
        ) {
          link.href = detailUrl;
          link.dataset.route = detailUrl;
        }
      });
    });
  }

  // Mengambil judul buku.
  function getBookTitle(card) {
    return $('.book-card__title', card)
      ?.textContent
      .replace(/\s+/g, ' ')
      .trim() || '';
  }

  // Menyimpan bookmark awal yang sudah ditandai pada HTML.
  function captureInitialBookmarks() {
    initialBookmarkTitles = getBookCards()
      .filter(card =>
        $('.book-card__bookmark--saved', card)
      )
      .map(getBookTitle)
      .filter(Boolean);
  }

  // Membaca bookmark dari localStorage.
  function readBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);

      if (raw === null) return null;

      const parsed = JSON.parse(raw);

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

  // Menampilkan status bookmark pada seluruh kartu.
  function renderBookmarks() {
    const storedBookmarks = readBookmarks();

    const bookmarks = storedBookmarks === null
      ? initialBookmarkTitles
      : storedBookmarks;

    bookCards.forEach(card => {
      const button = $('.book-card__bookmark', card);
      const title = getBookTitle(card);

      if (button && title) {
        updateBookmarkButton(
          button,
          bookmarks.includes(title)
        );
      }
    });
  }

  // Menambahkan atau menghapus bookmark.
  function toggleBookmark(button) {
    const card = button.closest('.book-card');
    const title = card ? getBookTitle(card) : '';

    if (!title) {
      window.EPerpus?.notify(
        'Judul buku tidak ditemukan.',
        'error'
      );
      return;
    }

    const storedBookmarks = readBookmarks();

    const bookmarks = storedBookmarks === null
      ? [...initialBookmarkTitles]
      : [...storedBookmarks];

    const index = bookmarks.indexOf(title);
    const isSaved = index === -1;

    if (isSaved) {
      bookmarks.push(title);
    } else {
      bookmarks.splice(index, 1);
    }

    if (!saveBookmarks(bookmarks)) return;

    // Memperbarui semua kartu dengan judul yang sama.
    bookCards.forEach(item => {
      if (getBookTitle(item) === title) {
        const itemButton = $('.book-card__bookmark', item);

        if (itemButton) {
          updateBookmarkButton(itemButton, isSaved);
        }
      }
    });

    window.EPerpus?.notify(
      isSaved
        ? 'Buku berhasil ditambahkan ke bookmark.'
        : 'Buku berhasil dihapus dari bookmark.'
    );
  }

  // Mengumpulkan informasi yang dapat digunakan untuk pencarian.
  function getSearchableText(card) {
    const title = getBookTitle(card);

    const author =
      $('.book-card__author', card)?.textContent || '';

    const tag =
      $('.tag', card)?.textContent || '';

    const imageAlt =
      $('.cover__image', card)?.getAttribute('alt') || '';

    const bookId =
      card.dataset.bookId || getBookId(card);

    const category = CATEGORY_PAGES.find(item =>
      item.key === card.dataset.catalogCategory
    )?.label || '';

    return normalizeText([
      title,
      author,
      tag,
      imageAlt,
      bookId,
      category,
      card.textContent
    ].join(' '));
  }

  // Mengatur visibilitas kartu buku.
  function setCardVisibility(card, isVisible) {
    card.hidden = !isVisible;

    // Menghindari kartu tersembunyi tetap tampil akibat aturan CSS.
    card.style.display = isVisible ? '' : 'none';
  }

  // Fungsi utama pencarian dan filter kategori.
  function applyFilters() {
    const input = $('#keyword');
    const query = normalizeText(input?.value || '');

    // Memecah kata kunci berdasarkan spasi.
    const keywords = query
      ? query.split(' ').filter(Boolean)
      : [];

    bookCards.forEach(card => {
      // Memeriksa apakah kategori sesuai pilihan pengguna.
      const categoryMatches =
        selectedCategory === 'all' ||
        card.dataset.catalogCategory === selectedCategory;

      // Memeriksa apakah seluruh kata kunci ditemukan.
      const searchableText = getSearchableText(card);

      const keywordMatches = keywords.every(keyword =>
        searchableText.includes(keyword)
      );

      // Buku hanya tampil jika kedua kondisi terpenuhi.
      setCardVisibility(
        card,
        categoryMatches && keywordMatches
      );
    });
  }

  // Mengambil kategori dari tautan dropdown.
  function getCategoryFromLink(link) {
    const href = link.getAttribute('href') || '';

    const file = href
      .split('/')
      .pop()
      .toLowerCase();

    return CATEGORY_PAGES.find(item =>
      item.file === file
    ) || null;
  }

  // Memperbarui penanda kategori yang sedang dipilih.
  function updateCategoryMenu() {
    $$('[data-category-dropdown] .dropdown__link')
      .forEach(link => {
        const category = getCategoryFromLink(link);

        const isSelected = Boolean(
          category && category.key === selectedCategory
        );

        link.classList.toggle(
          'dropdown__link--selected',
          isSelected
        );

        if (isSelected) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
  }

  // Mengambil empat halaman kategori dan menggabungkan bukunya.
  async function loadGlobalCatalog() {
    const grid = $('.book-grid');

    if (!grid) return false;

    const currentFile = getCurrentFile();

    const pageResults = await Promise.all(
      CATEGORY_PAGES.map(async category => {
        // Jika halaman sedang aktif termasuk sumber katalog,
        // gunakan dokumen yang sudah tersedia.
        if (category.file === currentFile) {
          return {
            category,
            doc: document
          };
        }

        try {
          const pageUrl = new URL(
            category.file,
            window.location.href
          );

          const response = await fetch(pageUrl.href, {
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}: ${category.file}`
            );
          }

          const html = await response.text();

          // Membaca HTML tanpa menjalankan script di dalamnya.
          const parsedDocument = new DOMParser()
            .parseFromString(html, 'text/html');

          return {
            category,
            doc: parsedDocument
          };
        } catch (error) {
          console.error(
            `Gagal memuat ${category.file}:`,
            error
          );

          return null;
        }
      })
    );

    const successfulPages = pageResults.filter(Boolean);

    // Katalog global harus berasal dari empat halaman.
    if (successfulPages.length !== CATEGORY_PAGES.length) {
      console.warn(
        'Katalog global belum lengkap. Periksa halaman kategori dan jalankan melalui Live Server.'
      );

      return false;
    }

    // Menghindari data buku yang sama dimasukkan dua kali.
    const uniqueCards = new Map();

    successfulPages.forEach(({ category, doc }) => {
      const sourceCards = getBookCards(doc);

      sourceCards.forEach(sourceCard => {
        const title = getBookTitle(sourceCard);
        const bookId = getBookId(sourceCard);

        const uniqueKey = bookId ||
          `judul:${normalizeText(title)}`;

        if (!uniqueKey || uniqueCards.has(uniqueKey)) {
          return;
        }

        // Menyalin kartu buku ke dokumen aktif.
        const card = document.importNode(
          sourceCard,
          true
        );

        // Kategori filter mengikuti halaman sumber kartu.
        card.dataset.catalogCategory = category.key;

        if (bookId) {
          card.dataset.bookId = bookId;
        }

        uniqueCards.set(uniqueKey, card);
      });
    });

    const catalogCards = [...uniqueCards.values()];

    if (catalogCards.length === 0) {
      console.error(
        'Tidak ada data buku yang berhasil dibaca.'
      );

      return false;
    }

    // Mengganti kartu lama dengan seluruh katalog.
    grid.replaceChildren(...catalogCards);

    return true;
  }

  // Menangani kategori sebagai filter tanpa berpindah halaman.
  // Menggunakan capture agar navigasi app.js tidak mengambil alih.
  function handleCategoryClick(event) {
    const target = event.target instanceof Element
      ? event.target
      : null;

    const link = target?.closest(
      '[data-category-dropdown] .dropdown__link'
    );

    if (!link || !catalogReady) return;

    const category = getCategoryFromLink(link);

    if (!category) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // Mengubah kategori aktif.
    selectedCategory = category.key;

    updateCategoryMenu();
    applyFilters();

    // Menutup dropdown setelah kategori dipilih.
    link.closest('details')?.removeAttribute('open');

    // Menyimpan pilihan kategori pada URL.
    const url = new URL(window.location.href);

    url.searchParams.set(
      'kategori',
      selectedCategory
    );

    window.history.replaceState({}, '', url);
  }

  // Menangani tombol Cari dan bookmark.
  function handleClick(event) {
    const target = event.target instanceof Element
      ? event.target
      : null;

    if (!target) return;

    // Tombol pencarian.
    const searchButton = target.closest(
      '[data-action="search"]'
    );

    if (searchButton) {
      applyFilters();
      return;
    }

    // Tombol bookmark.
    const bookmarkButton = target.closest(
      '[data-action="bookmark"]'
    );

    if (bookmarkButton) {
      toggleBookmark(bookmarkButton);
    }
  }

  // Inisialisasi seluruh fitur pencarian.
  async function initialize() {
    if (!$('.book-grid')) return;

    // Menyimpan status bookmark sebelum kartu diganti.
    captureInitialBookmarks();

    // Menentukan kategori awal.
    selectedCategory = getInitialCategory();

    // Mengambil seluruh buku dari empat halaman kategori.
    catalogReady = await loadGlobalCatalog();

    // Memperbarui daftar kartu setelah katalog dimuat.
    bookCards = getBookCards();

    // Jika pemuatan global gagal, gunakan kartu halaman aktif.
    if (!catalogReady) {
      const currentPage = CATEGORY_PAGES.find(item =>
        item.file === getCurrentFile()
      );

      bookCards.forEach(card => {
        card.dataset.catalogCategory =
          currentPage?.key || 'all';

        const id = getBookId(card);

        if (id) {
          card.dataset.bookId = id;
        }
      });

      selectedCategory = currentPage?.key || 'all';
    }

    // Memperbarui tautan Detail dengan ID masing-masing buku.
    updateDetailLinks();

    // Memulihkan bookmark dan menerapkan filter awal.
    renderBookmarks();
    updateCategoryMenu();
    applyFilters();
  }

  // Event click fase capture untuk filter kategori.
  document.addEventListener(
    'click',
    handleCategoryClick,
    true
  );

  // Event input: pencarian langsung ketika pengguna mengetik.
  document.addEventListener('input', event => {
    if (event.target.matches('#keyword')) {
      applyFilters();
    }
  });

  // Event change: memperbarui hasil ketika input berubah.
  document.addEventListener('change', event => {
    if (event.target.matches('#keyword')) {
      applyFilters();
    }
  });

  // Event click: tombol Cari dan bookmark.
  document.addEventListener('click', handleClick);

  // Event Enter: menjalankan pencarian melalui keyboard.
  document.addEventListener('keydown', event => {
    if (
      event.target.matches('#keyword') &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      applyFilters();
    }
  });

  // Menjalankan inisialisasi setelah HTML selesai diparsing.
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
