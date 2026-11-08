
/* =========================================================
   FITUR PUSTAKAWAN: DAFTAR DAN PENCARIAN TRANSAKSI
   Mengambil transaksi dari simulasi peminjaman anggota.
   ========================================================= */
(() => {
  'use strict';

  const TRANSACTION_KEY = 'eperpus_demo_transactions';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function getTransactions() {
    const data = window.EPerpus?.read(TRANSACTION_KEY, []);

    return Array.isArray(data) ? data : [];
  }

  // Menampilkan transaksi anggota ke tabel pustakawan.
  function renderTransactions() {
    const body = $('tbody');

    if (!body) return;

    const records = getTransactions();

    records.forEach(record => {
      if (
        !record.id ||
        body.querySelector(`[data-demo-transaction="${record.id}"]`)
      ) {
        return;
      }

      const row = document.createElement('tr');

      row.dataset.demoTransaction = record.id;

      const values = [
        record.npm || '-',
        record.anggota || '-',
        '-',
        record.judul || '-',
        record.tanggal || '-',
        record.status || '-'
      ];

      values.forEach(value => {
        const cell = document.createElement('td');

        cell.textContent = value;

        row.appendChild(cell);
      });

      body.prepend(row);
    });
  }

  function showSearchFeedback(message) {
    let feedback = $('[data-transaction-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.transactionFeedback = 'true';
      feedback.setAttribute('role', 'status');

      $('[data-search-form="transactions"]')?.after(feedback);
    }

    if (feedback) {
      feedback.textContent = message;
    }
  }

  // Mencari transaksi berdasarkan kata kunci.
  function filterTransactions(keyword) {
    const query = String(keyword || '').trim().toLocaleLowerCase('id');
    let visibleCount = 0;

    $$('tbody tr').forEach(row => {
      const visible = !query ||
        row.textContent.toLocaleLowerCase('id').includes(query);

      row.hidden = !visible;

      if (visible) visibleCount++;
    });

    showSearchFeedback(
      query
        ? `${visibleCount} transaksi ditemukan.`
        : `Menampilkan ${visibleCount} transaksi.`
    );
  }

  document.addEventListener('DOMContentLoaded', renderTransactions);

  document.addEventListener('input', event => {
    if (
      event.target.matches('[data-search-form="transactions"] #keyword')
    ) {
      filterTransactions(event.target.value);
    }
  });

  document.addEventListener('change', event => {
    if (
      event.target.matches('[data-search-form="transactions"] #keyword')
    ) {
      filterTransactions(event.target.value);
    }
  });

  document.addEventListener('keydown', event => {
    if (
      event.target.matches('[data-search-form="transactions"] #keyword') &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      filterTransactions(event.target.value);
    }
  });

  document.addEventListener('click', event => {
    const searchButton = event.target.closest(
      '[data-action="search-transactions"]'
    );

    if (!searchButton) return;

    const input = $('#keyword');

    if (!input || !input.value.trim()) {
      window.EPerpus?.notify(
        'Masukkan ID, nama anggota, atau judul buku.'
      );

      input?.focus();
      filterTransactions('');
      return;
    }

    filterTransactions(input.value);
  });
})();
