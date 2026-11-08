
/* =========================================================
   E-PERPUSTAKAAN
   MODUL KEPALA PERPUSTAKAAN: LAPORAN DINAMIS

   FITUR:
   1. Mengambil jumlah anggota dari akun terdaftar.
   2. Mengambil jumlah buku dari empat katalog kategori.
   3. Menggabungkan buku tambahan dari localStorage.
   4. Menghitung transaksi berdasarkan periode.
   5. Mengelompokkan transaksi berdasarkan kategori buku.
   6. Memperbarui diagram donat dan diagram batang.
   7. Memvalidasi pilihan periode laporan.
   8. Memperbarui laporan ketika data berubah di tab lain.

   CATATAN:
   - Data masih berasal dari localStorage dan file HTML.
   - Belum menggunakan database MySQL.
   - Belum ada data preferensi minat baca anggota.
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const STORAGE_KEYS = {
    members: 'eperpus_demo_accounts',
    deletedMembers: 'eperpus_demo_deleted_members',
    books: 'eperpus_demo_books',
    deletedBooks: 'eperpus_demo_deleted_books',
    transactions: 'eperpus_demo_transactions'
  };

  // Empat sumber katalog yang tersedia dalam proyek.
  const CATEGORY_PAGES = [
    'cari-informatika.html',
    'cari-sains.html',
    'cari-sosial.html',
    'cari-sastra.html'
  ];

  // Urutan kategori mengikuti diagram donat.
  const CATEGORIES = [
    {
      key: 'informatika',
      label: 'Teknologi & Informatika',
      color: '#0b2a6f'
    },
    {
      key: 'sains',
      label: 'Sains & Matematika',
      color: '#2563eb'
    },
    {
      key: 'sosial',
      label: 'Sosial & Bisnis',
      color: '#38bdf8'
    },
    {
      key: 'sastra',
      label: 'Sastra & Bahasa',
      color: '#94a3b8'
    }
  ];

  // Urutan batang pada diagram.
  const BAR_CATEGORY_ORDER = [
    'informatika',
    'sains',
    'sastra',
    'sosial'
  ];

  // Konversi nama bulan ke angka.
  const MONTHS = {
    januari: '01',
    februari: '02',
    maret: '03',
    april: '04',
    mei: '05',
    juni: '06',
    juli: '07',
    agustus: '08',
    september: '09',
    oktober: '10',
    november: '11',
    desember: '12'
  };

  // Mengambil satu elemen HTML.
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Mengambil seluruh elemen HTML.
  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const periodSelect = $('#period');

  // Variabel penyimpanan data laporan.
  let catalogMap = new Map();
  let catalogComplete = false;
  let lastValidPeriod = '';

  // =======================================================
  // 2. FUNGSI PENYIMPANAN
  // =======================================================

  // Membaca array dari localStorage dengan pemeriksaan format.
  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) return [];

      const value = JSON.parse(raw);

      if (!Array.isArray(value)) {
        console.warn(`Format penyimpanan ${key} bukan array.`);
        return [];
      }

      return value;
    } catch (error) {
      console.error(`Gagal membaca ${key}:`, error);
      return [];
    }
  }

  // Menghitung anggota unik berdasarkan NPM.
  function countMembers() {
    const accounts = readArray(STORAGE_KEYS.members);

    const deleted = new Set(
      readArray(STORAGE_KEYS.deletedMembers).map(String)
    );

    const uniqueMembers = new Set();

    accounts.forEach(account => {
      const npm = String(account?.npm || '').trim();

      if (npm && !deleted.has(npm)) {
        uniqueMembers.add(npm);
      }
    });

    return uniqueMembers.size;
  }

  // =======================================================
  // 3. NORMALISASI DAN IDENTIFIKASI KATEGORI
  // =======================================================

  // Menyamakan format teks.
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('id')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Mengelompokkan kategori buku ke empat kategori laporan.
  function classifyCategory(value) {
    const category = normalizeText(value);

    if (!category) return '';

    if (
      category.includes('sains') ||
      category.includes('matematika')
    ) {
      return 'sains';
    }

    if (
      category.includes('sosial') ||
      category.includes('bisnis')
    ) {
      return 'sosial';
    }

    if (
      category.includes('sastra') ||
      category.includes('bahasa')
    ) {
      return 'sastra';
    }

    // Informatika, sistem informasi, dan teknologi
    // dikelompokkan ke kategori Informatika.
    if (
      category.includes('informatika') ||
      category.includes('teknologi') ||
      category.includes('komputer') ||
      category.includes('sistem informasi')
    ) {
      return 'informatika';
    }

    return '';
  }

  // Mengambil ID buku dari data kartu katalog.
  function extractBookId(card) {
    const storedId = card.dataset.bookId?.trim();

    if (storedId) return storedId;

    // Mengambil ID dari label sampul.
    const coverLabel =
      $('.cover__label', card)?.textContent || '';

    const labelMatch = coverLabel.match(
      /\bID\s*:\s*(\d+)\b/i
    );

    if (labelMatch) return labelMatch[1];

    // Mengambil ID dari nama file gambar.
    const imagePath =
      $('.cover__image', card)?.getAttribute('src') || '';

    const imageMatch = imagePath.match(
      /(?:^|\/)(\d+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i
    );

    return imageMatch ? imageMatch[1] : '';
  }

  // =======================================================
  // 4. MEMUAT KATALOG BUKU
  // =======================================================

  // Mengambil buku dari empat halaman kategori.
  async function loadCatalog() {
    const results = await Promise.all(
      CATEGORY_PAGES.map(async file => {
        const url = new URL(
          `../anggota/${file}`,
          window.location.href
        );

        try {
          const response = await fetch(url.href, {
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();

          // Membaca HTML tanpa menjalankan script sumber.
          const parsedDocument = new DOMParser()
            .parseFromString(html, 'text/html');

          return {
            file,
            document: parsedDocument
          };
        } catch (error) {
          console.error(
            `Gagal memuat katalog ${file}:`,
            error
          );

          return null;
        }
      })
    );

    const successfulPages = results.filter(Boolean);
    const books = new Map();

    // Membaca kartu buku dari setiap halaman kategori.
    successfulPages.forEach(({ document: sourceDocument }) => {
      const cards = $$('.book-grid .book-card', sourceDocument);

      cards.forEach(card => {
        const id = extractBookId(card);

        const title = normalizeText(
          $('.book-card__title', card)?.textContent
        );

        const categoryText = normalizeText(
          $('.tag', card)?.textContent
        );

        if (!id || !title) return;

        books.set(id, {
          id,
          judul: title,
          kategori: categoryText,
          categoryKey: classifyCategory(categoryText)
        });
      });
    });

    // Menggabungkan buku yang ditambah atau diedit pustakawan.
    readArray(STORAGE_KEYS.books).forEach(book => {
      const id = String(book?.id || '').trim();

      if (!id) return;

      const category = String(book.kategori || '');

      books.set(id, {
        id,
        judul: normalizeText(book.judul),
        kategori: category,
        categoryKey: classifyCategory(category)
      });
    });

    // Mengeluarkan buku yang telah dihapus pustakawan.
    const deletedBooks = new Set(
      readArray(STORAGE_KEYS.deletedBooks).map(String)
    );

    deletedBooks.forEach(id => books.delete(id));

    catalogMap = books;

    // Katalog lengkap jika empat halaman berhasil dibaca.
    catalogComplete =
      successfulPages.length === CATEGORY_PAGES.length;

    return {
      books: catalogMap,
      complete: catalogComplete,
      failedPages:
        CATEGORY_PAGES.length - successfulPages.length
    };
  }

  // Menghitung jumlah buku yang masih tercatat.
  function countBooks() {
    return catalogMap.size;
  }

  // =======================================================
  // 5. PENGATURAN PERIODE
  // =======================================================

  // Mengubah label bulan menjadi format YYYY-MM.
  function getPeriodValue(label) {
    const match = String(label || '')
      .trim()
      .toLocaleLowerCase('id')
      .match(/^([a-z]+)\s+(\d{4})$/);

    if (!match) return '';

    const month = MONTHS[match[1]];

    if (!month) return '';

    return `${match[2]}-${month}`;
  }

  // Mengatur value option dan memilih bulan berjalan.
  function initializePeriodOptions() {
    if (!periodSelect) return false;

    const validOptions = [];

    [...periodSelect.options].forEach(option => {
      const period = getPeriodValue(option.textContent);

      if (!period) {
        option.disabled = true;
        return;
      }

      option.value = period;
      validOptions.push(option);
    });

    if (validOptions.length === 0) {
      periodSelect.disabled = true;
      return false;
    }

    const now = new Date();

    const currentPeriod = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0')
    ].join('-');

    const currentOption = validOptions.find(
      option => option.value === currentPeriod
    );

    // Jika bulan berjalan tersedia, pilih bulan tersebut.
    // Jika tidak, gunakan periode pertama pada HTML.
    const selectedOption = currentOption || validOptions[0];

    selectedOption.selected = true;
    lastValidPeriod = selectedOption.value;

    periodSelect.disabled = false;

    return true;
  }

  // Memvalidasi format periode yang dipilih.
  function isValidPeriod(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
      [...periodSelect.options].some(
        option => option.value === value && !option.disabled
      );
  }

  // =======================================================
  // 6. PENGOLAHAN TRANSAKSI
  // =======================================================

  // Mengambil periode dari tanggal transaksi.
  function getTransactionPeriod(record) {
    const dateValue = String(
      record?.tanggal || record?.date || ''
    ).trim();

    // Format utama transaksi: YYYY-MM-DD.
    const match = dateValue.match(/^(\d{4})-(\d{2})-\d{2}/);

    if (match) {
      return `${match[1]}-${match[2]}`;
    }

    // Fallback untuk tanggal yang dapat dibaca Date.
    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return [
      parsedDate.getFullYear(),
      String(parsedDate.getMonth() + 1).padStart(2, '0')
    ].join('-');
  }

  // Mencari kategori berdasarkan ID atau judul buku.
  function getTransactionCategory(record) {
    const bookId = String(
      record?.bookId || record?.idBuku || ''
    ).trim();

    if (bookId && catalogMap.has(bookId)) {
      return catalogMap.get(bookId).categoryKey;
    }

    // Jika transaksi lama tidak menyimpan ID buku,
    // pencarian kategori dilakukan menggunakan judul.
    const title = normalizeText(record?.judul);

    if (title) {
      const foundBook = [...catalogMap.values()].find(book =>
        normalizeText(book.judul) === title
      );

      if (foundBook) {
        return foundBook.categoryKey;
      }
    }

    // Fallback jika transaksi menyimpan kategori.
    return classifyCategory(
      record?.kategori || record?.category
    );
  }

  // Mengolah transaksi sesuai periode yang dipilih.
  function calculateReport(period) {
    const transactions = readArray(STORAGE_KEYS.transactions);

    const periodTransactions = transactions.filter(record =>
      getTransactionPeriod(record) === period
    );

    const counts = {
      informatika: 0,
      sains: 0,
      sosial: 0,
      sastra: 0
    };

    let unclassified = 0;

    periodTransactions.forEach(record => {
      const category = getTransactionCategory(record);

      if (
        Object.prototype.hasOwnProperty.call(counts, category)
      ) {
        counts[category]++;
      } else {
        unclassified++;
      }
    });

    return {
      total: periodTransactions.length,
      counts,
      unclassified,
      classified: periodTransactions.length - unclassified
    };
  }

  // =======================================================
  // 7. FEEDBACK PERIODE LAPORAN
  // =======================================================

  // Menampilkan informasi kepada pengguna.
  function showFeedback(message, type = 'info') {
    let feedback = $('[data-report-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.reportFeedback = 'true';
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');

      periodSelect?.closest('section')?.appendChild(feedback);
    }

    if (!feedback) return;

    feedback.textContent = message;
    feedback.dataset.type = type;
  }

  // Membuat teks persentase tanpa angka desimal.
  function formatPercent(value) {
    return `${Math.round(value)}%`;
  }

  // =======================================================
  // 8. MEMPERBARUI RINGKASAN
  // =======================================================

  function renderSummary() {
    const values = $$('.stats .stat-card__value');

    // Menghitung akun anggota yang terdaftar.
    if (values[0]) {
      values[0].textContent =
        String(countMembers()).padStart(3, '0');
    }

    // Menampilkan jumlah buku jika seluruh katalog dimuat.
    if (values[1]) {
      values[1].textContent = catalogComplete
        ? countBooks().toLocaleString('id-ID')
        : '—';
    }
  }

  // =======================================================
  // 9. MEMPERBARUI DIAGRAM DONAT
  // =======================================================

  function renderDonut(report) {
    const donut = $('.donut');
    const hole = $('.donut__hole');
    const legendItems = $$('.legend__item');

    if (!donut || !hole) return;

    const total = report.total;

    // Bagian tengah donat menampilkan total transaksi.
    hole.textContent = total > 0 ? '100%' : '0%';

    donut.setAttribute(
      'aria-label',
      `Diagram distribusi ${total} transaksi peminjaman berdasarkan kategori`
    );

    let accumulated = 0;
    const gradientParts = [];

    CATEGORIES.forEach(category => {
      const count = report.counts[category.key];

      const percentage = total > 0
        ? (count / total) * 100
        : 0;

      const start = accumulated;
      accumulated += percentage;

      if (percentage > 0) {
        gradientParts.push(
          `${category.color} ${start}% ${accumulated}%`
        );
      }

      // Memperbarui angka persentase pada legenda.
      const legendItem = legendItems.find(item =>
        normalizeText(item.textContent).includes(
          normalizeText(category.label)
        )
      );

      if (legendItem) {
        const value = $('strong', legendItem);

        if (value) {
          value.textContent = formatPercent(percentage);
        }

        legendItem.title = `${count} transaksi peminjaman`;
      }
    });

    // Sisa diagram berwarna abu-abu untuk transaksi
    // yang kategorinya belum dapat diidentifikasi.
    if (accumulated < 100) {
      gradientParts.push(
        `#e2e8f0 ${accumulated}% 100%`
      );
    }

    if (gradientParts.length === 0) {
      donut.style.background =
        'conic-gradient(#e2e8f0 0% 100%)';
    } else {
      donut.style.background =
        `conic-gradient(${gradientParts.join(', ')})`;
    }
  }

  // =======================================================
  // 10. MEMPERBARUI DIAGRAM BATANG
  // =======================================================

  function renderBarChart(report) {
    const chart = $('.bar-chart');

    if (!chart) return;

    const items = $$('.bar-chart__item', chart);
    const labels = $$('.bar-chart__labels li', chart);

    BAR_CATEGORY_ORDER.forEach((categoryKey, index) => {
      const count = report.counts[categoryKey] || 0;

      // Persentase merupakan proporsi terhadap seluruh
      // transaksi peminjaman pada periode yang dipilih.
      const percentage = report.total > 0
        ? (count / report.total) * 100
        : 0;

      const item = items[index];

      if (item) {
        const percentageLabel = $('span:first-child', item);
        const bar = $('.bar-chart__bar', item);

        if (percentageLabel) {
          percentageLabel.textContent =
            formatPercent(percentage);
        }

        if (bar) {
          bar.style.height = `${percentage}%`;
          bar.style.minHeight = '0';
          bar.setAttribute('aria-hidden', 'true');
          bar.title = `${count} transaksi`;
        }
      }

      // Memperbarui jumlah transaksi di bawah batang.
      const label = labels[index];
      const note = $('.bar-chart__note', label || document);

      if (note) {
        note.textContent = `${count} transaksi`;
      }
    });

    chart.setAttribute(
      'aria-label',
      `Diagram distribusi ${report.total} transaksi peminjaman berdasarkan kategori`
    );
  }

  // =======================================================
  // 11. MEMPERBARUI JUDUL DIAGRAM
  // =======================================================

  function updateChartHeading() {
    const panels = $$('.page > .panel');
    const chartPanel = panels[1];

    const heading = $('.panel__title', chartPanel || document);

    // Data yang tersedia adalah transaksi, bukan preferensi baca.
    if (heading) {
      heading.textContent =
        'Distribusi peminjaman berdasarkan kategori';
    }
  }

  // =======================================================
  // 12. RENDER SELURUH LAPORAN
  // =======================================================

  function renderReport() {
    if (!periodSelect) return;

    const period = periodSelect.value;

    // Validasi pilihan periode sebelum menghitung laporan.
    if (!isValidPeriod(period)) {
      showFeedback(
        'Periode tidak valid. Pilih salah satu periode yang tersedia.',
        'error'
      );

      periodSelect.value = lastValidPeriod;
      return;
    }

    lastValidPeriod = period;

    const report = calculateReport(period);

    const selectedLabel =
      periodSelect.options[periodSelect.selectedIndex]
        ?.textContent.trim() || period;

    // Memperbarui angka ringkasan.
    renderSummary();

    // Memperbarui diagram.
    renderDonut(report);
    renderBarChart(report);
    updateChartHeading();

    // Menyampaikan hasil periode yang sedang dipilih.
    let message =
      `Periode ${selectedLabel}: ${report.total} transaksi peminjaman.`;

    if (report.unclassified > 0) {
      message +=
        ` ${report.unclassified} transaksi belum dapat dipetakan ke kategori buku.`;
    }

    if (!catalogComplete) {
      message +=
        ' Sebagian katalog gagal dimuat; jumlah total buku belum dapat dipastikan.';
    }

    showFeedback(message);
  }

  // =======================================================
  // 13. EVENT CHANGE PERIODE
  // =======================================================

  function handlePeriodChange() {
    renderReport();
  }

  // =======================================================
  // 14. PEMBARUAN KETIKA DATA BERUBAH DI TAB LAIN
  // =======================================================

  async function refreshReport() {
    await loadCatalog();
    renderReport();
  }

  // Event storage berjalan ketika tab lain mengubah data.
  window.addEventListener('storage', event => {
    const watchedKeys = Object.values(STORAGE_KEYS);

    if (
      event.key === null ||
      watchedKeys.includes(event.key)
    ) {
      refreshReport();
    }
  });

  // =======================================================
  // 15. INISIALISASI
  // =======================================================

  async function initialize() {
    if (!periodSelect) {
      console.error(
        'Elemen #period tidak ditemukan pada halaman laporan.'
      );
      return;
    }

    // Mengganti angka statis dengan indikator pemuatan.
    const summaryValues = $$('.stats .stat-card__value');

    summaryValues.forEach(value => {
      value.textContent = 'Memuat...';
    });

    $('.donut__hole')?.replaceChildren(
      document.createTextNode('...')
    );

    // Menyiapkan pilihan periode.
    if (!initializePeriodOptions()) {
      showFeedback(
        'Pilihan periode laporan tidak valid.',
        'error'
      );
      return;
    }

    // Mengambil katalog sebelum menghitung transaksi.
    const catalogResult = await loadCatalog();

    // Mengaktifkan pilihan periode.
    periodSelect.disabled = false;

    // Event change memperbarui laporan sesuai periode.
    periodSelect.addEventListener(
      'change',
      handlePeriodChange
    );

    // Menampilkan laporan pertama.
    renderReport();

    // Mencatat jika ada halaman katalog yang gagal dimuat.
    if (!catalogResult.complete) {
      console.warn(
        `${catalogResult.failedPages} halaman katalog gagal dimuat.`
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
