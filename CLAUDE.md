# Nael Capital

Pembukuan koperasi simpan-pinjam harian: kolektor menagih di lapangan, kasir
menerima setoran sore, pengawas memeriksa, bos memegang kendali. Repo ini
membangun ulang aplikasi lama dari akarnya — **rancangan database di
`docs/skema/` adalah acuannya**.

Berkomunikasi dengan pemilik dalam **bahasa Indonesia**.

## Struktur monorepo (Bun workspaces)

| Folder | Isi |
|---|---|
| `apps/api` | Server HTTP + database (satu-satunya yang menyentuh Postgres). |
| `apps/mobile` | Aplikasi Android/iOS untuk kolektor, kasir, pengawas, bos. |
| `apps/web` | Dasbor web bos/pengawas. |
| `packages/contracts` | Skema Zod bentuk permintaan & respons API — dipakai bersama server dan klien. |
| `packages/domain` | Aturan usaha murni tanpa I/O: rumus akad, jadwal tagih, aturan macet, rumus kas. Dipakai server dan aplikasi (pratinjau di HP). |
| `docs/skema` | Rancangan database final, satu dokumen per tabel. |

Arah ketergantungan: `apps/*` → `packages/*`; `packages/domain` tidak
bergantung pada apa pun; `packages/contracts` hanya pada `zod` (dan `domain`
bila perlu tipe).

## Stack (diputuskan 23 Okt 2026)

### Pondasi

| Alat | Untuk apa |
|---|---|
| **Bun** | Runtime, package manager (workspaces), uji (`bun test`), build. |
| **TypeScript `strict`** | Semua paket; `tsconfig` dasar bersama di root. |
| **Biome** | Lint + format semua paket (pengganti ESLint + Prettier). |

### `apps/api`

| Alat | Untuk apa |
|---|---|
| **Hono** di `Bun.serve` | Rute HTTP. |
| **`@hono/zod-openapi`** + **Zod** | Validasi, tipe, dan OpenAPI dari satu definisi rute; juga validasi `.env` saat server menyala. |
| **Scalar** (`@scalar/hono-api-reference`) | Halaman dokumentasi API. |
| **Drizzle ORM** + **drizzle-kit** | Kueri bertipe & migrasi; trigger/fungsi/`EXCLUDE` lewat migrasi SQL kustom. |
| **postgres.js** | Driver Postgres (Supabase dev & VPS). `bigint` rupiah → `number`. |
| **`Bun.password`** (argon2id) | Hash kata sandi bos — tanpa paket native. |
| **`hono/jwt`** | Token akses; token refresh per perangkat sesuai [schema-perangkat.md](docs/skema/schema-perangkat.md). |
| **hono-rate-limiter** (memori) | Batas permintaan — satu proses, tanpa Redis. |
| **pino** | Log terstruktur JSON. |
| **croner** | Jadwal dalam proses: sapuan tengah malam, pembersihan foto sementara. |
| Penyimpanan berkas: satu antarmuka, dua penggerak | **Disk lokal** (dev & VPS) atau **S3** via `Bun.s3` (mis. Cloudflare R2). |

Sengaja **tidak** dipakai: Redis (kunci idempoten disimpan di Postgres),
Sharp (HP sudah mengompres & menyimpan ulang foto; server memeriksa tipe dari
isi berkas, ukuran, SHA-256).

### Paket bersama

| Paket | Isi |
|---|---|
| `packages/contracts` | Skema Zod permintaan & respons — dipakai rute Hono dan formulir klien. |
| `packages/domain` | Aturan usaha murni: rumus akad, jadwal tagih, macet, rumus kas, kalender kantor (tanggal = teks `YYYY-MM-DD`; WIB/WITA/WIT offset tetap, tanpa pustaka tanggal). |

### `apps/mobile`

| Alat | Untuk apa |
|---|---|
| **Expo** (SDK terbaru) + **Expo Router** | Aplikasi Android/iOS. |
| **EAS Build + EAS Update** | APK & pembaruan OTA. |
| **NativeWind** | Gaya (Tailwind untuk React Native), senada dengan web. |
| Klien RPC Hono (`hc`) per modul + **TanStack Query** | Data. Kiriman gagal diulang otomatis dengan **kunci idempoten** yang sama — tanpa mode offline penuh (sinyal buruk jarang). |
| **react-hook-form** + Zod | Formulir dengan skema dari `contracts`. |
| **expo-camera** | Foto serah terima (kamera saja, bukan galeri) & pemindai QR. |
| **expo-image-manipulator** | Kompres & simpan ulang foto (±200 KB, EXIF terbuang). |
| **expo-location** | GPS titik rumah & lokasi foto. |
| **expo-secure-store** | Token perangkat. |

### `apps/web`

| Alat | Untuk apa |
|---|---|
| **React + Vite** | Dasbor bos & pengawas (SPA statis). |
| **TanStack Router** | Navigasi bertipe. |
| **TanStack Query** + `hc` | Data. |
| **TanStack Table** | Tabel besar (nasabah, transaksi, buku kas). |
| **Tailwind CSS + shadcn/ui** | Tampilan. |
| **Recharts** | Grafik harian. |

### Uji

- `packages/domain`: uji murni (rumus akad, macet, jadwal, kas).
- `apps/api`: rute lewat `app.request(...)` tanpa menyalakan server; uji yang
  menyentuh database **hanya ke Supabase dev** (dijaga pemeriksaan host); uji
  skema memastikan CHECK, FK, dan trigger menolak data salah.

### Lingkungan

| | Database | Server |
|---|---|---|
| Pengembangan | Supabase (Postgres polos) | `bun --watch` |
| Produksi | PostgreSQL di VPS | `bun build --compile` (satu berkas program) + systemd, di belakang **Nginx** (sudah terpasang; Caddy ditimbang lagi saat rilis) — Nginx juga melayani berkas statis `apps/web`. |

### Catatan Hono

- **Rute dipecah per modul** (`kantor`, `pengguna`, `pinjaman`, …) dan klien
  RPC dibuat per modul — satu tipe gabungan raksasa memperlambat `tsc`.
- **Bentuk data tetap di `packages/contracts`** (Zod); rute Hono memakainya,
  bukan mendefinisikan ulang.
- Middleware yang dirangkai sendiri: log (pino), rate limit, penerjemah galat
  domain → respons HTTP.

## Database

- **`docs/skema/` adalah sumber kebenaran.** Ubah dokumennya lebih dulu (dan
  sepakati dengan pemilik), baru skema Drizzle & migrasinya. Konvensi penamaan
  ada di `docs/skema/README.md` — wajib diikuti: `kantor_id`, `dibuat_at`,
  `<kejadian>_at` + `<kejadian>_oleh`, `alasan_<kejadian>`, boolean tanpa
  `is_`, nama constraint berpola.
- **Postgres polos.** Jangan memakai fitur khusus Supabase (Auth, Storage,
  RLS, Realtime, Edge Functions) — produksi berjalan di Postgres VPS dan harus
  pindah tanpa mengubah kode. Supabase hanya tempat Postgres pengembangan.
- **Uang**: `bigint` rupiah, tanpa pecahan. Tabel uang **hanya bertambah** —
  salah catat dibatalkan (`dibatalkan_at/_oleh/alasan_batal`), tidak disunting
  atau dihapus. Riwayat (`riwayat_perubahan`) hanya untuk data yang ditimpa
  atau dihapus.
- **Tanggal pembukuan** = kalender kantor (`kantor.zona_waktu`), kolom `date`.
- **Tenant**: setiap kueri dibatasi `kantor_id` dari token; FK gabungan
  `(x_id, kantor_id)` menjaga data lintas kantor.
- CHECK yang melibatkan kolom boleh kosong ditulis dengan `IS NOT NULL`
  eksplisit — CHECK meloloskan NULL.

## Aturan kerja

- **Skrip yang menulis atau menghapus isi database** (seed, drop, reset, data
  uji) wajib menolak berjalan bila host `DATABASE_URL` bukan Supabase dev
  (berakhiran `.supabase.com`). Produksi tidak pernah disentuh dari mesin
  pengembang.
- **Jangan menjalankan `expo web`** atau server pratinjau web untuk aplikasi
  mobile. Verifikasi lewat `tsc`/lint/uji, lalu pemilik mencoba di HP-nya.
- **Rahasia** (`DATABASE_URL`, kunci JWT, kunci penyimpanan berkas) hanya di
  `.env` — tidak pernah di-commit. Sediakan `.env.example`.
- **Commit lokal**; push hanya bila pemilik meminta.
- Repo lama (`desktop\re-launching\naelcapital` dan `naelcapitalAPI`) masih
  dipakai karyawan di lapangan — **jangan mengubah branch `main` repo lama**.

## Perintah

Dari root repo:

| Perintah | Isi |
|---|---|
| `bun install` | Pasang dependensi semua paket (satu `bun.lock`). |
| `bun run typecheck` | `tsc --noEmit` di setiap paket. |
| `bun test` | Semua uji di semua paket. |
| `bun run lint` | Biome: lint + cek format (Markdown & `docs/` tidak ikut). |
| `bun run format` | Biome: rapikan kode & urutkan import. |

Per paket (`cd apps/<nama>`):

| Paket | Perintah |
|---|---|
| `apps/api` | `bun run dev` (server + muat ulang otomatis, port dari `.env`, bawaan 3000); dokumentasi API di `/dokumentasi`, OpenAPI di `/openapi.json`. |
| `apps/web` | `bun run build` (berkas statis ke `dist/`); `bun run dev` untuk pengembangan dasbor. |
| `apps/mobile` | `bun run start` (Metro untuk development build / Expo Go di HP); paket ber-kode native dipasang dengan `bunx expo install <paket>` (versi cocok SDK), bukan `bun add`; `bunx expo-doctor` untuk memeriksa. **Tidak ada skrip & tidak pernah `expo web`.** Rute di `src/app/` (Expo Router); panduan resmi Expo ada di `apps/mobile/AGENTS.md`. |

Catatan instalasi: `bunfig.toml` memakai `linker = "hoisted"` — instalasi
isolated (bawaan Bun 1.3) membuat salinan ganda `expo`/`react-native` yang
ditolak `expo-doctor`. `react`/`react-dom` di `apps/web` disamakan persis
dengan versi yang dipatok Expo di `apps/mobile`.

Migrasi database ditambahkan bersama skema Drizzle pertama.

Pemeriksaan sebelum commit: `bun run typecheck && bun test && bun run lint`.
