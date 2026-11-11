
/* =========================================================
   EKSPOR LAPORAN BULANAN KE PDF
   E-PERPUSTAKAAN - KEPALA PERPUSTAKAAN

   Fitur:
   1. Membuat PDF laporan bulanan.
   2. Mengambil data dari laporan.js.
   3. Menampilkan ringkasan anggota dan buku.
   4. Menampilkan distribusi kategori.
   5. Menampilkan rincian transaksi.
   6. Mendukung PDF lebih dari satu halaman.
   7. Mengunduh PDF tanpa library eksternal.

   Format:
   A4 Portrait
   ========================================================= */

(() => {
  'use strict';

  // =======================================================
  // 1. KONFIGURASI PDF
  // =======================================================

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 42;

  const CATEGORY_ROWS = [
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

  const button = document.getElementById(
    'downloadMonthlyReport'
  );

  const periodSelect = document.getElementById('period');

  let activeReport = null;


  // =======================================================
  // 2. CLASS PEMBUAT PDF
  // =======================================================

  class SimplePDF {

    constructor() {

      this.pages = [[]];

      this.pageIndex = 0;

    }

    // Menambahkan halaman baru.
    addPage() {

      this.pages.push([]);

      this.pageIndex = this.pages.length - 1;

    }

    // Menambahkan perintah PDF.
    add(command, pageIndex = this.pageIndex) {

      this.pages[pageIndex].push(command);

    }

    // Mengubah warna HEX menjadi RGB.
    rgb(hex) {

      const matched = /^#?([0-9a-f]{6})$/i.exec(hex);

      const number = parseInt(
        matched ? matched[1] : '000000',
        16
      );

      return [
        number >> 16,
        (number >> 8) & 255,
        number & 255
      ]
        .map(value => (value / 255).toFixed(3))
        .join(' ');

    }

    // Membersihkan teks agar aman untuk PDF.
    safeText(value) {

      return String(value ?? '-')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, '?')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    }

    // Menambahkan teks.
    text(
      x,
      top,
      text,
      size = 10,
      bold = false,
      color = '#172033',
      page = this.pageIndex
    ) {

      const baseline = PAGE_H - top - size;

      this.add(
        `${this.rgb(color)} rg BT /F${bold ? 2 : 1} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${this.safeText(text)}) Tj ET`,
        page
      );

    }

    // Membuat persegi panjang.
    rect(
      x,
      top,
      width,
      height,
      color = '#ffffff'
    ) {

      const y = PAGE_H - top - height;

      this.add(
        `${this.rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
      );

    }

    // Membuat garis horizontal.
    line(
      x1,
      top1,
      x2,
      top2,
      color = '#e2e8f0',
      strokeWidth = 1,
      page = this.pageIndex
    ) {

      this.add(
        `${this.rgb(color)} RG ${strokeWidth} w ${x1.toFixed(2)} ${(PAGE_H - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H - top2).toFixed(2)} l S`,
        page
      );

    }

    // =====================================================
    // 3. MENGHASILKAN FILE PDF
    // =====================================================

    serialize() {

      const objects = [];

      objects[1] =
        '<< /Type /Catalog /Pages 2 0 R >>';

      const pageRefs = this.pages.map(
        (_, index) => `${5 + index * 2} 0 R`
      );

      objects[2] =
        `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${this.pages.length} >>`;

      objects[3] =
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

      objects[4] =
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

      this.pages.forEach((commands, index) => {

        const pageId = 5 + index * 2;

        const contentId = pageId + 1;

        const stream = `${commands.join('\n')}\n`;

        objects[pageId] =
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;

        objects[contentId] =
          `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;

      });

      let output = '%PDF-1.4\n%ASCII\n';

      const offsets = [0];

      for (
        let index = 1;
        index < objects.length;
        index++
      ) {

        offsets[index] = output.length;

        output +=
          `${index} 0 obj\n${objects[index]}\nendobj\n`;

      }

      const xrefOffset = output.length;

      output +=
        `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

      for (
        let index = 1;
        index < objects.length;
        index++
      ) {

        output +=
          `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;

      }

      output +=
        `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

      return new Blob(
        [output],
        { type: 'application/pdf' }
      );

    }

  }


  // =======================================================
  // 4. FUNGSI FORMAT DATA
  // =======================================================

  // Membatasi panjang teks.
  function shorten(value, max = 30) {

    const cleaned = String(value ?? '-')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.length > max
      ? `${cleaned.slice(0, max - 3)}...`
      : cleaned;

  }

  // Mengubah tanggal YYYY-MM-DD menjadi DD/MM/YYYY.
  function formatDate(raw) {

    const match = String(raw || '').match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    return match
      ? `${match[3]}/${match[2]}/${match[1]}`
      : shorten(raw || '-', 12);

  }


  // =======================================================
  // 5. MEMBUAT KARTU RINGKASAN
  // =======================================================

  function drawMetric(
    pdf,
    x,
    y,
    title,
    number,
    width = 244
  ) {

    pdf.rect(
      x,
      y,
      width,
      58,
      '#f1f5f9'
    );

    pdf.text(
      x + 12,
      y + 10,
      title.toUpperCase(),
      9,
      false,
      '#64748b'
    );

    pdf.text(
      x + 12,
      y + 28,
      String(number),
      19,
      true,
      '#0b2a6f'
    );

  }


  // =======================================================
  // 6. MEMBUAT HEADER TABEL
  // =======================================================

  function drawTableHeader(pdf, y) {

    const positions = [
      48,
      130,
      245,
      400,
      473
    ];

    pdf.rect(
      42,
      y,
      511,
      27,
      '#eaf0ff'
    );

    [
      'ID',
      'ANGGOTA',
      'BUKU',
      'TANGGAL',
      'STATUS'
    ].forEach((label, index) => {

      pdf.text(
        positions[index],
        y + 8,
        label,
        8,
        true,
        '#0b2a6f'
      );

    });

  }


  // =======================================================
  // 7. MEMBANGUN ISI LAPORAN PDF
  // =======================================================

  function buildPdf(report) {

    const pdf = new SimplePDF();

    const total = Math.max(
      0,
      Number(report.total) || 0
    );

    const unclassified = Math.max(
      0,
      Number(report.unclassified) || 0
    );

    const transactions = Array.isArray(report.transactions)
      ? report.transactions
      : [];

    const exportedAt = new Date()
      .toLocaleString('id-ID');


    // =====================================================
    // HEADER LAPORAN
    // =====================================================

    pdf.rect(
      0,
      0,
      PAGE_W,
      82,
      '#0b2a6f'
    );

    pdf.text(
      MARGIN,
      20,
      'LAPORAN BULANAN E-PERPUSTAKAAN',
      16,
      true,
      '#ffffff'
    );

    pdf.text(
      MARGIN,
      48,
      `Periode: ${report.periodLabel || report.period}`,
      11,
      false,
      '#ffffff'
    );

    pdf.text(
      MARGIN,
      65,
      `Diunduh: ${exportedAt}`,
      8,
      false,
      '#dce9ff'
    );


    // =====================================================
    // RINGKASAN LAPORAN
    // =====================================================

    pdf.text(
      MARGIN,
      104,
      'RINGKASAN',
      12,
      true,
      '#0b2a6f'
    );

    drawMetric(
      pdf,
      42,
      125,
      'Total anggota (saat ekspor)',
      report.members
    );

    drawMetric(
      pdf,
      309,
      125,
      'Total buku (saat ekspor)',
      report.books
    );

    drawMetric(
      pdf,
      42,
      193,
      'Peminjaman pada periode',
      total
    );

    drawMetric(
      pdf,
      309,
      193,
      'Kategori belum diketahui',
      unclassified
    );


    // =====================================================
    // DISTRIBUSI KATEGORI
    // =====================================================

    pdf.text(
      MARGIN,
      278,
      'DISTRIBUSI PEMINJAMAN BERDASARKAN KATEGORI',
      12,
      true,
      '#0b2a6f'
    );

    pdf.text(
      MARGIN,
      299,
      'Persentase dihitung dari seluruh transaksi pada periode ini.',
      8,
      false,
      '#64748b'
    );

    const rows = [

      ...CATEGORY_ROWS.map(item => ({
        ...item,
        count: Number(
          report.counts?.[item.key]
        ) || 0
      })),

      {
        label: 'Belum terklasifikasi',
        color: '#cbd5e1',
        count: unclassified
      }

    ];

    rows.forEach((item, index) => {

      const top = 322 + index * 35;

      const percent = total > 0
        ? item.count / total * 100
        : 0;

      pdf.text(
        MARGIN,
        top,
        shorten(item.label, 31),
        9,
        index === 4,
        '#172033'
      );

      // Background bar.
      pdf.rect(
        242,
        top,
        205,
        11,
        '#edf2f7'
      );

      // Bar sesuai persentase.
      if (percent > 0) {

        pdf.rect(
          242,
          top,
          205 * (percent / 100),
          11,
          item.color
        );

      }

      pdf.text(
        455,
        top - 1,
        `${item.count} (${percent.toFixed(1)}%)`,
        9,
        true,
        '#172033'
      );

    });


    // =====================================================
    // RINCIAN TRANSAKSI
    // =====================================================

    pdf.line(
      42,
      504,
      553,
      504
    );

    pdf.text(
      MARGIN,
      514,
      'RINCIAN TRANSAKSI',
      12,
      true,
      '#0b2a6f'
    );

    let cursorY = 540;

    drawTableHeader(
      pdf,
      cursorY
    );

    cursorY += 27;


    if (transactions.length === 0) {

      pdf.text(
        48,
        cursorY + 10,
        'Tidak ada transaksi peminjaman pada periode ini.',
        9,
        false,
        '#64748b'
      );

    } else {

      transactions.forEach((record, index) => {

        // Membuat halaman baru jika tabel melewati batas.
        if (cursorY > 748) {

          pdf.addPage();

          pdf.text(
            42,
            35,
            `LAPORAN TRANSAKSI - ${report.periodLabel || report.period}`,
            13,
            true,
            '#0b2a6f'
          );

          drawTableHeader(
            pdf,
            65
          );

          cursorY = 92;

        }

        // Warna baris selang-seling.
        if (index % 2 === 0) {

          pdf.rect(
            42,
            cursorY,
            511,
            23,
            '#f8fafc'
          );

        }

        pdf.text(
          48,
          cursorY + 6,
          shorten(record.id, 16),
          8
        );

        pdf.text(
          130,
          cursorY + 6,
          shorten(record.member, 22),
          8
        );

        pdf.text(
          245,
          cursorY + 6,
          shorten(record.book, 29),
          8
        );

        pdf.text(
          400,
          cursorY + 6,
          formatDate(record.date),
          8
        );

        pdf.text(
          473,
          cursorY + 6,
          shorten(record.status, 14),
          8
        );

        cursorY += 23;

      });

    }


    // =====================================================
    // FOOTER SETIAP HALAMAN
    // =====================================================

    pdf.pages.forEach((_, index) => {

      pdf.line(
        42,
        797,
        553,
        797,
        '#e2e8f0',
        1,
        index
      );

      pdf.text(
        42,
        805,
        'Sumber: data browser aplikasi E-Perpustakaan. Belum terhubung ke MySQL.',
        7,
        false,
        '#64748b',
        index
      );

      pdf.text(
        510,
        805,
        `${index + 1} / ${pdf.pages.length}`,
        8,
        true,
        '#64748b',
        index
      );

      if (
        !report.catalogComplete &&
        index === 0
      ) {

        pdf.text(
          42,
          780,
          'Catatan: sebagian katalog belum terbaca; total buku mungkin belum lengkap.',
          8,
          false,
          '#b45309',
          index
        );

      }

    });

    return pdf.serialize();

  }


  // =======================================================
  // 8. MENGUNDUH PDF
  // =======================================================

  function downloadPdf(report) {

    const blob = buildPdf(report);

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download =
      `Laporan-Perpustakaan-${report.period}.pdf`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    // Membersihkan URL setelah unduhan dimulai.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 3000);

  }


  // =======================================================
  // 9. MENERIMA DATA DARI LAPORAN.JS
  // =======================================================

  document.addEventListener(
    'eperpus:report-updated',
    event => {

      activeReport = event.detail;

      if (button) {
        button.disabled = false;
      }

    }
  );


  // =======================================================
  // 10. EVENT TOMBOL DOWNLOAD
  // =======================================================

  button?.addEventListener('click', () => {

    // Memastikan data yang digunakan sesuai periode terpilih.
    if (
      !activeReport ||
      activeReport.period !== periodSelect?.value
    ) {

      window.alert(
        'Data laporan sedang dimuat. Coba lagi setelah laporan tampil.'
      );

      return;

    }

    try {

      downloadPdf(activeReport);

    } catch (error) {

      console.error(
        'Gagal membuat PDF laporan:',
        error
      );

      window.alert(
        'Gagal mengunduh PDF laporan. Periksa Console browser.'
      );

    }

  });

})();
