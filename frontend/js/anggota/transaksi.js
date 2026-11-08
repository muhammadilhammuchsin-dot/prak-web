
/* =========================================================
   E-PERPUSTAKAAN
   MODUL ANGGOTA: TRANSAKSI PEMINJAMAN

   Fitur:
   1. Membaca identitas anggota.
   2. Mengambil ID dan judul buku dari halaman detail.
   3. Memeriksa stok buku jika tersedia.
   4. Mencegah peminjaman buku yang sama secara berulang.
   5. Menyimpan transaksi ke localStorage.
   6. Memperbarui tampilan stok.
   
   Catatan: Ini simulasi lokal, belum terhubung database.
   ========================================================= */

(() => {
  'use strict';

  const TRANSACTION_KEY = 'eperpus_demo_transactions';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  // Membaca sesi anggota yang sedang login.
  function readSession() {
    const keys = [
      'eperpus_demo_session',
      'eperpus_anggota_session'
    ];

    for (const key of keys) {
      try {
        const raw = sessionStorage.getItem(key);

        if (raw) {
          const session = JSON.parse(raw);
          if (session?.npm) return session;
        }
      } catch (error) {
        console.error(`Sesi ${key} tidak valid:`, error);
      }
    }

    return null;
  }

  // Membaca seluruh transaksi.
  function getTransactions() {
    try {
      if (typeof window.EPerpus?.read === 'function') {
        const records = window.EPerpus.read(TRANSACTION_KEY, []);
        return Array.isArray(records) ? records : [];
      }

      const raw = localStorage.getItem(TRANSACTION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('Gagal membaca transaksi:', error);
      return [];
    }
  }

  // Menyimpan transaksi.
  function saveTransactions(records) {
    try {
      if (typeof window.EPerpus?.write === 'function') {
        return window.EPerpus.write(TRANSACTION_KEY, records) !== false;
      }

      localStorage.setItem(
        TRANSACTION_KEY,
        JSON.stringify(records)
      );

      return true;
    } catch (error) {
      console.error('Gagal menyimpan transaksi:', error);
      return false;
    }
  }

  // Mengambil identitas buku dari halaman detail.
  function getCurrentBook() {
    const button = $('[data-action="borrow"]');

    return {
      id: button?.dataset.bookId || '',
      title: button?.dataset.bookTitle ||
        $('[data-book-title]')?.textContent.trim() || ''
    };
  }

  // Membaca stok buku.
  function getStock() {
    const element = $('[data-book-stock]');

    if (!element) return null;

    const match = element.textContent.match(/^\s*(\d+)\s*$/);

    return match ? Number(match[1]) : null;
  }

  // Mengubah tampilan tombol setelah peminjaman.
  function setBorrowedState(button) {
    button.disabled = true;
    button.textContent = 'Berhasil dipinjam';
  }

  // Menghitung jumlah peminjaman aktif berdasarkan ID buku.
  function countActiveBorrowings(records, bookId) {
    return records.filter(record =>
      record.bookId === bookId &&
      record.status === 'dipinjam'
    ).length;
  }

  // Memperbarui stok dan status tombol ketika halaman dibuka.
  function initializeBorrowState() {
    const button = $('[data-action="borrow"]');
    const book = getCurrentBook();

    if (!button || !book.id || !book.title) return;

    const records = getTransactions();
    const session = readSession();

    // Menyimpan stok awal agar perhitungan tidak berulang.
    const currentStock = getStock();

    if (currentStock !== null && button.dataset.baseStock === undefined) {
      button.dataset.baseStock = String(currentStock);
    }

    // Menghitung stok berdasarkan transaksi aktif.
    const baseStock = button.dataset.baseStock === undefined
      ? null
      : Number(button.dataset.baseStock);

    if (baseStock !== null && Number.isFinite(baseStock)) {
      const borrowedCount = countActiveBorrowings(records, book.id);
      const remainingStock = Math.max(0, baseStock - borrowedCount);

      $('[data-book-stock]').textContent = String(remainingStock);

      if (remainingStock <= 0) {
        button.disabled = true;
        button.textContent = 'Stok Buku Habis';
        return;
      }
    }

    // Memeriksa apakah anggota sudah meminjam buku tersebut.
    if (session?.npm) {
      const alreadyBorrowed = records.some(record =>
        record.npm === session.npm &&
        (
          record.bookId === book.id ||
          (!record.bookId && record.judul === book.title)
        ) &&
        record.status === 'dipinjam'
      );

      if (alreadyBorrowed) {
        setBorrowedState(button);
        return;
      }
    }

    button.disabled = false;
  }

  // Proses peminjaman buku.
  function borrowBook(button) {
    const session = readSession();

    // Memastikan anggota sudah login.
    if (!session || !session.npm) {
      window.EPerpus?.notify(
        'Silakan login sebagai anggota sebelum meminjam buku.',
        'error'
      );
      return;
    }

    const book = getCurrentBook();

    // Memastikan identitas buku tersedia.
    if (!book.id || !book.title) {
      window.EPerpus?.notify(
        'Identitas buku tidak ditemukan.',
        'error'
      );
      return;
    }

    const records = getTransactions();
    const stock = getStock();

    // Memeriksa stok buku.
    if (stock !== null && stock <= 0) {
      window.EPerpus?.notify(
        'Stok buku sedang habis.',
        'error'
      );
      return;
    }

    // Mencegah anggota meminjam buku yang sama dua kali.
    const duplicate = records.some(record =>
      record.npm === session.npm &&
      (
        record.bookId === book.id ||
        (!record.bookId && record.judul === book.title)
      ) &&
      record.status === 'dipinjam'
    );

    if (duplicate) {
      setBorrowedState(button);

      window.EPerpus?.notify(
        'Buku ini masih tercatat dipinjam oleh akun Anda.',
        'error'
      );
      return;
    }

    // Membuat data transaksi baru.
    const transaction = {
      id: `TRX-${Date.now()}`,
      bookId: book.id,
      npm: session.npm,
      anggota: session.nama || 'Anggota',
      judul: book.title,
      tanggal: new Date().toISOString().slice(0, 10),
      status: 'dipinjam'
    };

    records.push(transaction);

    // Menyimpan transaksi.
    if (!saveTransactions(records)) {
      window.EPerpus?.notify(
        'Transaksi gagal disimpan.',
        'error'
      );
      return;
    }

    // Mengurangi stok apabila informasi stok tersedia.
    if (stock !== null) {
      $('[data-book-stock]').textContent = String(stock - 1);
    }

    setBorrowedState(button);

    window.EPerpus?.notify(
      stock === null
        ? 'Peminjaman tercatat dalam simulasi. Stok belum dapat divalidasi.'
        : 'Peminjaman buku berhasil dicatat.'
    );
  }

  // Menangani klik tombol peminjaman.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target
      : null;

    const button = target?.closest('[data-action="borrow"]');

    if (button && !button.disabled) {
      borrowBook(button);
    }
  });

  // Memeriksa status peminjaman setelah detail buku selesai dimuat.
  document.addEventListener(
    'eperpus:book-loaded',
    initializeBorrowState
  );

  // Inisialisasi saat halaman selesai dimuat.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initializeBorrowState
    );
  } else {
    initializeBorrowState();
  }
})();
