
/* =====================================================
   PUSTAKAWAN - DATA BUKU

   Sumber data:
   IndexedDB yang sama dengan halaman Tambah Buku
   dan Beranda Pustakawan.

   Database : eperpus_pustakawan
   Store    : books
   Key Path : id_buku

   Belum menggunakan backend / MySQL.
   ===================================================== */

(() => {
  'use strict';

  // ===================================================
  // 1. KONFIGURASI
  // ===================================================

  const DB_NAME = 'eperpus_pustakawan';
  const DB_VERSION = 1;
  const STORE_NAME = 'books';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const tableBody = $('#bookTableBody');
  const countLabel = $('#bookCount');
  const searchForm = $('#bookSearchForm');
  const searchInput = $('#bookSearchInput');
  const feedback = $('#bookFeedback');

  const editDialog = $('#editBookDialog');
  const editForm = $('#editBookForm');
  const editCode = $('#editBookCode');
  const editTitle = $('#editBookName');
  const editCategory = $('#editBookCategory');
  const editStock = $('#editBookStock');
  const editFeedback = $('#editBookFeedback');

  let books = [];
  let editingBookId = null;

  // ===================================================
  // 2. KONEKSI INDEXEDDB
  // ===================================================

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('Browser tidak mendukung IndexedDB.'));
        return;
      }

      const request = indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: 'id_buku'
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(
          request.error ||
          new Error('Database gagal dibuka.')
        );
      };
    });
  }

  // ===================================================
  // 3. MENGAMBIL SELURUH DATA BUKU
  // ===================================================

  async function getAllBooks() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readonly'
      );

      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      let result = [];

      request.onsuccess = () => {
        result = request.result || [];
      };

      request.onerror = () => {
        db.close();

        reject(
          request.error ||
          new Error('Data buku gagal dibaca.')
        );
      };

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ||
          new Error('Pembacaan data dibatalkan.')
        );
      };
    });
  }

  // ===================================================
  // 4. MEMPERBARUI DATA BUKU
  // ===================================================

  async function updateBook(oldId, updatedData) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readwrite'
      );

      const store = transaction.objectStore(STORE_NAME);

      let operationError = null;

      const oldRequest = store.get(oldId);

      oldRequest.onsuccess = () => {
        const oldBook = oldRequest.result;

        if (!oldBook) {
          operationError = new Error(
            'Data buku tidak ditemukan.'
          );

          transaction.abort();
          return;
        }

        const newId = updatedData.id_buku;

        const updatedBook = {
          ...oldBook,
          ...updatedData
        };

        // Jika ID tidak berubah, langsung perbarui.
        if (newId === oldId) {
          store.put(updatedBook);
          return;
        }

        // Periksa apakah ID baru sudah digunakan.
        const duplicateRequest = store.get(newId);

        duplicateRequest.onsuccess = () => {
          if (duplicateRequest.result) {
            operationError = new Error(
              'ID buku sudah digunakan.'
            );

            transaction.abort();
            return;
          }

          // Hapus ID lama dan simpan ID baru.
          store.delete(oldId);
          store.put(updatedBook);
        };

        duplicateRequest.onerror = () => {
          operationError = duplicateRequest.error;
          transaction.abort();
        };
      };

      oldRequest.onerror = () => {
        operationError = oldRequest.error;
        transaction.abort();
      };

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onabort = () => {
        db.close();

        reject(
          operationError ||
          transaction.error ||
          new Error('Perubahan data gagal disimpan.')
        );
      };
    });
  }

  // ===================================================
  // 5. MENGHAPUS DATA BUKU
  // ===================================================

  async function deleteBookFromDatabase(bookId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        'readwrite'
      );

      const store = transaction.objectStore(STORE_NAME);

      store.delete(bookId);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ||
          new Error('Buku gagal dihapus.')
        );
      };
    });
  }

  // ===================================================
  // 6. MENYESUAIKAN FORMAT DATA DATABASE
  // ===================================================

  function normalizeBook(record) {
    return {
      id: String(record.id_buku ?? ''),
      title: String(record.judul ?? 'Tanpa judul'),
      author: String(record.penulis ?? ''),
      category: String(record.kategori ?? 'Belum dikategorikan'),
      stock: Number(record.stok) || 0,
      description: String(record.deskripsi ?? '')
    };
  }

  // ===================================================
  // 7. MEMUAT DATA KE HALAMAN
  // ===================================================

  async function loadBooks() {
    const records = await getAllBooks();

    books = records
      .filter(record =>
        record &&
        record.id_buku !== undefined &&
        record.id_buku !== null
      )
      .map(normalizeBook)
      .sort((a, b) =>
        a.id.localeCompare(b.id, 'id', {
          numeric: true
        })
      );

    renderTable();
  }

  // ===================================================
  // 8. PENCARIAN BUKU
  // ===================================================

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('id-ID');
  }

  function getFilteredBooks() {
    const keyword = normalize(searchInput?.value);

    if (!keyword) return books;

    return books.filter(book => {
      return [
        book.id,
        book.title,
        book.category
      ].some(value =>
        normalize(value).includes(keyword)
      );
    });
  }

  // ===================================================
  // 9. MEMBUAT IKON SVG
  // ===================================================

  function createIcon(symbolId) {
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');

    const use = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'use'
    );

    use.setAttribute('href', `#${symbolId}`);

    svg.appendChild(use);

    return svg;
  }

  // ===================================================
  // 10. MEMBUAT TOMBOL AKSI
  // ===================================================

  function createActionButton({
    action,
    label,
    symbol,
    variant,
    bookId
  }) {
    const button = document.createElement('button');

    button.type = 'button';

    button.className =
      `db-action-button db-action-button--${variant}`;

    button.dataset[action] = bookId;

    button.setAttribute(
      'aria-label',
      `${label} buku ${bookId}`
    );

    button.append(
      createIcon(symbol),
      document.createTextNode(label)
    );

    return button;
  }

  // ===================================================
  // 11. MEMBUAT BARIS TABEL
  // ===================================================

  function createBookRow(book) {
    const row = document.createElement('tr');

    // KODE BUKU
    const codeCell = document.createElement('td');

    const code = document.createElement('span');

    code.className = 'db-book-code';
    code.textContent = book.id;

    codeCell.appendChild(code);

    // JUDUL BUKU
    const titleCell = document.createElement('td');

    const title = document.createElement('span');

    title.className = 'db-book-title';
    title.textContent = book.title;

    titleCell.appendChild(title);

    // KATEGORI
    const categoryCell = document.createElement('td');

    const category = document.createElement('span');

    category.className = 'db-category';

    if (normalize(book.category).includes('sosial')) {
      category.classList.add('db-category--social');
    }

    const dot = document.createElement('span');

    dot.className = 'db-category__dot';
    dot.setAttribute('aria-hidden', 'true');

    const categoryText = document.createElement('span');

    categoryText.textContent = book.category;

    category.append(dot, categoryText);

    categoryCell.appendChild(category);

    // STOK
    const stockCell = document.createElement('td');

    const stock = document.createElement('span');

    stock.className = 'db-stock';

    if (book.stock <= 0) {
      stock.classList.add('db-stock--empty');
      stock.textContent = '0 (Habis)';
    } else {
      stock.textContent = `${book.stock} Eks`;
    }

    stockCell.appendChild(stock);

    // AKSI
    const actionCell = document.createElement('td');

    const actions = document.createElement('div');

    actions.className = 'db-actions';

    actions.append(
      createActionButton({
        action: 'editBook',
        label: 'Edit',
        symbol: 'i-edit',
        variant: 'edit',
        bookId: book.id
      }),

      createActionButton({
        action: 'deleteBook',
        label: 'Hapus',
        symbol: 'i-trash',
        variant: 'delete',
        bookId: book.id
      })
    );

    actionCell.appendChild(actions);

    row.append(
      codeCell,
      titleCell,
      categoryCell,
      stockCell,
      actionCell
    );

    return row;
  }

  // ===================================================
  // 12. MENAMPILKAN TABEL
  // ===================================================

  function renderTable() {
    if (!tableBody) return;

    const filteredBooks = getFilteredBooks();

    const fragment = document.createDocumentFragment();

    if (filteredBooks.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');

      cell.colSpan = 5;
      cell.className = 'db-empty';

      cell.textContent = books.length === 0
        ? 'Belum ada data buku tersimpan. Silakan tambahkan buku terlebih dahulu.'
        : 'Buku yang dicari tidak ditemukan.';

      row.appendChild(cell);
      fragment.appendChild(row);
    } else {
      filteredBooks.forEach(book => {
        fragment.appendChild(createBookRow(book));
      });
    }

    tableBody.replaceChildren(fragment);

    if (countLabel) {
      countLabel.textContent =
        `Menampilkan ${filteredBooks.length} dari ${books.length} buku`;
    }
  }

  // ===================================================
  // 13. NOTIFIKASI
  // ===================================================

  function showFeedback(message, type = 'success') {
    if (!feedback) return;

    feedback.textContent = message;
    feedback.hidden = !message;

    feedback.classList.toggle(
      'db-feedback--error',
      type === 'error'
    );
  }

  function showEditFeedback(message) {
    if (!editFeedback) return;

    editFeedback.textContent = message;
    editFeedback.hidden = !message;
  }

  // ===================================================
  // 14. MEMBUKA FORM EDIT
  // ===================================================

  function openEditDialog(bookId) {
    const book = books.find(item => item.id === bookId);

    if (!book || !editDialog || !editForm) return;

    editingBookId = book.id;

    editCode.value = book.id;
    editTitle.value = book.title;
    editStock.value = String(book.stock);

    // Memastikan kategori lama tersedia di dropdown.
    const categoryExists = Array.from(
      editCategory.options
    ).some(option => option.value === book.category);

    if (!categoryExists) {
      const option = document.createElement('option');

      option.value = book.category;
      option.textContent = book.category;

      editCategory.appendChild(option);
    }

    editCategory.value = book.category;

    showEditFeedback('');

    if (typeof editDialog.showModal === 'function') {
      editDialog.showModal();
      editCode.focus();
    }
  }

  // ===================================================
  // 15. MENUTUP FORM EDIT
  // ===================================================

  function closeEditDialog() {
    if (editDialog?.open) {
      editDialog.close();
    }

    editingBookId = null;

    showEditFeedback('');
  }

  // ===================================================
  // 16. MENYIMPAN PERUBAHAN EDIT
  // ===================================================

  async function saveEditedBook(event) {
    event.preventDefault();

    if (!editingBookId) return;

    const oldId = editingBookId;

    const newId = editCode.value.trim().toUpperCase();
    const newTitle = editTitle.value.trim();
    const newCategory = editCategory.value;

    const stockValue = editStock.value.trim();
    const newStock = Number(stockValue);

    // Validasi kolom.
    if (
      !newId ||
      !newTitle ||
      !newCategory ||
      stockValue === ''
    ) {
      showEditFeedback(
        'Lengkapi seluruh kolom sebelum menyimpan.'
      );

      return;
    }

    // Validasi ID.
    if (!/^[A-Z0-9_-]+$/.test(newId)) {
      showEditFeedback(
        'Kode buku hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.'
      );

      return;
    }

    // Validasi stok.
    if (
      !Number.isSafeInteger(newStock) ||
      newStock < 0
    ) {
      showEditFeedback(
        'Stok harus berupa bilangan bulat nol atau lebih.'
      );

      return;
    }

    const saveButton = $('.db-dialog__save', editForm);

    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Menyimpan...';
      }

      // Simpan perubahan langsung ke IndexedDB.
      await updateBook(oldId, {
        id_buku: newId,
        judul: newTitle,
        kategori: newCategory,
        stok: newStock
      });

      closeEditDialog();

      // Ambil ulang data terbaru.
      await loadBooks();

      showFeedback(
        `Data buku ${newId} berhasil diperbarui.`
      );

    } catch (error) {
      console.error('Gagal mengedit buku:', error);

      showEditFeedback(
        error.message || 'Perubahan buku gagal disimpan.'
      );

    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Simpan Perubahan';
      }
    }
  }

  // ===================================================
  // 17. MENGHAPUS BUKU
  // ===================================================

  async function deleteBook(bookId) {
    const book = books.find(item => item.id === bookId);

    if (!book) return;

    const confirmed = window.confirm(
      `Hapus buku "${book.title}" dari inventaris?`
    );

    if (!confirmed) return;

    try {
      await deleteBookFromDatabase(bookId);

      await loadBooks();

      showFeedback(
        `Buku ${bookId} berhasil dihapus dari penyimpanan.`
      );

    } catch (error) {
      console.error('Gagal menghapus buku:', error);

      showFeedback(
        error.message || 'Buku gagal dihapus.',
        'error'
      );
    }
  }

  // ===================================================
  // 18. EVENT TOMBOL TABEL
  // ===================================================

  function handleTableClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const editButton = target.closest('[data-edit-book]');

    if (editButton) {
      openEditDialog(editButton.dataset.editBook);
      return;
    }

    const deleteButton = target.closest('[data-delete-book]');

    if (deleteButton) {
      deleteBook(deleteButton.dataset.deleteBook);
    }
  }

  // ===================================================
  // 19. INISIALISASI HALAMAN
  // ===================================================

  async function initialize() {
    if (!tableBody || !searchForm) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="db-loading">
          Memuat data buku...
        </td>
      </tr>
    `;

    // Pencarian.
    searchForm.addEventListener('submit', event => {
      event.preventDefault();

      renderTable();
      showFeedback('');
    });

    searchInput?.addEventListener('input', renderTable);

    // Tombol tabel.
    tableBody.addEventListener('click', handleTableClick);

    // Form edit.
    editForm?.addEventListener(
      'submit',
      saveEditedBook
    );

    $('#closeEditDialog')?.addEventListener(
      'click',
      closeEditDialog
    );

    $('#cancelEditDialog')?.addEventListener(
      'click',
      closeEditDialog
    );

    editDialog?.addEventListener('click', event => {
      if (event.target === editDialog) {
        closeEditDialog();
      }
    });

    editDialog?.addEventListener('close', () => {
      editingBookId = null;
    });

    // Membaca data dari IndexedDB.
    try {
      await loadBooks();
    } catch (error) {
      console.error('Gagal memuat buku:', error);

      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="db-empty">
            Data buku gagal dimuat. Periksa koneksi IndexedDB.
          </td>
        </tr>
      `;

      if (countLabel) {
        countLabel.textContent = 'Data tidak tersedia';
      }

      showFeedback(
        error.message || 'Data buku gagal dimuat.',
        'error'
      );
    }
  }

  document.addEventListener(
    'DOMContentLoaded',
    initialize
  );

})();
