
/* =========================================================
   E-PERPUSTAKAAN
   PUSTAKAWAN - TRANSAKSI PEMINJAMAN

   Fitur:
   1. Menampilkan transaksi anggota.
   2. Mengambil data anggota dan program studi.
   3. Mencari transaksi.
   4. Mengubah status melalui tombol status.
   5. Menyimpan perubahan ke localStorage.
   6. Mempertahankan status setelah refresh.

   Penyimpanan:
   eperpus_demo_transactions
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const TRANSACTION_KEY = 'eperpus_demo_transactions';
  const ACCOUNT_KEY = 'eperpus_demo_accounts';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const tableBody = $('#transactionTableBody');
  const searchForm = $('#transactionSearchForm');
  const searchInput = $('#keyword');

  let transactions = [];
  let searchKeyword = '';

  // =======================================================
  // 2. DATA DEMO AWAL
  // =======================================================

  const DEMO_TRANSACTIONS = [

    {
      id: 'DEMO-101',
      displayId: '101',
      bookId: '',
      npm: '996',
      anggota: 'Anti',
      prodi: 'Informatika',
      judul: 'C++',
      tanggal: '2026-11-10',
      status: 'dipinjam'
    },

    {
      id: 'DEMO-102',
      displayId: '102',
      bookId: '',
      npm: '995',
      anggota: 'Demak',
      prodi: 'Mesin',
      judul: 'python',
      tanggal: '2026-12-11',
      status: 'dikembalikan'
    },

    {
      id: 'DEMO-103',
      displayId: '103',
      bookId: '',
      npm: '993',
      anggota: 'Muti',
      prodi: 'Ekonomi',
      judul: 'garuda',
      tanggal: '2026-12-12',
      status: 'dipinjam'
    },

    {
      id: 'DEMO-104',
      displayId: '104',
      bookId: '',
      npm: '991',
      anggota: 'Aan',
      prodi: 'Guru (FKIP)',
      judul: 'C++',
      tanggal: '2026-12-13',
      status: 'dipinjam'
    },

    {
      id: 'DEMO-105',
      displayId: '105',
      bookId: '',
      npm: '994',
      anggota: 'Ilham',
      prodi: 'Mesin',
      judul: 'C++',
      tanggal: '2026-12-15',
      status: 'dipinjam'
    }

  ];

  // =======================================================
  // 3. MEMBACA DATA
  // =======================================================

  function readArray(key) {

    try {

      const data = window.EPerpus?.read(key, []);

      if (Array.isArray(data)) return data;

      const raw = localStorage.getItem(key);

      if (!raw) return [];

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];

    } catch (error) {

      console.error(
        `Gagal membaca ${key}:`,
        error
      );

      return [];

    }

  }

  // =======================================================
  // 4. MENYIMPAN DATA
  // =======================================================

  function writeArray(key, data) {

    try {

      if (typeof window.EPerpus?.write === 'function') {

        return window.EPerpus.write(key, data) !== false;

      }

      localStorage.setItem(
        key,
        JSON.stringify(data)
      );

      return true;

    } catch (error) {

      console.error(
        `Gagal menyimpan ${key}:`,
        error
      );

      notify(
        'Penyimpanan browser gagal.',
        'error'
      );

      return false;

    }

  }

  // =======================================================
  // 5. NOTIFIKASI
  // =======================================================

  function notify(message, type = 'info') {

    if (typeof window.EPerpus?.notify === 'function') {

      window.EPerpus.notify(message, type);

    } else {

      window.alert(message);

    }

  }

  // =======================================================
  // 6. INISIALISASI DATA DEMO
  // =======================================================

  function initializeDemoTransactions() {

    // Data demo hanya dibuat jika key belum tersedia.
    // Transaksi anggota yang sudah ada tidak ditimpa.

    if (localStorage.getItem(TRANSACTION_KEY) !== null) {
      return;
    }

    writeArray(
      TRANSACTION_KEY,
      DEMO_TRANSACTIONS.map(item => ({ ...item }))
    );

  }

  // =======================================================
  // 7. DATA ANGGOTA
  // =======================================================

  function getAccounts() {

    return readArray(ACCOUNT_KEY);

  }

  function getMemberInfo(record) {

    const accounts = getAccounts();

    const account = accounts.find(item =>

      String(item.npm || '').trim() ===
      String(record.npm || '').trim()

    );

    return {

      name:
        account?.nama ||
        record.anggota ||
        'Anggota',

      prodi:
        account?.prodi ||
        record.prodi ||
        '-'

    };

  }

  // =======================================================
  // 8. FORMAT TANGGAL
  // =======================================================

  function formatDate(value) {

    const raw = String(value || '').trim();

    if (!raw) return '-';

    // Format YYYY-MM-DD.
    const iso = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (iso) {

      return `${iso[3]}/${iso[2]}/${iso[1]}`;

    }

    // Format tanggal DD/MM/YYYY.
    return raw;

  }

  // =======================================================
  // 9. NORMALISASI STATUS
  // =======================================================

  function normalizeStatus(status) {

    return String(status || 'dipinjam')
      .trim()
      .toLocaleLowerCase('id-ID') === 'dikembalikan'
        ? 'dikembalikan'
        : 'dipinjam';

  }

  // =======================================================
  // 10. MEMUAT TRANSAKSI
  // =======================================================

  function loadTransactions() {

    transactions = readArray(TRANSACTION_KEY).map(record => ({

      ...record,

      status: normalizeStatus(record.status)

    }));

    renderTransactions();

  }

  // =======================================================
  // 11. PENCARIAN
  // =======================================================

  function normalizeText(value) {

    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('id-ID');

  }

  function getFilteredTransactions() {

    const query = normalizeText(searchKeyword);

    if (!query) return [...transactions];

    return transactions.filter(record => {

      const member = getMemberInfo(record);

      const values = [

        record.id,
        record.displayId,
        record.npm,
        member.name,
        member.prodi,
        record.judul,
        record.status,
        record.tanggal

      ];

      return values.some(value =>

        normalizeText(value).includes(query)

      );

    });

  }

  // =======================================================
  // 12. MEMBUAT BADGE ID
  // =======================================================

  function createIdBadge(id) {

    const badge = document.createElement('span');

    badge.className = 'transaction-id';

    badge.textContent = id || '-';

    return badge;

  }

  // =======================================================
  // 13. MEMBUAT BADGE PRODI
  // =======================================================

  function createProgramBadge(prodi) {

    const badge = document.createElement('span');

    badge.className = 'transaction-program';

    badge.textContent = prodi || '-';

    return badge;

  }

  // =======================================================
  // 14. MEMBUAT STATUS INTERAKTIF
  // =======================================================

  function createStatusButton(record) {

    const returned =
      record.status === 'dikembalikan';

    const button = document.createElement('button');

    button.type = 'button';

    button.className = returned

      ? 'transaction-status transaction-status--returned'

      : 'transaction-status transaction-status--borrowed';

    button.dataset.transactionStatus = record.id;

    const dot = document.createElement('span');

    dot.className = 'transaction-status__dot';

    dot.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');

    label.textContent = returned
      ? 'dikembalikan'
      : 'dipinjam';

    button.append(dot, label);

    if (returned) {

      // Status yang selesai tidak bisa ditekan lagi.
      button.disabled = true;

      button.title =
        'Buku sudah dikembalikan';

      button.setAttribute(
        'aria-label',
        'Status buku sudah dikembalikan'
      );

    } else {

      button.dataset.action = 'return-transaction';

      button.title =
        'Tekan untuk menandai buku sudah dikembalikan';

      button.setAttribute(
        'aria-label',
        'Tandai buku sebagai dikembalikan'
      );

      button.setAttribute(
        'aria-pressed',
        'false'
      );

    }

    return button;

  }

  // =======================================================
  // 15. MEMBUAT BARIS TRANSAKSI
  // =======================================================

  function createTransactionRow(record) {

    const row = document.createElement('tr');

    row.dataset.transactionRow = record.id;

    const member = getMemberInfo(record);

    // Kolom ID.
    const idCell = document.createElement('td');

    idCell.appendChild(
      createIdBadge(
        record.displayId || record.id
      )
    );

    // Kolom anggota.
    const memberCell = document.createElement('td');

    const memberName = document.createElement('strong');

    memberName.className =
      'transaction-member-name';

    memberName.textContent = member.name;

    memberCell.appendChild(memberName);

    // Kolom prodi.
    const programCell = document.createElement('td');

    programCell.appendChild(
      createProgramBadge(member.prodi)
    );

    // Kolom buku.
    const bookCell = document.createElement('td');

    const bookTitle = document.createElement('span');

    bookTitle.className =
      'transaction-book-title';

    bookTitle.textContent = record.judul || '-';

    bookCell.appendChild(bookTitle);

    // Kolom tanggal.
    const dateCell = document.createElement('td');

    const date = document.createElement('time');

    date.className = 'transaction-date';

    date.textContent = formatDate(record.tanggal);

    dateCell.appendChild(date);

    // Kolom status interaktif.
    const statusCell = document.createElement('td');

    statusCell.appendChild(
      createStatusButton(record)
    );

    // Memasukkan enam kolom.
    row.append(
      idCell,
      memberCell,
      programCell,
      bookCell,
      dateCell,
      statusCell
    );

    return row;

  }

  // =======================================================
  // 16. MENAMPILKAN TRANSAKSI
  // =======================================================

  function renderTransactions() {

    if (!tableBody) return;

    const filtered = getFilteredTransactions();

    const fragment =
      document.createDocumentFragment();

    if (filtered.length === 0) {

      const row = document.createElement('tr');

      const cell = document.createElement('td');

      cell.colSpan = 6;

      cell.className = 'transaction-empty';

      cell.textContent = transactions.length === 0

        ? 'Belum ada transaksi peminjaman.'

        : 'Transaksi tidak ditemukan.';

      row.appendChild(cell);

      fragment.appendChild(row);

    } else {

      filtered.forEach(record => {

        fragment.appendChild(
          createTransactionRow(record)
        );

      });

    }

    tableBody.replaceChildren(fragment);

  }

  // =======================================================
  // 17. MENGUBAH STATUS PEMINJAMAN
  // =======================================================

  function returnTransaction(transactionId) {

    const record = transactions.find(item =>

      String(item.id) === String(transactionId)

    );

    if (!record) {

      notify(
        'Data transaksi tidak ditemukan.',
        'error'
      );

      return;

    }

    if (record.status === 'dikembalikan') {

      notify(
        'Buku ini sudah tercatat dikembalikan.'
      );

      return;

    }

    const member = getMemberInfo(record);

    const confirmed = window.confirm(

      `Konfirmasi pengembalian buku "${record.judul}" oleh ${member.name}?`

    );

    if (!confirmed) return;

    // Tanggal pengembalian.
    const returnedAt =
      new Date().toISOString().slice(0, 10);

    // Membuat data baru tanpa mengubah transaksi lain.
    const updatedTransactions = transactions.map(item => {

      if (String(item.id) !== String(transactionId)) {

        return item;

      }

      return {

        ...item,

        status: 'dikembalikan',

        tanggalKembali: returnedAt

      };

    });

    // Simpan perubahan.
    const saved = writeArray(
      TRANSACTION_KEY,
      updatedTransactions
    );

    if (!saved) return;

    // Perbarui data lokal.
    transactions = updatedTransactions;

    // Render ulang badge status.
    renderTransactions();

    notify(
      `Buku "${record.judul}" berhasil ditandai sebagai dikembalikan.`
    );

  }

  // =======================================================
  // 18. EVENT KLIK STATUS
  // =======================================================

  function handleStatusClick(event) {

    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest(
      '[data-action="return-transaction"]'
    );

    if (!button || button.disabled) return;

    returnTransaction(
      button.dataset.transactionStatus
    );

  }

  // =======================================================
  // 19. PENCARIAN
  // =======================================================

  function handleSearch(event) {

    event.preventDefault();

    searchKeyword = searchInput?.value || '';

    renderTransactions();

  }

  // =======================================================
  // 20. SINKRONISASI ANTAR TAB
  // =======================================================

  window.addEventListener('storage', event => {

    if (event.key === TRANSACTION_KEY) {

      loadTransactions();

    }

  });

  // =======================================================
  // 21. INISIALISASI
  // =======================================================

  function initialize() {

    if (!tableBody) return;

    initializeDemoTransactions();

    // Pencarian.
    searchForm?.addEventListener(
      'submit',
      handleSearch
    );

    searchInput?.addEventListener(
      'input',
      () => {

        searchKeyword = searchInput.value;

        renderTransactions();

      }
    );

    // Klik badge status.
    tableBody.addEventListener(
      'click',
      handleStatusClick
    );

    // Memuat transaksi.
    loadTransactions();

  }

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
