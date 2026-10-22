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

## Stack

| Bagian | Pilihan |
|---|---|
| Runtime & package manager | Bun (workspaces), TypeScript `strict` di semua paket |
| API | Fastify 5 + `fastify-type-provider-zod`, Zod untuk validasi |
| Database | PostgreSQL — **dev: Supabase**, **produksi: Postgres di VPS** |
| Akses data | Drizzle ORM (driver `postgres`), migrasi `drizzle-kit`; trigger/fungsi/`EXCLUDE` lewat migrasi SQL kustom |
| Kata sandi | argon2 |
| Mobile | Expo (React Native) + Expo Router |
| Web | React + Vite |
| Data klien | TanStack Query |
| Uji | `bun test` |

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

Diisi saat kerangka paket dibuat (`bun install`, `bun test`, typecheck,
migrasi).
