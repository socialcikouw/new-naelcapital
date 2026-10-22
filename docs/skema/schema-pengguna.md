# `pengguna` — akun & peran

**Status:** final (21 Okt 2026). Menggantikan tabel `users`.

## Ringkasan

Satu baris = satu akun orang yang memakai aplikasi di satu kantor. **Semua
peran — termasuk bos — punya `kantor_id`**, sehingga tenant setiap orang
dibaca dengan cara yang sama.

Empat peran:

| Peran | Siapa (Nael Capital) | Aplikasi | Masuk dengan |
|---|---|---|---|
| `bos` | pemilik | **web** | nomor HP + kata sandi |
| `kasir` | menerima setoran sore | **HP** | tautan QR yang disetujui bos (dari web) |
| `pengawas` | membaca semua data | **HP** | tautan QR yang disetujui bos (dari web) |
| `kolektor` | penagih lapangan | **HP** | tautan QR yang disetujui bos (dari web) |

**Pembagian aplikasi (keputusan pemilik, 23 Okt 2026):** aplikasi web khusus
bos; aplikasi HP khusus kasir, pengawas, dan kolektor. Di aplikasi HP tidak ada
login nomor HP + kata sandi maupun registrasi.

Akun tidak pernah dihapus — data uang merujuknya. Karyawan yang keluar
**dinonaktifkan**.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor akun ini. Wajib untuk semua peran. |
| `peran` | enum `peran_pengguna` (`bos`, `kasir`, `pengawas`, `kolektor`) | — | | |
| `nama` | `varchar(50)` | — | | Nama tampil. Tidak unik, bukan untuk login. |
| `nomor_hp` | `varchar(16)` | ya | | Format E.164 (`+62…`). Bos: kredensial login (wajib). Peran lain: kontak (opsional). |
| `hash_sandi` | `varchar(255)` | ya | | Hanya bos. Peran lain masuk lewat tautan QR. |
| `resort` | `varchar(50)` | ya | | Label wilayah kerja kolektor, tampil di bawah namanya. Hanya kolektor. Bukan dasar logika — daftar kampung kolektor ada di `rute_wilayah`. |
| `kolektor_kantor_id` | `uuid`, turunan | ya | | `= kantor_id` bila peran kolektor, selain itu NULL. Sasaran FK `(kolektor_id, kantor_id)` seluruh tabel bisnis: yang tercatat sebagai kolektor pasti kolektor kantor itu. |
| `dinonaktifkan_at` | `timestamptz` | ya | | Terisi = akun nonaktif. |
| `dinonaktifkan_oleh` | `uuid` | ya | | Bos yang menonaktifkan. |
| `alasan_nonaktif` | `varchar(200)` | ya | | Mis. "Berhenti bekerja 31 Okt". |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | |

`kolektor_kantor_id` = `GENERATED ALWAYS AS (CASE WHEN peran = 'kolektor' THEN kantor_id END) STORED`.

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `pengguna_pkey` | PK | `(id)` |
| `pengguna_kantor_fk` | FK | `kantor_id` → `kantor(id)` |
| `pengguna_dinonaktifkan_oleh_fk` | FK | `(dinonaktifkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` — penonaktif orang kantor itu. |
| `uniq_pengguna_id_kantor` | UNIQUE | `(id, kantor_id)` — sasaran FK `perangkat`, `tautan`, dsb. |
| `uniq_pengguna_id_kolektor_kantor` | UNIQUE | `(id, kolektor_kantor_id)` — sasaran FK kolektor tabel bisnis. |
| `uniq_pengguna_bos_kantor` | UNIQUE parsial | `(kantor_id) WHERE peran = 'bos' AND dinonaktifkan_at IS NULL` — satu bos aktif per kantor; bos lama yang dinonaktifkan tak menghalangi bos baru. |
| `uniq_pengguna_nomor_hp_bos` | UNIQUE parsial | `(nomor_hp) WHERE peran = 'bos' AND dinonaktifkan_at IS NULL` — kredensial login unik. Nomor kontak peran lain boleh sama (mis. nomor keluarga). |
| `idx_pengguna_kantor_peran` | INDEX | `(kantor_id, peran)` — daftar kolektor / kasir / pengawas. |
| `pengguna_peran_check` | CHECK | `(peran = 'bos' AND nomor_hp IS NOT NULL AND hash_sandi IS NOT NULL) OR (peran <> 'bos' AND hash_sandi IS NULL)` |
| `pengguna_resort_check` | CHECK | `resort IS NULL OR peran = 'kolektor'` |
| `pengguna_nomor_hp_check` | CHECK | `nomor_hp IS NULL OR nomor_hp ~ '^\+[0-9]{8,15}$'` |
| `pengguna_nonaktif_check` | CHECK | ketiga penanda nonaktif terisi bersamaan atau kosong bersamaan. |

## Hak per peran (aturan service)

Aturan ini dijalankan service, bukan kolom database.

| Pekerjaan | Bos | Kasir | Pengawas | Kolektor |
|---|---|---|---|---|
| Kas lapangan & uang jalan pagi (saat absen) | lihat & koreksi | ✗ | lihat | **✓ mencatat miliknya** |
| Setoran, akad, gulung, libur nasabah di lapangan | ✗ | ✗ | ✗ | ✓ |
| Rute penagihan | ✓ | ✗ | lihat | **✓ miliknya** |
| Titik rumah nasabah | ✓ | ✗ | lihat | **✓ nasabah yang ia pegang** |
| **Uang diterima** per kolektor (tekor tunai dihitung sistem) | ✓ | **✓ membuat** | ✗ | ✗ |
| **Transfer** per kolektor, wajib dengan daftar nasabah yang membayar lewat transfer | ✓ | **✓ membuat** | ✗ | ✗ |
| **Biaya tak terduga** per kolektor, keterangan wajib | ✓ | **✓ membuat** | ✗ | ✗ |
| **Pencocokan kas** (hitung brankas / cek rekening) | ✓ | ✗ | **✓ membuat** | ✗ |
| **Mengedit, membatalkan, mengoreksi** catatan apa pun | **✓ hanya bos** | ✗ | ✗ | ✗ |
| Buku kas kantor (modal, pengeluaran, setor bank), gaji, tarif, rem, pemutihan, pengaturan kantor, NIK, tabungan, libur kantor, salin pinjaman, wilayah, tautan HP | ✓ | ✗ | ✗ | ✗ |
| Membaca | semua | **urusan kas**: daftar kolektor, hari kolektor & serah terima, setoran hari itu per kolektor (untuk memilih nasabah transfer), transfer & biaya yang ia catat, ringkasan kas per kolektor — **tanpa** buku kas kantor, gaji, foto | semua | miliknya (termasuk serah terima & tekornya) |

Catatan uang tidak pernah disunting atau dihapus, bahkan oleh bos — bos
**membatalkan** (baris tetap ada, ditandai batal beserta siapa, kapan, dan
alasannya; tidak dihitung lagi). Data bukan uang (nama, kampung, rute, saklar,
pengaturan) disunting bos — kecuali rute & titik rumah yang juga boleh
disunting kolektor pemegangnya; semuanya tercatat di `riwayat_perubahan`.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| tabel `users` | `pengguna` | Konvensi #1. |
| `boss_id` (NULL untuk bos) | `kantor_id` NOT NULL untuk semua peran | Keputusan P2 di [schema-kantor.md](schema-kantor.md). |
| `role` enum `boss`/`collector`/`pengawas`/`admin` | `peran` enum `bos`/`kolektor`/`pengawas`/`kasir` | Bahasa baku; `admin` serba-bisa diganti `kasir` dengan tugas sempit sesuai kenyataan. |
| `username` | `nama` | Isinya nama tampil, bukan nama login. |
| `phone_number` | `nomor_hp` | Sama dengan `nasabah.nomor_hp`. |
| `password_hash` | `hash_sandi` | Konvensi #1. |
| `ressort` | `resort` | Ejaan; hanya untuk kolektor (CHECK baru). |
| `kolektor_boss_id` | `kolektor_kantor_id` | Konvensi #2. |
| `token_version` | **dibuang** | Hanya melayani refresh token sebelum 16 Okt 2026 (umur 7 hari → kedaluwarsa paling lambat 23 Okt 2026). Pencabutan sesi kini per perangkat. |
| `is_active` + `deleted_at` | `dinonaktifkan_at` + `dinonaktifkan_oleh` + `alasan_nonaktif` | Dua kolom untuk satu keadaan, tak pernah ditulis kode; kini satu pasangan berjejak. |
| HP unik untuk semua akun aktif | unik hanya untuk bos aktif | Hanya bos yang login dengan nomor. |
| — | satu bos aktif per kantor (UNIQUE parsial) | Pengganti `kantor.id = id boss`. |
| `created_at`, `updated_at` | `dibuat_at`, `diubah_at` | Konvensi #5. |

## Keputusan & timbangan

- **Empat peran, `kasir` bukan `admin`.** Admin yang serba-bisa membuka celah
  izin; kasir hanya membuat catatan setoran sore. Tiga orang memegang
  aplikasi (bos, pengawas, kasir), dan pemisahan tugasnya tergambar di peran.
- **Kasir hanya membuat, tak pernah mengubah.** Orang yang memegang uang tidak
  menjadi satu-satunya saksi atas catatannya sendiri; koreksi selalu lewat
  bos. Ini juga melindungi kasir bila kelak ada selisih.
- **Tekor dihitung sistem** dari uang yang diterima (`tunai seharusnya − uang
  diterima`), bukan diketik — tak bisa diisi sembarang.
- **Konfirmasi dua arah ditolak.** Bos sendiri yang memberikan kas lapangan &
  uang jalan, lalu mencocokkan angka yang dicatat kolektor di layarnya.
- **Status nonaktif berjejak**, bukan dua flag: tahu siapa dan kenapa; pola
  sama dengan `diblokir_at`, `dibatalkan_at`.
- **`resort` dipertahankan sebagai label** — aplikasi menampilkannya di bawah
  nama kolektor; logika tidak memakainya.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /auth/login` | — | Bos: `nomorHp` + `sandi`. |
| `POST /auth/register` | — | Registrasi bos berkode: buat kantor, lalu akun bos. |
| `GET /auth/me` | semua | Profil sendiri, termasuk `peran`, `kantorId`, `resort` (kolektor). |
| `GET /pengguna?peran=…` | bos; kasir & pengawas hanya `peran=kolektor` | Daftar akun kantor, termasuk yang nonaktif bila diminta. |
| `PATCH /pengguna/:id` | bos | `nama`, `nomorHp`, `resort`. |
| `POST /pengguna/:id/nonaktifkan` | bos | `{ alasan }` — semua perangkatnya ikut diputus. |
| `POST /pengguna/:id/aktifkan` | bos | Mengembalikan akun; perangkat harus ditautkan ulang. |
| Tautan QR (`/auth/tautan/*`) | bos menyetujui | Peran yang bisa dipilih: `kasir`, `pengawas`, `kolektor`. |

Selama aplikasi lama masih dipakai, API menerjemahkan nilai peran lama:
`boss` ↔ `bos`, `collector` ↔ `kolektor`, `admin` ↔ `kasir`. Jalur lama
(`/auth/collector`, `/auth/admin`, `/auth/pengawas`) dipertahankan sampai
aplikasi beralih.

## Service / logika nantinya

- **Tenant** setiap permintaan = `kantor_id` dari token, sama untuk semua
  peran.
- **Login** hanya untuk bos aktif (nomor HP + kata sandi); peran lain hanya
  hidup di perangkat yang ditautkan (`perangkat`).
- **Akun nonaktif** tidak bisa refresh sesi; semua perangkatnya diputus di
  transaksi yang sama dengan penonaktifan.
- **Kolektor yang masih memegang nasabah aktif tidak bisa dinonaktifkan**
  (`KOLEKTOR_MASIH_MEMEGANG_NASABAH`) — nasabahnya dipindah dulu.
- **Bos tidak bisa menonaktifkan dirinya sendiri**; ganti pemilik = bos baru
  dibuat, lalu bos lama dinonaktifkan.
- Setiap perubahan akun tercatat di `riwayat_perubahan` (tabel `pengguna`).

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama tabel `users` → `pengguna` dan kolom-kolomnya (lihat tabel
   perubahan). `ALTER … RENAME` hanya mengubah metadata.
2. Enum: `ALTER TYPE … RENAME VALUE` `boss` → `bos`, `collector` →
   `kolektor`, `admin` → `kasir`; ganti nama tipe `user_role` →
   `peran_pengguna`. Sesuaikan CHECK yang membandingkan nilai lama.
3. Akun bos: `kantor_id = id` (kantor lama ber-id sama dengan id bos), lalu
   `kantor_id` NOT NULL.
4. Status: `dinonaktifkan_at = deleted_at` (atau `now()` bila
   `is_active = false`), `dinonaktifkan_oleh` = bos kantor itu,
   `alasan_nonaktif` = "dipindahkan dari status lama"; lalu buang
   `is_active`, `deleted_at`.
5. Buang `token_version` sesudah 23 Okt 2026, bersama jalur refresh JWT lama
   di kode.
6. Ganti UNIQUE nomor HP menjadi khusus bos; tambah UNIQUE bos per kantor dan
   CHECK baru.
