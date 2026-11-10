
/* =========================================================
   E-PERPUSTAKAAN
   FITUR PUSTAKAWAN: DATA ANGGOTA

   Fungsi:
   1. Menampilkan daftar anggota.
   2. Menghapus anggota dari daftar simulasi.
   3. Menyimpan daftar anggota yang dihapus.
   4. Mencari anggota berdasarkan nama, NPM, dan prodi.
   5. Mengatur ulang nomor urut secara otomatis.

   Penyimpanan:
   localStorage

   Database backend belum digunakan.
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI
  // =======================================================

  const DELETED_KEY = 'eperpus_demo_deleted_members';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];


  // =======================================================
  // 2. MENGAMBIL DAFTAR ANGGOTA
  // =======================================================

  function getMemberRows() {
    return $$('tbody tr');
  }


  // =======================================================
  // 3. MEMBACA DAFTAR ANGGOTA YANG DIHAPUS
  // =======================================================

  function getDeletedMembers() {

    const data = window.EPerpus?.read(
      DELETED_KEY,
      []
    );

    return Array.isArray(data) ? data : [];

  }


  // =======================================================
  // 4. MENGATUR ULANG NOMOR URUT
  // =======================================================

  function renumberMembers() {

    const rows = getMemberRows();

    let number = 1;

    rows.forEach(row => {

      // Baris yang sedang disembunyikan oleh pencarian
      // tidak ikut dihitung.
      if (row.hidden) return;

      const numberCell = row.cells[0];

      if (numberCell) {

        numberCell.textContent = number;

        number++;

      }

    });

  }


  // =======================================================
  // 5. MEMULIHKAN STATUS ANGGOTA YANG SUDAH DIHAPUS
  // =======================================================

  function restoreDeletedMembers() {

    const deleted = getDeletedMembers();

    getMemberRows().forEach(row => {

      const deleteButton = $(
        '[data-member-npm]',
        row
      );

      const npm = deleteButton?.dataset.memberNpm;

      if (npm && deleted.includes(npm)) {

        row.remove();

      }

    });

    // Mengatur ulang nomor setelah anggota yang dihapus
    // dikeluarkan dari tabel.
    renumberMembers();

  }


  // =======================================================
  // 6. PENCARIAN ANGGOTA
  // =======================================================

  function filterMembers(keyword) {

    const query = String(keyword || '')
      .trim()
      .toLocaleLowerCase('id-ID');

    getMemberRows().forEach(row => {

      const memberData = row.textContent
        .toLocaleLowerCase('id-ID');

      const isMatch =
        !query || memberData.includes(query);

      row.hidden = !isMatch;

    });

    // Nomor urut hasil pencarian dimulai kembali dari 1.
    renumberMembers();

  }


  // =======================================================
  // 7. MENGHAPUS ANGGOTA
  // =======================================================

  function deleteMember(button) {

    const npm = button.dataset.memberNpm;

    const row = button.closest('tr');

    if (!npm || !row) {

      window.EPerpus?.notify(
        'Identitas anggota tidak ditemukan.',
        'error'
      );

      return;

    }

    // Konfirmasi penghapusan.
    const confirmed = window.confirm(
      `Hapus anggota dengan NPM ${npm} dari daftar simulasi?`
    );

    if (!confirmed) return;

    // Mengambil daftar anggota yang sudah dihapus.
    const deleted = getDeletedMembers();

    if (!deleted.includes(npm)) {

      deleted.push(npm);

    }

    // Menyimpan status penghapusan.
    const saved = window.EPerpus?.write(
      DELETED_KEY,
      deleted
    );

    if (!saved) return;

    // Menghapus baris anggota dari tabel.
    row.remove();

    // Mengatur ulang seluruh nomor urut.
    renumberMembers();

    // Notifikasi.
    window.EPerpus?.notify(
      'Anggota berhasil dihapus dari daftar simulasi browser.'
    );

  }


  // =======================================================
  // 8. INISIALISASI HALAMAN
  // =======================================================

  document.addEventListener(
    'DOMContentLoaded',
    () => {

      // Memulihkan data penghapusan sebelumnya.
      restoreDeletedMembers();

      // Tidak ada lagi pembuatan informasi jumlah anggota.

    }
  );


  // =======================================================
  // 9. EVENT PENCARIAN LANGSUNG
  // =======================================================

  document.addEventListener(
    'input',
    event => {

      if (
        event.target.matches(
          '[data-search-form="members"] #keyword'
        )
      ) {

        filterMembers(event.target.value);

      }

    }
  );


  // =======================================================
  // 10. EVENT TOMBOL PENCARIAN
  // =======================================================

  document.addEventListener(
    'click',
    event => {

      const searchButton = event.target.closest(
        '[data-action="search-members"]'
      );

      if (searchButton) {

        const input = $('#keyword');

        if (!input || !input.value.trim()) {

          filterMembers('');

          input?.focus();

          return;

        }

        filterMembers(input.value);

        return;

      }


      // ===================================================
      // 11. EVENT TOMBOL HAPUS
      // ===================================================

      const deleteButton = event.target.closest(
        '[data-action="delete-member"]'
      );

      if (deleteButton) {

        deleteMember(deleteButton);

      }

    }
  );


  // =======================================================
  // 12. MENDUKUNG PENCARIAN DENGAN TOMBOL ENTER
  // =======================================================

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.target.matches(
          '[data-search-form="members"] #keyword'
        ) &&
        event.key === 'Enter'
      ) {

        event.preventDefault();

        filterMembers(event.target.value);

      }

    }
  );

})();
