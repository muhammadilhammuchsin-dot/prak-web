
/* =========================================================
   FITUR PUSTAKAWAN: PENCARIAN DAN PENGHAPUSAN ANGGOTA
   Penghapusan disimpan sebagai daftar tersembunyi di browser.
   ========================================================= */
(() => {
  'use strict';

  const DELETED_KEY = 'eperpus_demo_deleted_members';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function getDeletedMembers() {
    const data = window.EPerpus?.read(DELETED_KEY, []);
    return Array.isArray(data) ? data : [];
  }

  function getMemberRows() {
    return $$('tbody tr');
  }

  // Menyembunyikan anggota yang sebelumnya sudah dihapus.
  function restoreDeletedMembers() {
    const deleted = getDeletedMembers();

    getMemberRows().forEach(row => {
      const npm = row.querySelector('[data-member-npm]')
        ?.dataset.memberNpm;

      if (npm && deleted.includes(npm)) {
        row.remove();
      }
    });

    updateCount(getMemberRows().length);
  }

  function updateCount(count) {
    let feedback = $('[data-member-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.memberFeedback = 'true';
      feedback.setAttribute('role', 'status');

      $('[data-search-form="members"]')?.after(feedback);
    }

    if (feedback) {
      feedback.textContent = `Jumlah anggota pada daftar: ${count}.`;
    }
  }

  // Mencari anggota pada tabel.
  function filterMembers(keyword) {
    const query = String(keyword || '').trim().toLocaleLowerCase('id');
    let visibleCount = 0;

    getMemberRows().forEach(row => {
      const visible = !query ||
        row.textContent.toLocaleLowerCase('id').includes(query);

      row.hidden = !visible;

      if (visible) visibleCount++;
    });

    let feedback = $('[data-member-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.memberFeedback = 'true';
      feedback.setAttribute('role', 'status');

      $('[data-search-form="members"]')?.after(feedback);
    }

    if (feedback) {
      feedback.textContent = query
        ? `${visibleCount} anggota ditemukan.`
        : `Jumlah anggota pada daftar: ${visibleCount}.`;
    }
  }

  // Menghapus anggota dari daftar simulasi.
  function deleteMember(button) {
    const npm = button.dataset.memberNpm;
    const row = button.closest('tr');

    if (!npm || !row) {
      window.EPerpus?.notify('Identitas anggota tidak ditemukan.', 'error');
      return;
    }

    if (!window.confirm(`Hapus anggota dengan NPM ${npm} dari daftar simulasi?`)) {
      return;
    }

    const deleted = getDeletedMembers();

    if (!deleted.includes(npm)) {
      deleted.push(npm);
    }

    if (!window.EPerpus?.write(DELETED_KEY, deleted)) return;

    row.remove();

    updateCount(getMemberRows().length);

    window.EPerpus?.notify(
      'Anggota dihapus dari daftar simulasi browser.'
    );
  }

  document.addEventListener('DOMContentLoaded', restoreDeletedMembers);

  // Event input untuk pencarian langsung.
  document.addEventListener('input', event => {
    if (event.target.matches('[data-search-form="members"] #keyword')) {
      filterMembers(event.target.value);
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-search-form="members"] #keyword')) {
      filterMembers(event.target.value);
    }
  });

  // Pencarian dengan tombol Enter.
  document.addEventListener('keydown', event => {
    if (
      event.target.matches('[data-search-form="members"] #keyword') &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      filterMembers(event.target.value);
    }
  });

  document.addEventListener('click', event => {
    const searchButton = event.target.closest('[data-action="search-members"]');

    if (searchButton) {
      const input = $('#keyword');

      if (!input || !input.value.trim()) {
        window.EPerpus?.notify(
          'Masukkan nama, NPM, atau program studi.'
        );

        input?.focus();
        filterMembers('');
        return;
      }

      filterMembers(input.value);
    }

    const deleteButton = event.target.closest('[data-action="delete-member"]');

    if (deleteButton) {
      deleteMember(deleteButton);
    }
  });
})();
