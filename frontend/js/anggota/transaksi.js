
/* =========================================================
   FITUR ANGGOTA: SIMULASI PEMINJAMAN BUKU
   Data hanya tersimpan di browser, bukan database server.
   ========================================================= */
(() => {
  'use strict';

  const TRANSACTION_KEY = 'eperpus_demo_transactions';
  const $ = (selector, root = document) => root.querySelector(selector);

  // Membaca sesi anggota.
  function readSession() {
    const keys = [
      'eperpus_demo_session',
      'eperpus_anggota_session'
    ];

    for (const key of keys) {
      try {
        const raw = sessionStorage.getItem(key);

        if (raw) return JSON.parse(raw);
      } catch (error) {
        console.error(`Sesi ${key} tidak valid:`, error);
      }
    }

    return null;
  }

  function getTransactions() {
    const records = window.EPerpus?.read(TRANSACTION_KEY, []);
    return Array.isArray(records) ? records : [];
  }

  function getBookTitle() {
    return $('.book-detail__title')?.textContent.trim() || '';
  }

  // Membaca stok dari halaman detail buku.
  function getStock() {
    const stockElement = $('.stock-badge');

    if (!stockElement) return null;

    const match = stockElement.textContent.match(/\d+/);

    return match ? Number(match[0]) : null;
  }

  function setBorrowedState(button) {
    button.disabled = true;
    button.textContent = 'Berhasil dipinjam';
  }

  // Proses peminjaman buku.
  function borrowBook(button) {
    const session = readSession();

    if (!session || !session.npm) {
      window.EPerpus?.notify(
        'Silakan login sebagai anggota sebelum meminjam buku.',
        'error'
      );
      return;
    }

    const title = getBookTitle();

    if (!title) {
      window.EPerpus?.notify('Judul buku tidak ditemukan.', 'error');
      return;
    }

    const stock = getStock();

    if (stock !== null && stock <= 0) {
      window.EPerpus?.notify('Stok buku sedang habis.', 'error');
      return;
    }

    const records = getTransactions();

    // Memeriksa peminjaman aktif dengan anggota dan judul yang sama.
    const duplicate = records.some(record =>
      record.npm === session.npm &&
      record.judul === title &&
      record.status === 'dipinjam'
    );

    if (duplicate) {
      setBorrowedState(button);
      window.EPerpus?.notify(
        'Buku ini masih tercatat dipinjam oleh akun Anda.'
      );
      return;
    }

    const transaction = {
      id: `TRX-${Date.now()}`,
      npm: session.npm,
      anggota: session.nama || 'Anggota',
      judul: title,
      tanggal: new Date().toISOString().slice(0, 10),
      status: 'dipinjam'
    };

    records.push(transaction);

    if (!window.EPerpus?.write(TRANSACTION_KEY, records)) return;

    if (stock !== null) {
      $('.stock-badge').textContent = String(Math.max(0, stock - 1));
    }

    setBorrowedState(button);

    window.EPerpus?.notify(
      'Peminjaman berhasil dicatat pada simulasi browser.'
    );
  }

  // Event click tombol pinjam.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action="borrow"]');

    if (button) {
      borrowBook(button);
    }
  });

  // Memeriksa apakah buku sudah dipinjam ketika halaman dibuka.
  document.addEventListener('DOMContentLoaded', () => {
    const button = $('[data-action="borrow"]');
    const session = readSession();
    const title = getBookTitle();

    if (!button || !session?.npm || !title) return;

    const alreadyBorrowed = getTransactions().some(record =>
      record.npm === session.npm &&
      record.judul === title &&
      record.status === 'dipinjam'
    );

    if (alreadyBorrowed) {
      setBorrowedState(button);
    }
  });
})();
