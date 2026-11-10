
/* KATEGORI TERPOPULER.
   Menghitung jumlah aktivitas pencarian berdasarkan kategori.
   Pencarian dari semua akun pada browser/origin yang sama dijumlahkan.
   Peminjaman tidak dimasukkan dalam perhitungan popularitas. */
(() => {
  'use strict';

  const SEARCH_KEY = 'eperpus_anggota_search_history';
  const CATEGORIES = [
    { key: 'informatika', label: 'Informatika & Komputer', file: 'cari-informatika.html' },
    { key: 'sains', label: 'Sains & Matematika', file: 'cari-sains.html' },
    { key: 'sosial', label: 'Sosial & Bisnis', file: 'cari-sosial.html' },
    { key: 'sastra', label: 'Sastra & Bahasa', file: 'cari-sastra.html' }
  ];

  const $ = selector => document.querySelector(selector);

  // Menyamakan nama kategori dengan kode internal.
  function normalizeCategory(value) {
    const text = String(value || '').normalize('NFKC').toLocaleLowerCase('id').trim();

    if (text.includes('informatika') || text.includes('komputer') || text.includes('sistem informasi')) return 'informatika';
    if (text.includes('sains') || text.includes('matematika')) return 'sains';
    if (text.includes('sosial') || text.includes('bisnis')) return 'sosial';
    if (text.includes('sastra') || text.includes('bahasa')) return 'sastra';

    return '';
  }

  // Membaca seluruh riwayat pencarian dari localStorage.
  function readSearchHistory() {
    try {
      const raw = localStorage.getItem(SEARCH_KEY);
      if (!raw) return [];

      const records = JSON.parse(raw);
      return Array.isArray(records) ? records : [];
    } catch (error) {
      console.error('Riwayat pencarian tidak dapat dibaca:', error);
      return [];
    }
  }

  // Menghitung satu record sebagai satu aktivitas pencarian kategori.
  function calculatePopularCategory(records) {
    const statistics = Object.fromEntries(
      CATEGORIES.map(category => [
        category.key,
        { ...category, totalSearch: 0, latestSearch: 0 }
      ])
    );

    records.forEach(record => {
      if (!record || typeof record !== 'object') return;
      if (!String(record.npm || '').trim()) return;
      if (!String(record.query || '').trim()) return;

      const key = normalizeCategory(
        record.categoryKey || record.kategori || record.category
      );

      if (!key || !statistics[key]) return;

      // Satu record mewakili satu aktivitas pencarian.
      statistics[key].totalSearch += 1;

      const timestamp = new Date(record.createdAt || 0).getTime();

      if (Number.isFinite(timestamp)) {
        statistics[key].latestSearch = Math.max(
          statistics[key].latestSearch,
          timestamp
        );
      }
    });

    // Mengurutkan kategori dari pencarian terbanyak.
    return Object.values(statistics)
      .filter(item => item.totalSearch > 0)
      .sort((a, b) =>
        b.totalSearch - a.totalSearch ||
        b.latestSearch - a.latestSearch ||
        CATEGORIES.findIndex(item => item.key === a.key) -
          CATEGORIES.findIndex(item => item.key === b.key)
      )[0] || null;
  }

  // Menampilkan satu kategori terpopuler.
  function renderPopularCategory() {
    const label = $('[data-popular-category]');
    const link = $('[data-popular-category-link]');

    if (!label || !link) return;

    const popular = calculatePopularCategory(readSearchHistory());

    if (!popular) {
      label.textContent = 'Belum ada data pencarian';
      link.hidden = true;
      link.removeAttribute('href');
      link.removeAttribute('data-route');
      return;
    }

    label.textContent = popular.label;
    link.href = popular.file;
    link.dataset.route = popular.file;
    link.hidden = false;
  }

  // Inisialisasi dan pembaruan otomatis.
  function initialize() {
    renderPopularCategory();

    window.addEventListener('pageshow', renderPopularCategory);
    window.addEventListener('focus', renderPopularCategory);

    window.addEventListener('storage', event => {
      if (event.key === SEARCH_KEY) {
        renderPopularCategory();
      }
    });

    window.addEventListener(
      'eperpus:search-history-updated',
      renderPopularCategory
    );

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderPopularCategory();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
