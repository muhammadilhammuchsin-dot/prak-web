# E-Perpustakaan Universitas Khairun (Frontend: HTML + CSS)

Cara membuka: buka folder ini di VS Code, klik kanan `index.html`, pilih **Open with Live Server**.
`index.html` hanya mengarahkan ke halaman login anggota.

## Struktur folder (dipisah per peran)

| Folder | Isi |
|---|---|
| `anggota/` | `login`, `daftar`, `lupa-password`, `beranda`, `cari` (+ 4 hasil per kategori), `detail` |
| `pustakawan/` | `login`, `daftar`, `lupa-password`, `beranda`, `data-buku`, `tambah-buku`, `data-anggota`, `transaksi` |
| `kepus/` | `login`, `daftar`, `lupa-password`, `laporan` (diagram donat dan batang) |
| `css/style.css` | Seluruh tampilan, dipakai semua halaman |
| `assets/` | Logo dan sampul buku |

## Alur halaman
- Login (tab Anggota / Pustakawan / Kepus saling menaut) -> beranda atau laporan sesuai peran.
- Anggota: beranda -> cari buku -> detail buku.
- Pustakawan: sidebar Beranda / Data Buku / Data Anggota / Transaksi; Data Buku -> Tambah Buku.

## Penerapan indikator penilaian
- **HTML semantik:** `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`; satu `h1` per halaman, lalu `h2` dan `h3`; `label for`, `caption`, `thead`, `th scope`.
- **Layout:** Flexbox (navbar, sidebar, tab), Grid (kartu buku, form, statistik), positioning (`sticky` sidebar, `absolute` ikon di kolom, dropdown).
- **Tipografi:** satu skala ukuran (`--text-xs` sampai `--text-2xl`), `line-height` 1,6 untuk isi dan 1,25 untuk judul, font Plus Jakarta Sans dan Inter.
- **Warna dan ukuran:** semua nilai berupa variabel di `:root` (bagian 1 `style.css`).
- **Pemisahan HTML dan CSS:** tidak ada atribut `style` di HTML; class memakai pola BEM (`.book-card__title`, `.btn--navy`); selector berbasis class; tidak ada duplikasi aturan.
