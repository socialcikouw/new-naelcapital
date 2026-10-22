# `tautan` — penautan HP lewat QR

**Status:** final (22 Okt 2026).

## Ringkasan

Satu-satunya jalan masuk akun **kasir, pengawas, dan kolektor** (ketiganya tak
punya kata sandi). Satu baris = satu permintaan penautan dari satu HP. Umurnya
pendek: menunggu 2 menit, sesudah disetujui 10 menit, lalu dibersihkan sehari
sesudah kedaluwarsa.

Alur:

1. **HP yang belum login meminta kode** → server membuat kode (`K7QM-28XD`)
   dan **kunci klaim** rahasia; kunci dikembalikan **sekali** ke HP itu, yang
   disimpan di sini hanya hash-nya. Kunci tidak ikut ke QR.
2. **Bos — di aplikasi web — memindai QR (kamera laptop/HP) atau mengetik kode**, lalu memilih atau membuat akunnya →
   baris disetujui, waktunya diperpanjang 10 menit.
3. **HP yang sama menukar kunci klaim dengan sesi** → perangkat dibuat dan
   dicatat di baris ini, **sekali saja**; perangkat lama akun itu diputus di
   transaksi yang sama.

QR yang difoto dan dikirim ke orang lain tak berguna: tanpa kunci klaim,
sesinya tak bisa diambil.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama; dipegang HP peminta untuk menukar klaim. |
| `kode` | `varchar(8)` | — | | 8 huruf/angka tanpa yang mirip (0/O, 1/I/L); tampil "K7QM-28XD". |
| `hash_klaim` | `varchar(64)` | — | | SHA-256 hex kunci klaim milik HP peminta. |
| `nama` | `varchar(100)` | ya | | Nama HP peminta (tampilan), diteruskan ke `perangkat`. |
| `platform` | enum `platform_perangkat` | ya | | `android`, `ios`, `web` — diteruskan ke `perangkat`. |
| `kedaluwarsa_at` | `timestamptz` | — | | Batas menunggu (2 menit) atau, sesudah disetujui, batas klaim (10 menit). |
| `kantor_id` | `uuid` | ya | | Kantor bos yang menyetujui. Kosong selama menunggu — HP belum tahu kantornya. |
| `pengguna_id` | `uuid` | ya | | Akun yang disetujui (kasir, pengawas, atau kolektor). |
| `disetujui_at` | `timestamptz` | ya | | Terisi = disetujui. |
| `disetujui_oleh` | `uuid` | ya | | Bos yang menyetujui. |
| `perangkat_id` | `uuid` | ya | | Perangkat hasil penautan. Terisi = sudah dipakai. |
| `dibuat_at` | `timestamptz` | — | `now()` | |

### Status — diturunkan, tidak disimpan

| Status | Syarat |
|---|---|
| menunggu | `disetujui_at IS NULL` |
| disetujui | `disetujui_at IS NOT NULL AND perangkat_id IS NULL` |
| terpakai | `perangkat_id IS NOT NULL` |
| kedaluwarsa | bukan terpakai, dan `kedaluwarsa_at <= now()` |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `tautan_pkey` | PK | `(id)` |
| `uniq_tautan_kode` | UNIQUE | `(kode)` — penuh, bukan parsial: baris lama dibersihkan, ruang kode tak habis. |
| `tautan_kantor_fk` | FK | `kantor_id` → `kantor(id)` |
| `tautan_pengguna_fk` | FK | `(pengguna_id, kantor_id)` → `pengguna(id, kantor_id)` — akun milik kantor yang menyetujui. |
| `tautan_disetujui_oleh_fk` | FK | `(disetujui_oleh, kantor_id)` → `pengguna(id, kantor_id)` — penyetuju orang kantor itu juga. |
| `tautan_perangkat_fk` | FK | `perangkat_id` → `perangkat(id)` |
| `tautan_setuju_check` | CHECK | `kantor_id`, `pengguna_id`, `disetujui_at`, `disetujui_oleh` terisi bersamaan atau kosong bersamaan. |
| `tautan_pakai_check` | CHECK | `perangkat_id IS NULL OR disetujui_at IS NOT NULL` — tak bisa dipakai sebelum disetujui. |
| `idx_tautan_kedaluwarsa` | INDEX | `(kedaluwarsa_at)` — pembersihan baris lama. |

Bahwa akun yang ditautkan **bukan bos** dijaga service — FK tak bisa memeriksa
peran.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `status` enum `status_tautan` (`menunggu`/`disetujui`/`terpakai`) | **dibuang**; diturunkan dari `disetujui_at` & `perangkat_id` | Salinan keadaan yang sudah tercatat di kolom lain; status kedaluwarsa pun sudah diturunkan dengan cara sama. |
| — | `disetujui_oleh` | Konvensi #5; jejak siapa menyetujui. |
| `klaim_hash` | `hash_klaim` | Seragam dengan `pengguna.hash_sandi`. |
| `platform` `varchar(10)` + CHECK | enum `platform_perangkat` | Sama dengan `perangkat`. |
| `boss_id`, `user_id` | `kantor_id`, `pengguna_id` | Konvensi #2; tabel `pengguna`. |
| FK `(user_id, boss_id)` → `users(id, boss_id)` | `(pengguna_id, kantor_id)` → `pengguna(id, kantor_id)` | Sasaran baru (semua peran ber-`kantor_id`). |
| — | `tautan_setuju_check`, `tautan_pakai_check` | Menggantikan penjagaan yang dulu bertumpu pada `status`. |
| `created_at` | `dibuat_at` | Konvensi #5. |

## Keputusan & timbangan

- **Status diturunkan**, bukan disimpan: satu sumber kebenaran, satu kolom dan
  satu enum hilang, dan status tak mungkin berbeda dari kenyataan. Kueri yang
  butuh status memakai `CASE` di atas.
- **Jejak persetujuan permanen di `riwayat_perubahan`.** Baris tautan dihapus
  sehari sesudah kedaluwarsa; tanpa catatan riwayat, pertanyaan "siapa
  menautkan HP ini" hilang bersamanya. `disetujui_oleh` di sini melayani umur
  pendek baris itu.
- **Pembersihan tanpa penjadwal** dipertahankan: baris kedaluwarsa > 1 hari
  dihapus setiap ada permintaan kode baru; tabel hampir selalu kosong.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /auth/tautan` | — (HP belum login) | `{ perangkat? }` → `{ id, kode, klaim, kedaluwarsaAt }`. `klaim` hanya dikirim sekali. |
| `POST /auth/tautan/setujui` | bos | `{ kode, akun }` — `akun` salah satu: akun yang ada (`penggunaId`) atau akun baru (`peran`: `kasir` / `pengawas` / `kolektor`, `nama`, `nomorHp?`, `resort?` untuk kolektor). |
| `POST /auth/tautan/:id/klaim` | — (HP peminta) | `{ klaim }` → `menunggu` / `kedaluwarsa` / sesi baru (sekali). |

Body lama (`collectorId`, `kolektorBaru`, `pengawasId`, `adminId`, …)
dipertahankan sampai aplikasi beralih.

## Service / logika nantinya

- **Minta kode**: buat kode unik + kunci klaim; simpan hash-nya; sekaligus
  hapus baris yang kedaluwarsa > 1 hari.
- **Setujui** (bos saja): cari baris menunggu & belum kedaluwarsa lewat kode;
  akun harus milik kantor bos dan bukan bos; isi keempat kolom persetujuan,
  perpanjang `kedaluwarsa_at` 10 menit; catat di `riwayat_perubahan`
  (tabel `pengguna`, `baris_id` = akun yang ditautkan, aksi `setujui_tautan`:
  peran, nama HP, kode) — saat disetujui perangkatnya belum ada.
- **Klaim** — satu transaksi:
  1. kunci baris (`FOR UPDATE`), cocokkan hash klaim (perbandingan waktu-tetap);
  2. belum disetujui → `menunggu`; lewat batas → `kedaluwarsa`;
  3. putus semua perangkat akun itu (`tautan_baru`), buat perangkat baru;
  4. `UPDATE tautan SET perangkat_id = $baru WHERE id = $id AND perangkat_id IS NULL`
     — nol baris = sudah dipakai → seluruh transaksi batal;
  5. kembalikan sesi.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Tabel ini aman dikosongkan saat migrasi (isinya hanya permintaan yang sedang
   berjalan beberapa menit).
2. Ganti nama `klaim_hash` → `hash_klaim`, `boss_id` → `kantor_id`,
   `user_id` → `pengguna_id`, `created_at` → `dibuat_at`.
3. `platform` ke enum `platform_perangkat`.
4. Tambah `disetujui_oleh`; buang `status` & enum `status_tautan`.
5. Pasang FK & CHECK baru sesudah [schema-pengguna.md](schema-pengguna.md)
   diterapkan.
