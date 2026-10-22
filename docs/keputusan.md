# Catatan keputusan

Satu baris per keputusan besar: **apa** yang diputuskan, **kenapa**, dan apa
yang **ditolak**. Keputusan per tabel (kolom, aturan, nama) ada di dokumen
tabelnya di [`skema/`](skema/README.md); di sini hanya yang lintas bagian.

Keputusan baru ditambahkan di **bawah**; keputusan yang diganti tidak dihapus —
barisnya diberi keterangan "diganti oleh …".

## Produk & data

| Tanggal | Keputusan | Kenapa | Ditolak |
|---|---|---|---|
| 21 Okt 2026 | **Skema database dirancang ulang dari akar**, satu dokumen per tabel di `docs/skema/` sebagai acuan; perubahan skema selalu lewat dokumennya dulu. | Skema lama berkali-kali berubah arah langsung di kode; desain perlu matang lewat diskusi sebelum ada kode. | Merombak skema lama sedikit demi sedikit. |
| 21 Okt 2026 | **Empat peran**: bos, kasir, pengawas, kolektor — `kasir` bukan `admin` serba-bisa. | Kasir hanya menerima setoran sore; peran serba-bisa membuka celah izin. | Tiga peran (tanpa kasir); peran admin. |
| 21 Okt 2026 | **Kasir hanya membuat catatan; menyunting, membatalkan, mengoreksi hanya bos.** | Orang yang memegang uang tak boleh menjadi satu-satunya saksi atas catatannya sendiri. | Kasir boleh mengoreksi; konfirmasi dua arah bos–kolektor. |
| 22 Okt 2026 | **Tabel uang hanya bertambah** — salah catat dibatalkan (kolom batal), tidak disunting/dihapus. **Tanda bukan uang** (libur, dsb.) dihapus dengan jejak di riwayat. | Jejak uang yang bisa disunting bukan jejak; tanda non-uang dibaca banyak tempat, kolom batal di sana rawan lupa disaring. | Semua tabel memakai kolom batal; semua disunting dengan riwayat. |
| 22 Okt 2026 | **Riwayat perubahan hanya untuk data yang ditimpa atau dihapus**; tabel yang hanya bertambah adalah jejaknya sendiri. | Tanpa pencatatan ganda. | Semua kejadian ditulis juga ke riwayat. |
| 22 Okt 2026 | **Foto serah terima wajib** di akad & gulung (nasabah memegang uangnya); KTP opsional. | Bukti uang benar-benar diterima orang sungguhan. | Foto wajah saja; tanpa foto. |
| 23 Okt 2026 | **Tekor dihitung sistem** dari uang tunai yang diterima kasir, tidak diketik. | Tak bisa diisi sembarang. | Tekor diinput tangan. |
| 23 Okt 2026 | **Hitung buta**: kasir (serah terima) dan pengawas (pencocokan kas) mengisi uang yang dihitung tanpa melihat angka seharusnya. | Hitungan tidak "menyesuaikan diri" dengan angka buku. | Menampilkan angka seharusnya lebih dulu. |
| 23 Okt 2026 | **Pekan kerja bertanggal** (tabel `pekan_kerja`), tidak boleh mundur. | Mengganti hari kerja tak boleh menggeser jadwal & tunggakan hari lampau. | Satu kolom `kantor.hari_kerja` + peringatan. |
| 23 Okt 2026 | **Aplikasi web khusus bos; aplikasi HP khusus kasir, pengawas, kolektor.** Di HP tidak ada login nomor HP + kata sandi atau registrasi — hanya tautan QR. | Keputusan pemilik: bos bekerja dari web, karyawan dari HP. | Satu aplikasi HP untuk semua peran. |
| 23 Okt 2026 | **Registrasi kantor baru wajib kode** (`KODE_REGISTRASI` di server). | Tanpa kode siapa pun yang tahu alamat API bisa membuat kantor sendiri. | Registrasi terbuka. |

## Teknik

| Tanggal | Keputusan | Kenapa | Ditolak |
|---|---|---|---|
| 23 Okt 2026 | **Repo baru (monorepo) dibangun dari nol** mengikuti `docs/skema/`; repo lama tetap dipakai lapangan sampai peralihan. | Skema, nama, peran, dan kontrak semuanya baru — merombak repo lama sama dengan menulis ulang sambil menjaga yang berjalan. | Merombak repo lama di tempat. |
| 23 Okt 2026 | **Database: Supabase untuk pengembangan (proyek baru khusus repo ini), PostgreSQL di VPS untuk produksi**; hanya Postgres polos. | Pindah ke VPS tanpa mengubah kode; proyek terpisah tak mengganggu lingkungan uji repo lama. | Fitur khusus Supabase (Auth, Storage, RLS); berbagi proyek Supabase dengan repo lama. |
| 23 Okt 2026 | **Bun** sebagai runtime, package manager (workspaces), dan penguji. | Satu alat; cepat. | Node + pnpm. |
| 23 Okt 2026 | **Hono** (+ `@hono/zod-openapi`) untuk API, bukan Fastify. | Asli di Bun (standar Web), ringan, dan klien RPC `hc` menyambungkan tipe sampai ke aplikasi. | Fastify (dipilih semula demi kesinambungan dengan repo lama). |
| 23 Okt 2026 | **Drizzle ORM** + `drizzle-kit`; trigger, fungsi, `EXCLUDE` lewat migrasi SQL kustom. | Kueri bertipe dengan SQL yang tetap terbaca. | — |
| 23 Okt 2026 | **Web: React + Vite (SPA statis)**, TanStack Router/Query, Tailwind. | Dasbor di balik login tak butuh SEO; satu paradigma dengan HP (React); satu server saja (Hono); dilayani Nginx sebagai berkas statis. | Next.js, Nuxt (server kedua, SSR tak terpakai); SvelteKit (paradigma kedua); Expo web (kikuk untuk dasbor). |
| 23 Okt 2026 | **HP: Expo SDK 58** + Expo Router + NativeWind. | Proyek baru mulai dari versi terbaru; Expo Go toko segera hanya mendukung SDK 58. | SDK 57 (harus segera di-upgrade). |
| 23 Okt 2026 | **Tanpa mode offline penuh**: kiriman gagal diulang otomatis dengan kunci idempoten. | Sinyal buruk jarang; offline penuh jauh lebih rumit (tanggal, kunci, konflik). | Setoran disimpan di HP lalu dikirim belakangan. |
| 23 Okt 2026 | **Tanpa Redis**: pembatas percobaan di memori proses; kunci idempoten di Postgres. | Satu proses di satu VPS. | Redis. |
| 23 Okt 2026 | **Bun mode `hoisted`** (`bunfig.toml`). | Mode isolated membuat salinan ganda `expo`/`react-native` (ditolak `expo-doctor`, rawan crash modul native). | Mode isolated bawaan Bun 1.3. |
| 23 Okt 2026 | **TypeScript 6.0** di semua paket. | Patokan Expo SDK 58; satu versi untuk semua. | TypeScript 7 (penulisan ulang kompiler, masih baru). |
| 23 Okt 2026 | **Biome** untuk lint + format. | Satu alat, cepat. | ESLint + Prettier. |
| 23 Okt 2026 | **Tipe klien `hc` dari berkas deklarasi** (`apps/api/tipe`, `bun run tipe`). | Impor langsung dari `apps/api/src` membawa tipe Bun/`node:crypto` ke pemeriksaan tipe HP & web. | Impor langsung; klien fetch tanpa tipe. |
| 23 Okt 2026 | **Web memanggil API di `/api`** (proxy Vite saat pengembangan, Nginx di produksi). | Satu asal, tanpa CORS. | API di domain/port lain + CORS. |
| 23 Okt 2026 | **Sesi bos di `localStorage`** browser. | Bos tetap masuk sesudah browser ditutup; token akses 15 menit, token segar bisa dicabut. Risiko XSS dicatat — cookie `httpOnly` bisa ditimbang saat rilis. | `sessionStorage` (keluar tiap browser ditutup). |
| 23 Okt 2026 | **Reverse proxy produksi: Nginx** (sudah terpasang). **Terbuka:** Caddy ditimbang lagi saat rilis. | Memakai yang ada. | — |
| 23 Okt 2026 | **Commit lalu push otomatis** ke GitHub setiap langkah yang lolos typecheck, uji, dan lint. | Keputusan pemilik. | Push hanya bila diminta. |
