
/* =========================================================
   FITUR KEPALA PERPUSTAKAAN: PILIH PERIODE LAPORAN
   Angka pada halaman masih statis karena belum ada sumber data.
   ========================================================= */
(() => {
  'use strict';

  const periodSelect = document.querySelector('#period');

  function showPeriodFeedback() {
    if (!periodSelect) return;

    let feedback = document.querySelector('[data-report-feedback]');

    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.reportFeedback = 'true';
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');

      periodSelect.closest('section')?.appendChild(feedback);
    }

    const selectedPeriod =
      periodSelect.options[periodSelect.selectedIndex]?.textContent.trim();

    feedback.textContent = selectedPeriod
      ? `Periode ${selectedPeriod} dipilih. Angka laporan masih berupa data statis pada HTML; data per periode belum tersedia.`
      : 'Periode laporan belum dipilih.';
  }

  if (periodSelect) {
    periodSelect.disabled = false;

    periodSelect.addEventListener('change', showPeriodFeedback);

    showPeriodFeedback();
  }
})();
