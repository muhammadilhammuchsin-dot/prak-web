
/* =========================================================
   FITUR PUSTAKAWAN: KELOLA DATA BUKU
   Mendukung pencarian, tambah, edit, hapus, dan validasi.
   Semua perubahan bersifat simulasi localStorage.
   ========================================================= */
(() => {
  'use strict';

  const BOOK_KEY = 'eperpus_demo_books';
  const DELETED_KEY = 'eperpus_demo_deleted_books';
  const EDIT_KEY = 'eperpus_demo_book_edit';
  const EDIT_PAYLOAD_KEY = 'eperpus_demo_book_edit_payload';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function readArray(key) {
    const value = window.EPerpus?.read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function getField(name) {
    return $(`[name="${name}"]`);
  }

  function getTableBody() {
    return $('.data-table tbody') || $('tbody');
  }

  function parseStock(text) {
    const match = String(text || '').match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  // Mengambil data awal dari tabel HTML.
  function readInitialRows() {
    const body = getTableBody();

    if (!body) return [];

    return $$('tr', body).map(row => {
      const cells = $$('td', row);

      if (cells.length < 4) return null;

      const id = cells[0].textContent.trim();

      if (!id) return null;

      return {
        id,
        judul: cells[1].textContent.trim(),
        penulis: '',
        kategori: cells[2].textContent.trim(),
        stok: parseStock(cells[3].textContent),
        deskripsi: ''
      };
    }).filter(Boolean);
  }

  // Menggabungkan data HTML dan localStorage.
  function getAllBooks() {
    const combined = new Map();

    readInitialRows().forEach(book => {
      combined.set(book.id, book);
    });

    readArray(BOOK_KEY).forEach(book => {
      if (book && book.id) {
        combined.set(book.id, book);
      }
    });

    const deleted = readArray(DELETED_KEY);

    return [...combined.values()].filter(
      book => !deleted.includes(book.id)
    );
  }

  function saveAllBooks(books) {
    return window.EPerpus?.write(BOOK_KEY, books) ?? false;
  }

  function createCell(value, className = '') {
    const cell = document.createElement('td');

    if (className) {
      cell.className = className;
    }

    cell.textContent = String(value ?? '');

    return cell;
  }

  // Membuat tombol aksi pada tabel.
  function createActionLink(label, className, action, bookId, route = '') {
    const link = document.createElement('a');

    link.className = className;
    link.textContent = label;
    link.setAttribute('role', action === 'edit-book' ? 'link' : 'button');
    link.setAttribute('tabindex', '0');
    link.dataset.action = action;
    link.dataset.bookId = bookId;

    if (route) {
      link.dataset.route = route;
    }

    return link;
  }

  // Menampilkan data buku pada tabel.
  function renderTable() {
    const body = getTableBody();

    if (!body) return;

    const books = getAllBooks();

    saveAllBooks(books);

    body.replaceChildren();

    books.forEach(book => {
      const row = document.createElement('tr');

      const code = document.createElement('span');
      code.className = 'pill pill--code';
      code.textContent = book.id;

      const category = document.createElement('span');
      category.className = 'pill pill--category';
      category.textContent = book.kategori;

      const stock = document.createElement('span');
      stock.className = Number(book.stok) > 0
        ? 'pill'
        : 'pill pill--danger';

      stock.textContent = Number(book.stok) > 0
        ? `${book.stok} Eks`
        : '0 (Habis)';

      const codeCell = document.createElement('td');
      codeCell.appendChild(code);

      const titleCell = document.createElement('td');
      const title = document.createElement('strong');
      title.textContent = book.judul;
      titleCell.appendChild(title);

      const categoryCell = document.createElement('td');
      categoryCell.appendChild(category);

      const stockCell = document.createElement('td');
      stockCell.appendChild(stock);

      const actionCell = document.createElement('td');
      const actionGroup = document.createElement('div');

      actionGroup.className = 'data-table__actions';

      actionGroup.append(
        createActionLink(
          'Edit',
          'btn btn--edit btn--small',
          'edit-book',
          book.id,
          'tambah-buku.html'
        ),
        createActionLink(
          'Hapus',
          'btn btn--delete btn--small',
          'delete-book',
          book.id
        )
      );

      actionCell.appendChild(actionGroup);

      row.append(
        codeCell,
        titleCell,
        categoryCell,
        stockCell,
        actionCell
      );

      body.appendChild(row);
    });

    const countLabel = $('.panel__header .muted');

    if (countLabel) {
      countLabel.textContent = `Menampilkan ${books.length} buku`;
    }
  }

  function showTableFeedback(message) {
    let feedback = $('[data-table-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.tableFeedback = 'true';
      feedback.setAttribute('role', 'status');

      $('[data-search-form="books"]')?.after(feedback);
    }

    if (feedback) {
      feedback.textContent = message;
    }
  }

  // Pencarian buku.
  function filterBooks(keyword) {
    const query = String(keyword || '').trim().toLocaleLowerCase('id');
    let visibleCount = 0;

    getTableBody()?.querySelectorAll('tr').forEach(row => {
      const visible = !query ||
        row.textContent.toLocaleLowerCase('id').includes(query);

      row.hidden = !visible;

      if (visible) visibleCount++;
    });

    showTableFeedback(
      query
        ? `${visibleCount} data buku ditemukan.`
        : `Menampilkan ${visibleCount} data buku.`
    );
  }

  // Memberikan tanda kesalahan pada input.
  function setFieldError(field, message) {
    field.setAttribute('aria-invalid', 'true');
    field.classList.add('form__input--error');
    field.dataset.validationMessage = message;
  }

  // Menghapus tanda kesalahan setelah input diperbaiki.
  function clearFieldError(field) {
    field.removeAttribute('aria-invalid');
    field.classList.remove('form__input--error');
    delete field.dataset.validationMessage;
  }

  // Validasi seluruh input buku.
  function validateBookForm() {
    const rules = [
      ['judul', 'Judul buku wajib diisi.'],
      ['id-buku', 'ID buku wajib diisi.'],
      ['penulis', 'Nama penulis wajib diisi.'],
      ['kategori', 'Kategori buku wajib dipilih.'],
      ['stok', 'Stok harus berupa bilangan bulat 0 atau lebih.']
    ];

    let valid = true;
    let firstInvalid = null;

    rules.forEach(([name, message]) => {
      const field = getField(name);

      if (!field) return;

      const value = field.value.trim();
      let invalid = !value;

      if (name === 'stok') {
        invalid = !/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value));
      }

      if (invalid) {
        valid = false;
        setFieldError(field, message);
        firstInvalid ||= field;
      } else {
        clearFieldError(field);
      }
    });

    if (!valid && firstInvalid) {
      window.EPerpus?.notify(
        firstInvalid.dataset.validationMessage,
        'error'
      );

      firstInvalid.focus();
    }

    return valid;
  }

  // Mengambil seluruh nilai form.
  function getFormBook() {
    return {
      id: getField('id-buku').value.trim().toUpperCase(),
      judul: getField('judul').value.trim(),
      penulis: getField('penulis').value.trim(),
      kategori: getField('kategori').value.trim(),
      stok: Number(getField('stok').value),
      deskripsi: getField('deskripsi')?.value.trim() || ''
    };
  }

  // Menyimpan buku baru atau perubahan buku.
  function saveBook() {
    if (!validateBookForm()) return;

    const book = getFormBook();
    const oldId = sessionStorage.getItem(EDIT_KEY);
    const books = readArray(BOOK_KEY);

    const duplicate = books.some(item =>
      item.id.toUpperCase() === book.id &&
      item.id !== oldId
    );

    if (duplicate) {
      const idField = getField('id-buku');

      setFieldError(idField, 'ID buku sudah digunakan.');

      window.EPerpus?.notify(
        'ID buku sudah digunakan. Gunakan ID lain.',
        'error'
      );

      idField.focus();
      return;
    }

    const index = books.findIndex(item => item.id === oldId);

    if (index >= 0) {
      books[index] = book;
    } else {
      books.push(book);
    }

    const deleted = readArray(DELETED_KEY);
    const updatedDeleted = deleted.filter(id => id !== book.id);

    if (oldId && oldId !== book.id && !updatedDeleted.includes(oldId)) {
      updatedDeleted.push(oldId);
    }

    if (!saveAllBooks(books)) return;

    window.EPerpus?.write(DELETED_KEY, updatedDeleted);

    sessionStorage.removeItem(EDIT_KEY);
    sessionStorage.removeItem(EDIT_PAYLOAD_KEY);

    window.EPerpus?.notify(
      'Data buku berhasil disimpan pada simulasi browser.'
    );

    window.location.href = 'data-buku.html';
  }

  // Menghapus buku.
  function deleteBook(button) {
    const id = button.dataset.bookId;

    if (!id) {
      window.EPerpus?.notify('ID buku tidak ditemukan.', 'error');
      return;
    }

    if (!window.confirm(`Hapus buku ${id} dari daftar simulasi?`)) {
      return;
    }

    const books = getAllBooks().filter(book => book.id !== id);
    const deleted = readArray(DELETED_KEY);

    if (!deleted.includes(id)) {
      deleted.push(id);
    }

    if (!saveAllBooks(books)) return;
    if (!window.EPerpus?.write(DELETED_KEY, deleted)) return;

    renderTable();

    window.EPerpus?.notify(
      'Buku berhasil dihapus dari daftar simulasi browser.'
    );
  }

  // Menyiapkan data ketika pengguna memilih Edit.
  function startEdit(button) {
    const id = button.dataset.bookId;
    const row = button.closest('tr');
    const books = getAllBooks();

    let book = books.find(item => item.id === id);

    if (!book && row) {
      const cells = $$('td', row);

      book = {
        id,
        judul: cells[1]?.textContent.trim() || '',
        penulis: '',
        kategori: cells[2]?.textContent.trim() || '',
        stok: parseStock(cells[3]?.textContent),
        deskripsi: ''
      };
    }

    if (!book) {
      window.EPerpus?.notify(
        'Data buku untuk diedit tidak ditemukan.',
        'error'
      );
      return;
    }

    sessionStorage.setItem(EDIT_KEY, id);
    sessionStorage.setItem(EDIT_PAYLOAD_KEY, JSON.stringify(book));
  }

  // Mengisi form berdasarkan data buku yang dipilih.
  function loadEditForm() {
    if (!getField('id-buku')) return;

    const editId = sessionStorage.getItem(EDIT_KEY);

    if (!editId) return;

    let book = readArray(BOOK_KEY).find(item => item.id === editId);

    if (!book) {
      try {
        book = JSON.parse(
          sessionStorage.getItem(EDIT_PAYLOAD_KEY) || 'null'
        );
      } catch (error) {
        console.error('Data edit buku tidak valid:', error);
      }
    }

    if (!book) {
      window.EPerpus?.notify(
        'Data buku tidak ditemukan. Form dapat diisi sebagai data baru.',
        'error'
      );

      sessionStorage.removeItem(EDIT_KEY);
      sessionStorage.removeItem(EDIT_PAYLOAD_KEY);
      return;
    }

    const values = {
      'id-buku': book.id,
      judul: book.judul,
      penulis: book.penulis,
      kategori: book.kategori,
      stok: book.stok,
      deskripsi: book.deskripsi
    };

    Object.entries(values).forEach(([name, value]) => {
      const field = getField(name);

      if (field) {
        field.value = value ?? '';
      }
    });
  }

  // Inisialisasi halaman.
  document.addEventListener('DOMContentLoaded', () => {
    if (getTableBody()) {
      renderTable();
    }

    loadEditForm();
  });

  // Event input pencarian dan validasi.
  document.addEventListener('input', event => {
    if (event.target.matches('[data-search-form="books"] #keyword')) {
      filterBooks(event.target.value);
    }

    if (
      event.target.matches('[name]') &&
      event.target.hasAttribute('aria-invalid')
    ) {
      clearFieldError(event.target);
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-search-form="books"] #keyword')) {
      filterBooks(event.target.value);
    }

    if (
      event.target.matches('[name]') &&
      event.target.hasAttribute('aria-invalid')
    ) {
      clearFieldError(event.target);
    }
  });

  // Pencarian menggunakan Enter.
  document.addEventListener('keydown', event => {
    if (
      event.target.matches('[data-search-form="books"] #keyword') &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      filterBooks(event.target.value);
    }
  });

  // Event click untuk seluruh aksi pustakawan.
  document.addEventListener('click', event => {
    const searchButton = event.target.closest('[data-action="search-books"]');

    if (searchButton) {
      const input = $('#keyword');

      if (!input || !input.value.trim()) {
        window.EPerpus?.notify('Masukkan kata kunci pencarian buku.');
        input?.focus();
        filterBooks('');
      } else {
        filterBooks(input.value);
      }
    }

    const deleteButton = event.target.closest('[data-action="delete-book"]');

    if (deleteButton) {
      deleteBook(deleteButton);
    }

    const editButton = event.target.closest('[data-action="edit-book"]');

    if (editButton) {
      startEdit(editButton);
    }

    const saveButton = event.target.closest('[data-action="save-book"]');

    if (saveButton) {
      saveBook();
    }

    // Membersihkan data edit jika pengguna memilih Tambah Buku.
    const addRoute = event.target.closest('[data-route="tambah-buku.html"]');

    if (addRoute && !addRoute.matches('[data-action="edit-book"]')) {
      sessionStorage.removeItem(EDIT_KEY);
      sessionStorage.removeItem(EDIT_PAYLOAD_KEY);
    }
  });
})();
