
/* E-PERPUSTAKAAN: PROFIL MINAT BACA MENGGUNAKAN KNN.
   Nama anggota dibaca dari sesi login.
   Minimal 3 pencarian ATAU 3 peminjaman pada kategori yang sama.
   Fitur buku: judul, kategori, penulis, deskripsi.
   TF-IDF untuk pembentukan fitur dan Euclidean Distance untuk KNN.
   Hasil akhir hanya menampilkan kategori minat baca pada beranda. */
(() => {
  'use strict';

  // 1. KONFIGURASI PENYIMPANAN.
  const ACCOUNT_KEY = 'eperpus_demo_accounts';
  const SESSION_KEYS = ['eperpus_demo_session', 'eperpus_anggota_session'];
  const SEARCH_KEY = 'eperpus_anggota_search_history';
  const TRANSACTION_KEY = 'eperpus_demo_transactions';
  const DB_NAME = 'eperpus_pustakawan';
  const DB_VERSION = 1;
  const STORE_NAME = 'books';

  // 2. KONFIGURASI ALGORITMA.
  const MIN_ACTIVITY = 3;
  const K = 3;
  const SEARCH_WEIGHT = 1;
  const BORROW_WEIGHT = 3;
  const FIELD_WEIGHTS = {
    title: 2.2,
    category: 1.5,
    description: 1.5,
    author: 0.25
  };

  // 3. KATEGORI DAN LABEL TAMPILAN.
  const CATEGORIES = [
    { key: 'informatika', label: 'Informatika' },
    { key: 'sains', label: 'Sains & Matematika' },
    { key: 'sosial', label: 'Sosial & Bisnis' },
    { key: 'sastra', label: 'Sastra & Bahasa' }
  ];

  // 4. SUMBER HALAMAN KATALOG.
  const CATEGORY_PAGES = [
    { key: 'informatika', label: 'Informatika & Komputer', file: 'cari-informatika.html' },
    { key: 'sains', label: 'Sains & Matematika', file: 'cari-sains.html' },
    { key: 'sosial', label: 'Sosial & Bisnis', file: 'cari-sosial.html' },
    { key: 'sastra', label: 'Sastra & Bahasa', file: 'cari-sastra.html' }
  ];

  // 5. KATA UMUM YANG DIABAIKAN PADA TF-IDF.
  const STOP_WORDS = new Set([
    'dan','yang','di','ke','dari','untuk','dengan','pada','oleh','atau',
    'dalam','ini','itu','sebagai','tentang','adalah','dapat','akan',
    'the','and','for','with','from','into','of','to',
    'dr','ir','prof','phd','mkom','mcs','mpd','msc'
  ]);

  const $ = (selector, root = document) => root.querySelector(selector);
  let idfMap = new Map();
  let refreshInProgress = false;

  // 6. NORMALISASI TEKS.
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('id')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 7. MENGUBAH NAMA KATEGORI MENJADI KODE INTERNAL.
  function categoryKey(value) {
    const text = normalizeText(value);
    if (text.includes('informatika') || text.includes('komputer') || text.includes('sistem informasi')) return 'informatika';
    if (text.includes('sains') || text.includes('matematika')) return 'sains';
    if (text.includes('sosial') || text.includes('bisnis')) return 'sosial';
    if (text.includes('sastra') || text.includes('bahasa')) return 'sastra';
    return '';
  }

  // 8. MENGAMBIL LABEL KATEGORI.
  function categoryLabel(key) {
    return CATEGORIES.find(item => item.key === key)?.label || 'Kategori lainnya';
  }

  // 9. TOKENISASI TEKS UNTUK TF-IDF.
  function tokenize(value) {
    const words = normalizeText(value).match(/[\p{L}\p{N}]{2,}/gu) || [];
    return words.filter(word =>
      !STOP_WORDS.has(word) && !/^\d+$/.test(word)
    );
  }

  // 10. MEMBACA RIWAYAT DARI LOCALSTORAGE.
  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error(`Data ${key} tidak dapat dibaca:`, error);
      return [];
    }
  }

  // 11. MEMBACA NAMA ANGGOTA DARI SESI LOGIN.
  // Kunci sesi mengikuti anggota-auth.js yang sudah ada.
  function readSession() {
    for (const key of SESSION_KEYS) {
      try {
        const session = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (!session?.npm) continue;

        const npm = String(session.npm).trim();
        let nama = String(session.nama || '').trim();
        let prodi = String(session.prodi || '').trim();

        // Jika nama tidak ada di sesi, cari dari akun yang terdaftar.
        if (!nama) {
          const accounts = readArray(ACCOUNT_KEY);
          const account = accounts.find(item =>
            String(item.npm || '').trim() === npm
          );
          nama = String(account?.nama || '').trim();
          if (!prodi) prodi = String(account?.prodi || '').trim();
        }

        return {
          ...session,
          npm,
          nama: nama || 'Anggota',
          prodi
        };
      } catch (error) {
        console.warn(`Sesi ${key} tidak valid:`, error);
      }
    }
    return null;
  }

  // 12. MENAMPILKAN NAMA ANGGOTA PADA SEMUA BAGIAN BERANDA.
  function renderMemberName(session) {
    const nama = String(session?.nama || '').trim() || 'Anggota';
    document.querySelectorAll('[data-member-name]').forEach(element => {
      element.textContent = nama;
    });
  }

  // 13. MEMBACA BUKU ADMIN DARI INDEXEDDB.
  function getAdminBooks() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve([]);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id_buku' });
        }
      };

      request.onerror = () => {
        reject(request.error || new Error('IndexedDB gagal dibuka.'));
      };

      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          resolve([]);
          return;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const getAll = tx.objectStore(STORE_NAME).getAll();

        getAll.onsuccess = () => {
          resolve(Array.isArray(getAll.result) ? getAll.result : []);
        };

        getAll.onerror = () => {
          reject(getAll.error || new Error('Data buku gagal dibaca.'));
        };

        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    });
  }

  // 14. MENYERAGAMKAN DATA BUKU ADMIN.
  function normalizeAdminBook(record) {
    const id = String(record.id_buku || '').trim();
    const title = String(record.judul || '').trim();
    const key = categoryKey(record.kategori);

    if (!id || !title || !key) return null;

    return {
      id,
      title,
      author: String(record.penulis || '').trim(),
      categoryKey: key,
      categoryLabel: categoryLabel(key),
      categoryText: String(record.kategori || categoryLabel(key)),
      description: String(record.deskripsi || '').trim(),
      source: 'indexeddb'
    };
  }

  // 15. MEMBACA BUKU STATIS DARI HALAMAN KATEGORI.
  async function getStaticBooks() {
    const results = await Promise.allSettled(
      CATEGORY_PAGES.map(async category => {
        const pageUrl = new URL(category.file, window.location.href);
        const response = await fetch(pageUrl.href, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`${category.file}: HTTP ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        return [...doc.querySelectorAll('.book-grid .book-card')]
          .map(card => {
            const title = card.querySelector('.book-card__title')
              ?.textContent.replace(/\s+/g, ' ').trim() || '';

            if (!title) return null;

            const imagePath = card.querySelector('.cover__image')
              ?.getAttribute('src') || '';

            const label = card.querySelector('.cover__label')
              ?.textContent || '';

            const idFromLabel = label.match(/ID\s*:\s*([\w-]+)/i)?.[1] || '';
            const idFromImage = imagePath.match(
              /(?:^|\/)([\w-]+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i
            )?.[1] || '';

            const tag = card.querySelector('.tag')?.textContent.trim() || '';

            return {
              id: card.dataset.bookId || idFromLabel || idFromImage,
              title,
              author: card.querySelector('.book-card__author')
                ?.textContent.trim() || '',
              categoryKey: category.key,
              categoryLabel: categoryLabel(category.key),
              categoryText: tag || category.label,
              description: card.querySelector(
                '.book-card__text, .book-card__description, [data-book-description]'
              )?.textContent.trim() || '',
              source: 'html'
            };
          })
          .filter(book => book && book.id);
      })
    );

    return results.flatMap(result =>
      result.status === 'fulfilled'
        ? result.value
        : (console.warn(result.reason), [])
    );
  }

  // 16. MENGGABUNGKAN KATALOG HTML DAN BUKU ADMIN.
  async function loadCatalog() {
    const [staticBooks, adminRecords] = await Promise.all([
      getStaticBooks(),
      getAdminBooks().catch(error => {
        console.warn('Buku admin belum dapat dibaca:', error);
        return [];
      })
    ]);

    const booksById = new Map();

    staticBooks.forEach(book => {
      if (book.id && !booksById.has(book.id)) {
        booksById.set(book.id, book);
      }
    });

    adminRecords.map(normalizeAdminBook).filter(Boolean).forEach(book => {
      if (!booksById.has(book.id)) {
        booksById.set(book.id, book);
      } else {
        console.warn(`ID buku ${book.id} sudah ada di katalog HTML.`);
      }
    });

    const books = [...booksById.values()];
    buildBookVectors(books);
    return books;
  }

  // 17. MEMBENTUK VEKTOR TF-IDF DARI ATRIBUT BUKU.
  function buildBookVectors(books) {
    const documents = books.map(book => ({
      book,
      title: tokenize(book.title),
      category: tokenize(`${book.categoryLabel} ${book.categoryText}`),
      author: tokenize(book.author),
      description: tokenize(book.description)
    }));

    // Menghitung Document Frequency setiap kata.
    const documentFrequency = new Map();

    documents.forEach(doc => {
      const uniqueTerms = new Set([
        ...doc.title,
        ...doc.category,
        ...doc.author,
        ...doc.description
      ]);

      uniqueTerms.forEach(term => {
        documentFrequency.set(
          term,
          (documentFrequency.get(term) || 0) + 1
        );
      });
    });

    // Menghitung IDF.
    const totalDocuments = Math.max(documents.length, 1);

    idfMap = new Map(
      [...documentFrequency.entries()].map(([term, count]) => [
        term,
        Math.log((totalDocuments + 1) / (count + 1)) + 1
      ])
    );

    // Membentuk vektor masing-masing buku.
    documents.forEach(doc => {
      const vector = {
        [`category:${doc.book.categoryKey}`]: 1.5
      };

      [
        ['title', doc.title],
        ['category', doc.category],
        ['author', doc.author],
        ['description', doc.description]
      ].forEach(([field, terms]) => {
        if (!terms.length) return;

        const counts = new Map();
        terms.forEach(term => {
          counts.set(term, (counts.get(term) || 0) + 1);
        });

        counts.forEach((count, term) => {
          const tf = count / terms.length;
          const idf = idfMap.get(term) || 1;
          const key = `term:${term}`;

          vector[key] = (vector[key] || 0) +
            tf * idf * FIELD_WEIGHTS[field];
        });
      });

      doc.book.featureVector = normalizeVector(vector);
    });
  }

  // 18. NORMALISASI VEKTOR MENGGUNAKAN L2.
  function normalizeVector(vector) {
    const norm = Math.sqrt(
      Object.values(vector).reduce((sum, value) => sum + value * value, 0)
    );

    if (!norm) return vector;

    Object.keys(vector).forEach(key => {
      vector[key] /= norm;
    });

    return vector;
  }

  // 19. MENAMBAHKAN VEKTOR BUKU KE PROFIL ANGGOTA.
  function addVector(target, source, weight) {
    if (!source || !weight) return;

    Object.entries(source).forEach(([key, value]) => {
      target[key] = (target[key] || 0) + value * weight;
    });
  }

  // 20. MENGUBAH KATA PENCARIAN MENJADI VEKTOR.
  function addQueryTokens(target, query, weight) {
    const terms = tokenize(query);
    if (!terms.length) return;

    const counts = new Map();

    terms.forEach(term => {
      counts.set(term, (counts.get(term) || 0) + 1);
    });

    counts.forEach((count, term) => {
      const key = `term:${term}`;
      target[key] = (target[key] || 0) +
        (count / terms.length) * (idfMap.get(term) || 1) * weight;
    });
  }

  // 21. MENGAMBIL WAKTU AKTIVITAS.
  function getTimestamp(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  // 22. MENCARI BUKU BERDASARKAN ID ATAU JUDUL.
  function getBookForRecord(record, byId, byTitle) {
    const id = String(record.bookId || record.id_buku || '').trim();

    if (id && byId.has(id)) return byId.get(id);

    const title = normalizeText(record.judul || record.title);

    return title ? byTitle.get(title) || null : null;
  }

  // 23. MENGAMBIL KATEGORI DARI RIWAYAT AKTIVITAS.
  function getRecordCategory(record, byId, byTitle) {
    const directKey = categoryKey(record.categoryKey || record.kategori);

    if (directKey) return directKey;

    return getBookForRecord(record, byId, byTitle)?.categoryKey || '';
  }

  // 24. MEMERIKSA STATUS TRANSAKSI.
  function isCancelled(record) {
    return [
      'batal',
      'dibatalkan',
      'cancelled',
      'ditolak'
    ].includes(normalizeText(record.status));
  }

  // 25. MEMBENTUK PROFIL MINAT ANGGOTA.
  function buildMemberProfile(npm, searches, transactions, byId, byTitle) {
    const stats = Object.fromEntries(
      CATEGORIES.map(category => [
        category.key,
        {
          searchCount: 0,
          borrowCount: 0,
          score: 0,
          lastActivity: 0
        }
      ])
    );

    const vector = {};

    // Mengolah aktivitas pencarian.
    searches.filter(item =>
      String(item.npm || '').trim() === npm
    ).forEach(item => {
      const key = getRecordCategory(item, byId, byTitle);

      if (!stats[key]) return;

      stats[key].searchCount++;

      stats[key].lastActivity = Math.max(
        stats[key].lastActivity,
        getTimestamp(item.createdAt)
      );

      addQueryTokens(vector, item.query, SEARCH_WEIGHT * 0.5);

      const matchedBooks = [
        ...new Set(
          (Array.isArray(item.bookIds) ? item.bookIds : []).map(String)
        )
      ].map(id => byId.get(id)).filter(Boolean);

      if (matchedBooks.length) {
        matchedBooks.forEach(book => {
          addVector(
            vector,
            book.featureVector,
            SEARCH_WEIGHT * 0.5 / matchedBooks.length
          );
        });
      } else {
        const categoryVector = `category:${key}`;
        vector[categoryVector] = (vector[categoryVector] || 0) +
          SEARCH_WEIGHT * 0.5;
      }
    });

    // Mengolah aktivitas peminjaman.
    transactions.filter(item =>
      String(item.npm || '').trim() === npm && !isCancelled(item)
    ).forEach(item => {
      const key = getRecordCategory(item, byId, byTitle);

      if (!stats[key]) return;

      stats[key].borrowCount++;

      stats[key].lastActivity = Math.max(
        stats[key].lastActivity,
        getTimestamp(item.createdAt || item.tanggal)
      );

      const book = getBookForRecord(item, byId, byTitle);

      if (book) {
        addVector(vector, book.featureVector, BORROW_WEIGHT);
      } else {
        const categoryVector = `category:${key}`;
        vector[categoryVector] = (vector[categoryVector] || 0) +
          BORROW_WEIGHT;
      }
    });

    // Skor aktivitas: peminjaman diberi bobot lebih besar.
    CATEGORIES.forEach(category => {
      const item = stats[category.key];

      item.score =
        item.searchCount * SEARCH_WEIGHT +
        item.borrowCount * BORROW_WEIGHT;
    });

    // Minimal 3 pencarian ATAU 3 peminjaman.
    const qualified = CATEGORIES.filter(category =>
      stats[category.key].searchCount >= MIN_ACTIVITY ||
      stats[category.key].borrowCount >= MIN_ACTIVITY
    );

    return {
      npm,
      stats,
      vector: normalizeVector(vector),
      qualified
    };
  }

  // 26. MENGHITUNG EUCLIDEAN DISTANCE.
  function euclideanDistance(first, second) {
    const keys = new Set([
      ...Object.keys(first || {}),
      ...Object.keys(second || {})
    ]);

    let sum = 0;

    keys.forEach(key => {
      const difference =
        (first?.[key] || 0) - (second?.[key] || 0);

      sum += difference * difference;
    });

    return Math.sqrt(sum);
  }

  // 27. FALLBACK JIKA FITUR BUKU BELUM CUKUP.
  function getActivityWinner(profile) {
    return [...profile.qualified].sort((a, b) => {
      const first = profile.stats[a.key];
      const second = profile.stats[b.key];

      return second.score - first.score ||
        second.lastActivity - first.lastActivity;
    })[0] || null;
  }

  // 28. KLASIFIKASI MINAT BACA MENGGUNAKAN KNN.
  function classifyInterest(profile, books) {
    if (!profile.qualified.length) return null;

    const allowedCategories = new Set(
      profile.qualified.map(item => item.key)
    );

    const candidates = books.filter(book =>
      allowedCategories.has(book.categoryKey) &&
      book.featureVector
    );

    // Jika katalog tidak tersedia, gunakan skor aktivitas.
    if (!candidates.length || !Object.keys(profile.vector).length) {
      return getActivityWinner(profile);
    }

    // Menghitung jarak setiap buku terhadap profil anggota.
    const nearestBooks = candidates.map(book => ({
      book,
      distance: euclideanDistance(
        profile.vector,
        book.featureVector
      )
    })).sort((a, b) => a.distance - b.distance).slice(0, K);

    if (!nearestBooks.length) return getActivityWinner(profile);

    // Voting berbobot berdasarkan jarak terdekat.
    const votes = new Map();

    nearestBooks.forEach(item => {
      const key = item.book.categoryKey;
      const current = votes.get(key) || 0;

      votes.set(
        key,
        current + 1 / (item.distance + 0.05)
      );
    });

    // Menentukan kategori dengan suara terbesar.
    const ranked = [...votes.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];

      const first = profile.stats[a[0]];
      const second = profile.stats[b[0]];

      return second.score - first.score ||
        second.lastActivity - first.lastActivity;
    });

    const winningKey = ranked[0]?.[0];

    return CATEGORIES.find(item => item.key === winningKey) ||
      getActivityWinner(profile);
  }

  // 29. MENAMPILKAN NAMA DAN MINAT BACA ANGGOTA.
  function renderHome(session, profile, books) {
    // Nama profil dan sapaan selalu mengikuti akun login.
    renderMemberName(session);

    const interestElement = $('[data-reading-interest]');
    if (!interestElement) return;

    // Jika belum login atau belum memenuhi aktivitas minimal.
    if (!session?.npm || !profile) {
      interestElement.textContent = 'Belum terdeteksi';
      return;
    }

    const interest = classifyInterest(profile, books);

    interestElement.textContent = interest
      ? interest.label
      : 'Belum terdeteksi';
  }

  // 30. MEMUAT DATA DAN MENGHITUNG ULANG MINAT BACA.
  async function refreshHome() {
    if (refreshInProgress) return;

    refreshInProgress = true;

    // Nama dapat langsung ditampilkan sebelum katalog selesai dimuat.
    const session = readSession();
    renderMemberName(session);

    try {
      const searches = readArray(SEARCH_KEY);
      const transactions = readArray(TRANSACTION_KEY);
      const books = await loadCatalog();

      const byId = new Map(
        books.map(book => [book.id, book])
      );

      const byTitle = new Map(
        books.map(book => [normalizeText(book.title), book])
      );

      const profile = session?.npm
        ? buildMemberProfile(
            session.npm,
            searches,
            transactions,
            byId,
            byTitle
          )
        : null;

      renderHome(session, profile, books);
    } catch (error) {
      console.error('Gagal menghitung minat baca:', error);

      const interestElement = $('[data-reading-interest]');

      if (interestElement) {
        interestElement.textContent = 'Belum terdeteksi';
      }
    } finally {
      refreshInProgress = false;
    }
  }

  // 31. INISIALISASI DAN PEMBARUAN BERANDA.
  function initialize() {
    refreshHome();

    // Perbarui ketika kembali dari halaman pencarian/detail.
    window.addEventListener('pageshow', refreshHome);
    window.addEventListener('focus', refreshHome);

    // Perbarui ketika halaman aktif kembali.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshHome();
    });

    // Perbarui jika data berubah dari tab browser lain.
    window.addEventListener('storage', event => {
      if (
        event.key === SEARCH_KEY ||
        event.key === TRANSACTION_KEY ||
        event.key === ACCOUNT_KEY
      ) {
        refreshHome();
      }
    });
  }

  // 32. MENJALANKAN PROGRAM SETELAH HTML SIAP.
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
