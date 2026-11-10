
/* E-PERPUSTAKAAN: PENENTUAN MINAT BACA DENGAN KNN.
   Tidak menampilkan rekomendasi buku pada beranda.
   Minat muncul setelah minimal 3 pencarian ATAU 3 peminjaman pada kategori yang sama.
   Fitur buku: judul, kategori, penulis, dan deskripsi menggunakan TF-IDF.
   KNN: Euclidean Distance, K=3. */
(() => {
  'use strict';
  const DB_NAME = 'eperpus_pustakawan';
  const DB_VERSION = 1;
  const STORE_NAME = 'books';
  const SEARCH_KEY = 'eperpus_anggota_search_history';
  const TRANSACTION_KEY = 'eperpus_demo_transactions';
  const SESSION_KEYS = ['eperpus_demo_session', 'eperpus_anggota_session'];
  const MIN_ACTIVITY = 3;
  const K = 3;
  const SEARCH_WEIGHT = 1;
  const BORROW_WEIGHT = 3;
  const FIELD_WEIGHTS = { title: 2.2, category: 1.5, description: 1.5, author: 0.25 };
  const CATEGORIES = [
    { key: 'informatika', label: 'Informatika' },
    { key: 'sains', label: 'Sains & Matematika' },
    { key: 'sosial', label: 'Sosial & Bisnis' },
    { key: 'sastra', label: 'Sastra & Bahasa' }
  ];
  const CATEGORY_PAGES = [
    { key: 'informatika', label: 'Informatika & Komputer', file: 'cari-informatika.html' },
    { key: 'sains', label: 'Sains & Matematika', file: 'cari-sains.html' },
    { key: 'sosial', label: 'Sosial & Bisnis', file: 'cari-sosial.html' },
    { key: 'sastra', label: 'Sastra & Bahasa', file: 'cari-sastra.html' }
  ];
  const STOP_WORDS = new Set([
    'dan','yang','di','ke','dari','untuk','dengan','pada','oleh','atau','dalam','ini','itu','sebagai','tentang','adalah','dapat','akan',
    'the','and','for','with','from','into','of','to','dr','ir','prof','phd','mkom','mcs','mpd','msc'
  ]);
  const $ = (selector, root = document) => root.querySelector(selector);
  let idfMap = new Map();
  let refreshInProgress = false;

  // Menyamakan format teks agar pencocokan kategori konsisten.
  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('id').replace(/\s+/g, ' ').trim();
  }

  // Mengubah nama kategori menjadi kode internal.
  function categoryKey(value) {
    const text = normalizeText(value);
    if (text.includes('informatika') || text.includes('komputer') || text.includes('sistem informasi')) return 'informatika';
    if (text.includes('sains') || text.includes('matematika')) return 'sains';
    if (text.includes('sosial') || text.includes('bisnis')) return 'sosial';
    if (text.includes('sastra') || text.includes('bahasa')) return 'sastra';
    return '';
  }

  function categoryLabel(key) {
    return CATEGORIES.find(item => item.key === key)?.label || 'Kategori lainnya';
  }

  // Memecah teks menjadi token untuk TF-IDF.
  function tokenize(value) {
    const words = normalizeText(value).match(/[\p{L}\p{N}]{2,}/gu) || [];
    return words.filter(word => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
  }

  // Membaca array dari localStorage melalui helper aplikasi jika tersedia.
  function readArray(key) {
    try {
      const value = typeof window.EPerpus?.read === 'function'
        ? window.EPerpus.read(key, [])
        : JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error(`Data ${key} tidak dapat dibaca:`, error);
      return [];
    }
  }

  // Membaca sesi login dan nama akun anggota.
  function readSession() {
    for (const key of SESSION_KEYS) {
      try {
        const session = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (!session?.npm) continue;
        const npm = String(session.npm).trim();
        let nama = String(session.nama || '').trim();
        let prodi = String(session.prodi || '').trim();

        // Jika nama tidak ada di sesi, cari dari akun terdaftar.
        if (!nama) {
          const accounts = readArray('eperpus_demo_accounts');
          const account = accounts.find(item => String(item.npm || '').trim() === npm);
          nama = String(account?.nama || '').trim();
          if (!prodi) prodi = String(account?.prodi || '').trim();
        }

        return { ...session, npm, nama: nama || 'Anggota', prodi };
      } catch (error) {
        console.warn(`Sesi ${key} tidak valid:`, error);
      }
    }
    return null;
  }

  // Menampilkan nama sesuai akun yang sedang login.
  function renderMemberName(session) {
    const nama = String(session?.nama || '').trim() || 'Anggota';
    document.querySelectorAll('[data-member-name]').forEach(element => {
      element.textContent = nama;
    });
  }

  // Membaca data buku admin dari IndexedDB.
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

      request.onerror = () => reject(request.error || new Error('IndexedDB gagal dibuka.'));

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          resolve([]);
          return;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const getAll = tx.objectStore(STORE_NAME).getAll();

        getAll.onsuccess = () => resolve(Array.isArray(getAll.result) ? getAll.result : []);
        getAll.onerror = () => reject(getAll.error || new Error('Data buku admin gagal dibaca.'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    });
  }

  // Menyeragamkan data buku admin.
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
      categoryText: String(record.kategori || categoryLabel(key)).trim(),
      description: String(record.deskripsi || '').trim(),
      source: 'indexeddb'
    };
  }

  // Membaca buku statis dari halaman kategori.
  async function getStaticBooks() {
    const results = await Promise.allSettled(CATEGORY_PAGES.map(async category => {
      const pageUrl = new URL(category.file, window.location.href);
      const response = await fetch(pageUrl.href, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${category.file}: HTTP ${response.status}`);

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      return [...doc.querySelectorAll('.book-grid .book-card')].map(card => {
        const title = card.querySelector('.book-card__title')?.textContent.replace(/\s+/g, ' ').trim() || '';
        if (!title) return null;

        const tag = card.querySelector('.tag')?.textContent.trim() || category.label;
        const imagePath = card.querySelector('.cover__image')?.getAttribute('src') || '';
        const label = card.querySelector('.cover__label')?.textContent || '';
        const idFromLabel = label.match(/ID\s*:\s*([\w-]+)/i)?.[1] || '';
        const idFromImage = imagePath.match(/(?:^|\/)([\w-]+)\.(?:jpe?g|png|webp)(?:[?#].*)?$/i)?.[1] || '';

        return {
          id: card.dataset.bookId || idFromLabel || idFromImage,
          title,
          author: card.querySelector('.book-card__author')?.textContent.trim() || '',
          categoryKey: category.key,
          categoryLabel: categoryLabel(category.key),
          categoryText: `${category.label} ${tag}`,
          description: card.querySelector('.book-card__text, .book-card__description, [data-book-description]')?.textContent.trim() || '',
          source: 'html'
        };
      }).filter(book => book && book.id);
    }));

    return results.flatMap(result =>
      result.status === 'fulfilled' ? result.value : (console.warn(result.reason), [])
    );
  }

  // Menggabungkan katalog HTML dan buku admin tanpa ID ganda.
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
      if (book.id && !booksById.has(book.id)) booksById.set(book.id, book);
    });

    adminRecords.map(normalizeAdminBook).filter(Boolean).forEach(book => {
      if (!booksById.has(book.id)) booksById.set(book.id, book);
      else console.warn(`ID buku ${book.id} sudah ada di katalog HTML; record admin dilewati.`);
    });

    const books = [...booksById.values()];
    buildBookVectors(books);
    return books;
  }

  // Membentuk vektor TF-IDF dari judul, kategori, penulis, dan deskripsi.
  function buildBookVectors(books) {
    const docs = books.map(book => ({
      book,
      title: tokenize(book.title),
      category: tokenize(`${book.categoryLabel} ${book.categoryText}`),
      author: tokenize(book.author),
      description: tokenize(book.description)
    }));

    const documentFrequency = new Map();
    docs.forEach(doc => {
      const uniqueTerms = new Set([...doc.title, ...doc.category, ...doc.author, ...doc.description]);
      uniqueTerms.forEach(term => {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      });
    });

    const totalDocuments = Math.max(docs.length, 1);
    idfMap = new Map([...documentFrequency.entries()].map(([term, count]) => [
      term,
      Math.log((totalDocuments + 1) / (count + 1)) + 1
    ]));

    docs.forEach(doc => {
      const vector = { [`category:${doc.book.categoryKey}`]: 1.5 };

      [['title', doc.title], ['category', doc.category], ['author', doc.author], ['description', doc.description]].forEach(([field, terms]) => {
        if (!terms.length) return;

        const counts = new Map();
        terms.forEach(term => counts.set(term, (counts.get(term) || 0) + 1));

        counts.forEach((count, term) => {
          const tf = count / terms.length;
          const idf = idfMap.get(term) || 1;
          const vectorKey = `term:${term}`;
          vector[vectorKey] = (vector[vectorKey] || 0) + tf * idf * FIELD_WEIGHTS[field];
        });
      });

      doc.book.featureVector = normalizeVector(vector);
    });
  }

  // Normalisasi L2 agar skala vektor sebanding.
  function normalizeVector(vector) {
    const norm = Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));
    if (!norm) return vector;
    Object.keys(vector).forEach(key => { vector[key] /= norm; });
    return vector;
  }

  function addVector(target, source, weight) {
    if (!source || !weight) return;
    Object.entries(source).forEach(([key, value]) => {
      target[key] = (target[key] || 0) + value * weight;
    });
  }

  // Mengubah kata pencarian menjadi vektor fitur.
  function addQueryTokens(target, query, weight) {
    const terms = tokenize(query);
    if (!terms.length) return;

    const counts = new Map();
    terms.forEach(term => counts.set(term, (counts.get(term) || 0) + 1));

    counts.forEach((count, term) => {
      const key = `term:${term}`;
      target[key] = (target[key] || 0) +
        (count / terms.length) * (idfMap.get(term) || 1) * weight;
    });
  }

  function getTimestamp(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function getBookForRecord(record, byId, byTitle) {
    const id = String(record.bookId || record.id_buku || '').trim();
    if (id && byId.has(id)) return byId.get(id);

    const title = normalizeText(record.judul || record.title);
    return title ? byTitle.get(title) || null : null;
  }

  function getRecordCategory(record, byId, byTitle) {
    const directKey = categoryKey(record.categoryKey || record.kategori);
    if (directKey) return directKey;
    return getBookForRecord(record, byId, byTitle)?.categoryKey || '';
  }

  // Transaksi batal atau ditolak tidak dihitung sebagai peminjaman.
  function isCancelled(record) {
    return ['batal', 'dibatalkan', 'cancelled', 'ditolak'].includes(normalizeText(record.status));
  }

  // Membentuk profil aktivitas dan fitur setiap anggota.
  function buildMemberProfile(npm, searches, transactions, byId, byTitle) {
    const stats = Object.fromEntries(CATEGORIES.map(category => [
      category.key,
      { searchCount: 0, borrowCount: 0, score: 0, lastActivity: 0 }
    ]));

    const vector = {};

    // Aktivitas pencarian.
    searches.filter(item => String(item.npm || '').trim() === npm).forEach(item => {
      const key = getRecordCategory(item, byId, byTitle);
      if (!stats[key]) return;

      stats[key].searchCount++;
      stats[key].lastActivity = Math.max(
        stats[key].lastActivity,
        getTimestamp(item.createdAt)
      );

      addQueryTokens(vector, item.query, SEARCH_WEIGHT * 0.5);

      const matchedBooks = [
        ...new Set((Array.isArray(item.bookIds) ? item.bookIds : []).map(String))
      ].map(id => byId.get(id)).filter(Boolean);

      if (matchedBooks.length) {
        matchedBooks.forEach(book => {
          addVector(vector, book.featureVector, SEARCH_WEIGHT * 0.5 / matchedBooks.length);
        });
      } else {
        vector[`category:${key}`] = (vector[`category:${key}`] || 0) + SEARCH_WEIGHT * 0.5;
      }
    });

    // Aktivitas peminjaman dengan bobot 3.
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
        vector[`category:${key}`] = (vector[`category:${key}`] || 0) + BORROW_WEIGHT;
      }
    });

    // Skor aktivitas untuk membantu penentuan jika hasil voting seri.
    CATEGORIES.forEach(category => {
      const item = stats[category.key];
      item.score = item.searchCount * SEARCH_WEIGHT +
        item.borrowCount * BORROW_WEIGHT;
    });

    // Minat baru dapat ditampilkan setelah 3 pencarian ATAU 3 peminjaman.
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

  // Menghitung Euclidean Distance antara profil anggota dan fitur buku.
  function euclideanDistance(first, second) {
    const keys = new Set([
      ...Object.keys(first || {}),
      ...Object.keys(second || {})
    ]);

    let sum = 0;
    keys.forEach(key => {
      const difference = (first?.[key] || 0) - (second?.[key] || 0);
      sum += difference * difference;
    });

    return Math.sqrt(sum);
  }

  // KNN: mengambil K buku terdekat lalu melakukan voting kategori.
  function classifyInterest(profile, books) {
    if (!profile.qualified.length) return null;

    const allowedCategories = new Set(profile.qualified.map(item => item.key));
    const candidates = books.filter(book =>
      allowedCategories.has(book.categoryKey)
    );

    // Fallback jika katalog atau fitur buku belum tersedia.
    if (!candidates.length || !Object.keys(profile.vector).length) {
      return [...profile.qualified].sort((a, b) => {
        const first = profile.stats[a.key];
        const second = profile.stats[b.key];
        return second.score - first.score ||
          second.lastActivity - first.lastActivity;
      })[0] || null;
    }

    const nearestBooks = candidates.map(book => ({
      book,
      distance: euclideanDistance(profile.vector, book.featureVector || {})
    })).sort((a, b) => a.distance - b.distance).slice(0, K);

    // Voting berbobot: buku yang jaraknya lebih dekat memiliki suara lebih besar.
    const votes = new Map();

    nearestBooks.forEach(item => {
      const key = item.book.categoryKey;
      const vote = votes.get(key) || { score: 0, neighbors: 0 };
      vote.score += 1 / (item.distance + 0.05);
      vote.neighbors++;
      votes.set(key, vote);
    });

    const ranked = [...votes.entries()].sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;

      const first = profile.stats[a[0]];
      const second = profile.stats[b[0]];

      return second.score - first.score ||
        second.lastActivity - first.lastActivity;
    });

    const winningKey = ranked[0]?.[0];
    return CATEGORIES.find(category => category.key === winningKey) || null;
  }

  // Menghapus panel rekomendasi lama jika masih tersisa di HTML.
  function removeRecommendationUI() {
    document.querySelectorAll('[data-knn-section]').forEach(section => section.remove());

    const heading = [...document.querySelectorAll('h1,h2,h3')].find(element =>
      normalizeText(element.textContent).includes('rekomendasi buku untuk anda')
    );

    heading?.closest('section')?.remove();
  }

  // Menampilkan hanya kategori minat baca anggota.
  function renderInterest(session, profile, books) {
    const interestElement = $('[data-reading-interest]');
    if (!interestElement) return;

    if (!session?.npm || !profile) {
      interestElement.textContent = 'Belum terdeteksi';
      return;
    }

    const interest = classifyInterest(profile, books);
    interestElement.textContent = interest ? interest.label : 'Belum terdeteksi';
  }

  // Memuat data dan menghitung ulang minat baca anggota.
  async function refreshInterest() {
    if (refreshInProgress) return;
    refreshInProgress = true;

    try {
      removeRecommendationUI();

      const session = readSession();
      renderMemberName(session);

      const searches = readArray(SEARCH_KEY);
      const transactions = readArray(TRANSACTION_KEY);
      const books = await loadCatalog();

      const byId = new Map(books.map(book => [book.id, book]));
      const byTitle = new Map(books.map(book => [normalizeText(book.title), book]));

      const profile = session?.npm
        ? buildMemberProfile(session.npm, searches, transactions, byId, byTitle)
        : null;

      renderInterest(session, profile, books);
    } catch (error) {
      console.error('Gagal menghitung minat baca dengan KNN:', error);

      const interestElement = $('[data-reading-interest]');
      if (interestElement) interestElement.textContent = 'Belum terdeteksi';
    } finally {
      refreshInProgress = false;
    }
  }

  // Memperbarui data ketika anggota kembali ke halaman beranda.
  function initialize() {
    removeRecommendationUI();
    refreshInterest();

    window.addEventListener('pageshow', refreshInterest);
    window.addEventListener('focus', refreshInterest);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshInterest();
    });

    window.addEventListener('storage', event => {
      if (event.key === SEARCH_KEY || event.key === TRANSACTION_KEY) {
        refreshInterest();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
