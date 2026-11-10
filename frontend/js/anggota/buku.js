/* =========================================================
   E-PERPUSTAKAAN - MODUL KATALOG DAN PENCARIAN ANGGOTA
   Fungsi:
   1. Menggabungkan katalog dari empat kategori.
   2. Melakukan pencarian dan filter buku.
   3. Mengelola bookmark.
   4. Mengarahkan anggota ke detail buku.
   5. Mencatat pencarian untuk pembentukan profil KNN.
   Penyimpanan menggunakan localStorage.
   ========================================================= */
(() => {
  'use strict';
  // Kunci penyimpanan bookmark dan riwayat pencarian.
  const BOOKMARK_KEY = 'eperpus_anggota_bookmarks';
  const SEARCH_HISTORY_KEY = 'eperpus_anggota_search_history';
  // Daftar halaman sumber katalog.
  const CATEGORY_PAGES = [
    { key: 'informatika', label: 'Informatika & Komputer', file: 'cari-informatika.html' },
    { key: 'sains', label: 'Sains & Matematika', file: 'cari-sains.html' },
    { key: 'sosial', label: 'Sosial & Bisnis', file: 'cari-sosial.html' },
    { key: 'sastra', label: 'Sastra & Bahasa', file: 'cari-sastra.html' }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  // Menyimpan kondisi katalog dan bookmark.
  let bookCards = [];
  let selectedCategory = 'all';
  let catalogReady = false;
  let initialBookmarkTitles = [];
  // Menyamakan format teks untuk pencarian.
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
    return window.location.pathname.split('/').pop().toLowerCase();
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
  // Mengambil ID buku dari atribut, label sampul, atau nama file gambar.
  function getBookId(card) {
    const storedId = card.dataset.bookId?.trim();
    if (storedId) return storedId;
    const coverLabel = $('.cover__label', card)?.textContent || '';
    const labelMatch = coverLabel.match(/\bID\s*:\s*(\d+)\b/i);
    if (labelMatch) return labelMatch[1];
    const imagePath = $('.cover__image', card)?.getAttribute('src') || '';
    const imageMatch = imagePath.match(
      /(?:^|\/)(\d+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i
    );
    return imageMatch ? imageMatch[1] : '';
  }
  // Mengambil judul buku.
  function getBookTitle(card) {
    return $('.book-card__title', card)
      ?.textContent.replace(/\s+/g, ' ').trim() || '';
  }
  // Memastikan tombol Detail membawa ID buku yang benar.
  function updateDetailLinks() {
    bookCards.forEach(card => {
      const bookId = getBookId(card);
      if (!bookId) {
        console.warn('ID buku tidak ditemukan:', getBookTitle(card));
        return;
      }
      const detailUrl = `detail.html?id=${encodeURIComponent(bookId)}`;
      $$('a', card).forEach(link => {
        const href = link.getAttribute('href') || '';
        const route = link.dataset.route || '';
        if (href.includes('detail.html') || route.includes('detail.html')) {
          link.href = detailUrl;
          link.dataset.route = detailUrl;
        }
      });
    });
  }
  // Memastikan ID buku benar sebelum navigasi dijalankan.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('.book-card a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const route = link.dataset.route || '';
    if (!href.includes('detail.html') && !route.includes('detail.html')) return;
    const card = link.closest('.book-card');
    if (!card) return;
    const bookId = getBookId(card);
    if (!bookId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.error('ID buku tidak ditemukan:', getBookTitle(card));
      window.EPerpus?.notify('ID buku tidak ditemukan. Periksa data katalog.', 'error');
      return;
    }
    const detailUrl = `detail.html?id=${encodeURIComponent(bookId)}`;
    link.href = detailUrl;
    link.dataset.route = detailUrl;
  }, true);
  // Menyimpan bookmark awal yang sudah ditandai pada HTML.
  function captureInitialBookmarks() {
    initialBookmarkTitles = getBookCards()
      .filter(card => $('.book-card__bookmark--saved', card))
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
  // Menyimpan bookmark.
  function saveBookmarks(bookmarks) {
    try {
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
      return true;
    } catch (error) {
      console.error('Gagal menyimpan bookmark:', error);
      window.EPerpus?.notify('Bookmark gagal disimpan.', 'error');
      return false;
    }
  }
  // Memperbarui tampilan tombol bookmark.
  function updateBookmarkButton(button, isSaved) {
    button.classList.toggle('book-card__bookmark--saved', isSaved);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', isSaved ? 'Hapus dari bookmark' : 'Simpan buku');
  }
  // Menampilkan status bookmark pada seluruh kartu.
  function renderBookmarks() {
    const storedBookmarks = readBookmarks();
    const bookmarks = storedBookmarks === null ? initialBookmarkTitles : storedBookmarks;
    bookCards.forEach(card => {
      const button = $('.book-card__bookmark', card);
      const title = getBookTitle(card);
      if (button && title) updateBookmarkButton(button, bookmarks.includes(title));
    });
  }
  // Menambahkan atau menghapus bookmark.
  function toggleBookmark(button) {
    const card = button.closest('.book-card');
    const title = card ? getBookTitle(card) : '';
    if (!title) {
      window.EPerpus?.notify('Judul buku tidak ditemukan.', 'error');
      return;
    }
    const storedBookmarks = readBookmarks();
    const bookmarks = storedBookmarks === null ? [...initialBookmarkTitles] : [...storedBookmarks];
    const index = bookmarks.indexOf(title);
    const isSaved = index === -1;
    if (isSaved) bookmarks.push(title);
    else bookmarks.splice(index, 1);
    if (!saveBookmarks(bookmarks)) return;
    // Perbarui semua kartu dengan judul yang sama.
    bookCards.forEach(item => {
      if (getBookTitle(item) === title) {
        const itemButton = $('.book-card__bookmark', item);
        if (itemButton) updateBookmarkButton(itemButton, isSaved);
      }
    });
    window.EPerpus?.notify(
      isSaved ? 'Buku berhasil ditambahkan ke bookmark.' : 'Buku berhasil dihapus dari bookmark.'
    );
  }
  // Mengumpulkan teks yang dapat digunakan dalam pencarian.
  function getSearchableText(card) {
    const title = getBookTitle(card);
    const author = $('.book-card__author', card)?.textContent || '';
    const tag = $('.tag', card)?.textContent || '';
    const imageAlt = $('.cover__image', card)?.getAttribute('alt') || '';
    const bookId = card.dataset.bookId || getBookId(card);
    const category = CATEGORY_PAGES.find(item =>
      item.key === card.dataset.catalogCategory
    )?.label || '';
    return normalizeText([title, author, tag, imageAlt, bookId, category, card.textContent].join(' '));
  }
  // Mengatur visibilitas kartu buku.
  function setCardVisibility(card, isVisible) {
    card.hidden = !isVisible;
    card.style.display = isVisible ? '' : 'none';
  }
  // Menjalankan pencarian dan filter kategori.
  function applyFilters() {
    const query = normalizeText($('#keyword')?.value || '');
    const keywords = query ? query.split(' ').filter(Boolean) : [];
    bookCards.forEach(card => {
      const categoryMatches = selectedCategory === 'all' ||
        card.dataset.catalogCategory === selectedCategory;
      const searchableText = getSearchableText(card);
      const keywordMatches = keywords.every(keyword =>
        searchableText.includes(keyword)
      );
      setCardVisibility(card, categoryMatches && keywordMatches);
    });
  }
  // Membaca identitas anggota yang sedang login.
  function getMemberSession() {
    const sessionKeys = ['eperpus_demo_session', 'eperpus_anggota_session'];
    for (const key of sessionKeys) {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const session = JSON.parse(raw);
        if (session?.npm) return session;
      } catch (error) {
        console.warn(`Sesi anggota ${key} tidak dapat dibaca.`, error);
      }
    }
    return null;
  }
  // Mencatat pencarian yang benar-benar dikirim anggota.
  // Tidak mencatat setiap karakter yang sedang diketik.
  function recordSearchActivity(query) {
    const cleanQuery = normalizeText(query);
    if (!cleanQuery) return;
    const session = getMemberSession();
    if (!session?.npm) return;
    // Ambil buku yang cocok dengan kueri pencarian.
    const matchedCards = bookCards.filter(card =>
      !card.hidden && card.style.display !== 'none'
    );
    if (matchedCards.length === 0) return;
    // Kelompokkan hasil pencarian berdasarkan kategori.
    const matchesByCategory = new Map();
    matchedCards.forEach(card => {
      const categoryKey = card.dataset.catalogCategory;
      if (!CATEGORY_PAGES.some(category => category.key === categoryKey)) return;
      if (!matchesByCategory.has(categoryKey)) {
        matchesByCategory.set(categoryKey, new Set());
      }
      const bookId = getBookId(card);
      if (bookId) matchesByCategory.get(categoryKey).add(bookId);
    });
    if (matchesByCategory.size === 0) return;
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(history)) throw new Error('Format riwayat pencarian tidak valid.');
      const now = new Date();
      const timestamp = now.toISOString();
      matchesByCategory.forEach((bookIds, categoryKey) => {
        // Cegah pencatatan ganda akibat klik/Enter berulang dalam 1,5 detik.
        const isDuplicate = history.some(record => {
          if (!record || typeof record !== 'object' ||
            record.npm !== session.npm ||
            record.categoryKey !== categoryKey ||
            normalizeText(record.query) !== cleanQuery) return false;
          const previousTime = new Date(record.createdAt).getTime();
          return Number.isFinite(previousTime) && now.getTime() - previousTime < 1500;
        });
        if (isDuplicate) return;
        history.push({
          id: `SRCH-${now.getTime()}-${categoryKey}`,
          npm: session.npm,
          query: cleanQuery,
          categoryKey,
          bookIds: [...bookIds],
          createdAt: timestamp
        });
      });
      // Batasi penyimpanan maksimal 5.000 aktivitas.
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(-5000)));
    } catch (error) {
      console.error('Riwayat pencarian gagal disimpan:', error);
      window.EPerpus?.notify('Riwayat pencarian tidak dapat disimpan.', 'error');
    }
  }
  // Mengambil kategori dari tautan dropdown.
  function getCategoryFromLink(link) {
    const file = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
    return CATEGORY_PAGES.find(item => item.file === file) || null;
  }
  // Memperbarui penanda kategori yang sedang dipilih.
  function updateCategoryMenu() {
    $$('[data-category-dropdown] .dropdown__link').forEach(link => {
      const category = getCategoryFromLink(link);
      const isSelected = Boolean(category && category.key === selectedCategory);
      link.classList.toggle('dropdown__link--selected', isSelected);
      if (isSelected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  // Mengambil empat halaman kategori dan menggabungkan buku.
  async function loadGlobalCatalog() {
    const grid = $('.book-grid');
    if (!grid) return false;
    const currentFile = getCurrentFile();
    const pageResults = await Promise.all(
      CATEGORY_PAGES.map(async category => {
        if (category.file === currentFile) return { category, doc: document };
        try {
          const pageUrl = new URL(category.file, window.location.href);
          const response = await fetch(pageUrl.href, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${category.file}`);
          const html = await response.text();
          return {
            category,
            doc: new DOMParser().parseFromString(html, 'text/html')
          };
        } catch (error) {
          console.error(`Gagal memuat ${category.file}:`, error);
          return null;
        }
      })
    );
    const successfulPages = pageResults.filter(Boolean);
    if (successfulPages.length !== CATEGORY_PAGES.length) {
      console.warn('Katalog global belum lengkap. Jalankan proyek melalui Live Server.');
      return false;
    }
    // Hindari buku yang sama masuk dua kali.
    const uniqueCards = new Map();
    successfulPages.forEach(({ category, doc }) => {
      getBookCards(doc).forEach(sourceCard => {
        const title = getBookTitle(sourceCard);
        const bookId = getBookId(sourceCard);
        const uniqueKey = bookId || `judul:${normalizeText(title)}`;
        if (!uniqueKey || uniqueCards.has(uniqueKey)) return;
        const card = document.importNode(sourceCard, true);
        card.dataset.catalogCategory = category.key;
        if (bookId) card.dataset.bookId = bookId;
        uniqueCards.set(uniqueKey, card);
      });
    });
    const catalogCards = [...uniqueCards.values()];
    if (!catalogCards.length) {
      console.error('Tidak ada data buku yang berhasil dibaca.');
      return false;
    }
    grid.replaceChildren(...catalogCards);
    return true;
  }
  // Menangani filter kategori tanpa berpindah halaman.
  function handleCategoryClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('[data-category-dropdown] .dropdown__link');
    if (!link || !catalogReady) return;
    const category = getCategoryFromLink(link);
    if (!category) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectedCategory = category.key;
    updateCategoryMenu();
    applyFilters();
    link.closest('details')?.removeAttribute('open');
    const url = new URL(window.location.href);
    url.searchParams.set('kategori', selectedCategory);
    window.history.replaceState({}, '', url);
  }
  // Menangani tombol Cari dan bookmark.
  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const searchButton = target.closest('[data-action="search"]');
    if (searchButton) {
      const query = $('#keyword')?.value || '';
      applyFilters();
      recordSearchActivity(query);
      return;
    }
    const bookmarkButton = target.closest('[data-action="bookmark"]');
    if (bookmarkButton) toggleBookmark(bookmarkButton);
  }
  // Inisialisasi katalog dan fitur pencarian.
  async function initialize() {
    if (!$('.book-grid')) return;
    captureInitialBookmarks();
    selectedCategory = getInitialCategory();
    bookCards = getBookCards();
    bookCards.forEach(card => {
      const id = getBookId(card);
      if (id) card.dataset.bookId = id;
    });
    updateDetailLinks();
    catalogReady = await loadGlobalCatalog();
    bookCards = getBookCards();
    // Jika katalog global gagal, gunakan kartu pada halaman aktif.
    if (!catalogReady) {
      const currentPage = CATEGORY_PAGES.find(item => item.file === getCurrentFile());
      bookCards.forEach(card => {
        card.dataset.catalogCategory = currentPage?.key || 'all';
        const id = getBookId(card);
        if (id) card.dataset.bookId = id;
      });
      selectedCategory = currentPage?.key || 'all';
    }
    updateDetailLinks();
    renderBookmarks();
    updateCategoryMenu();
    applyFilters();
  }
  // Event klik untuk filter kategori.
  document.addEventListener('click', handleCategoryClick, true);
  // Filter langsung saat pengguna mengetik.
  document.addEventListener('input', event => {
    if (event.target.matches('#keyword')) applyFilters();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#keyword')) applyFilters();
  });
  // Event klik untuk tombol Cari dan bookmark.
  document.addEventListener('click', handleClick);
  // Enter juga menjalankan pencarian dan pencatatan aktivitas.
  document.addEventListener('keydown', event => {
    if (event.target.matches('#keyword') && event.key === 'Enter') {
      event.preventDefault();
      const query = $('#keyword')?.value || '';
      applyFilters();
      recordSearchActivity(query);
    }
  });
  // Jalankan inisialisasi setelah HTML selesai dibaca.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();