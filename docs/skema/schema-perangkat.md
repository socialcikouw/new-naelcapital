# `perangkat` — sesi login per HP/browser

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu perangkat (HP atau browser) yang login atas nama satu
akun**. Akun kasir, pengawas, dan kolektor hanya hidup di perangkat yang
tercatat di sini; bos bisa memutus satu perangkat tanpa mengganggu yang lain.
Satu HP yang dipakai dua akun = dua baris.

Refresh token **tidak disimpan**. Token = `pr1.<id>.<putaran>.<hmac>`; server
membuat ulang tanda tangannya dari `id` + `putaran` + rahasia server, jadi
bocornya isi tabel tidak membocorkan sesi apa pun. Setiap refresh menaikkan
`putaran` (rotasi); token putaran sebelumnya masih dijawab (sinyal jelek tak
memutus kolektor), token yang lebih tua = tanda dicuri → perangkat diputus.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama; bagian dari token. |
| `pengguna_id` | `uuid` | — | | Akun pemilik sesi. |
| `kantor_id` | `uuid` | — | | Salinan `pengguna.kantor_id` untuk daftar per kantor tanpa join; dijaga FK gabungan sehingga tak bisa melenceng. |
| `nama` | `varchar(100)` | ya | | Nama perangkat dari klien, mis. "Samsung SM-A145F". Tampilan saja. |
| `platform` | enum `platform_perangkat` (`android`, `ios`, `web`) | ya | | Tampilan saja. |
| `putaran` | `integer` | — | `1` | Nomor rotasi refresh token yang sedang berlaku. |
| `kedaluwarsa_at` | `timestamptz` | — | | Batas sesi; bergeser maju tiap refresh (umur 90 hari). Lewat = harus login/tautkan ulang. |
| `terakhir_aktif_at` | `timestamptz` | — | `now()` | Diperbarui tiap refresh (≤ sekali per umur access token). |
| `diputus_at` | `timestamptz` | ya | | Terisi = sesi berakhir. |
| `diputus_oleh` | `uuid` | ya | | Orang yang memutus; NULL bila diputus sistem. |
| `alasan_putus` | enum `alasan_putus` | ya | | Lihat tabel alasan. |
| `dibuat_at` | `timestamptz` | — | `now()` | Waktu login / tautan disetujui. |

Tidak ada `diubah_at`: satu-satunya perubahan rutin (refresh) sudah tercatat di
`terakhir_aktif_at`.

### Alasan putus

| Nilai | Kapan | `diputus_oleh` |
|---|---|---|
| `keluar` | pengguna menekan "Keluar" | pengguna itu sendiri |
| `diputus` | bos memutus perangkat itu | bos |
| `ganti_sandi` | bos mengganti kata sandinya → semua sesinya diputus | bos |
| `tautan_baru` | akun ditautkan ke perangkat baru → perangkat lama diputus | bos yang menyetujui |
| `dinonaktifkan` | akunnya dinonaktifkan | bos |
| `pakai_ulang` | token lama dipakai lagi — tanda dicuri | NULL (sistem) |
| `kedaluwarsa` | sesi lewat batas umur | NULL (sistem) |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `perangkat_pkey` | PK | `(id)` |
| `perangkat_pengguna_fk` | FK | `(pengguna_id, kantor_id)` → `pengguna(id, kantor_id)` — `kantor_id` di sini pasti kantor akunnya. |
| `perangkat_kantor_fk` | FK | `kantor_id` → `kantor(id)` |
| `perangkat_diputus_oleh_fk` | FK | `(diputus_oleh, kantor_id)` → `pengguna(id, kantor_id)` — pemutus orang kantor itu; NULL dilewati (MATCH SIMPLE). |
| `perangkat_putus_check` | CHECK | `(diputus_at IS NULL AND diputus_oleh IS NULL AND alasan_putus IS NULL) OR (diputus_at IS NOT NULL AND alasan_putus IS NOT NULL AND (alasan_putus IN ('pakai_ulang', 'kedaluwarsa')) = (diputus_oleh IS NULL))` — putus selalu beralasan; pelaku wajib ada untuk alasan yang dilakukan orang dan kosong untuk alasan sistem. |
| `idx_perangkat_pengguna_aktif` | INDEX parsial | `(pengguna_id) WHERE diputus_at IS NULL` — putus massal, daftar perangkat milik sendiri. |
| `idx_perangkat_kantor_aktif` | INDEX parsial | `(kantor_id) WHERE diputus_at IS NULL` — layar perangkat aktif bos. |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `user_id` | `pengguna_id` | Konvensi; tabel `pengguna`. |
| `boss_id`, tanpa FK gabungan | `kantor_id` + FK gabungan `(pengguna_id, kantor_id)` | Dulu mustahil (bos ber-`boss_id` NULL); dengan P2 semua akun ber-`kantor_id`, salinan ini kini dijamin benar. |
| `platform` `varchar(10)` + CHECK | enum `platform_perangkat` | Satu tipe bernama, tanpa daftar ganda di CHECK. |
| `alasan_putus` `varchar(20)` + CHECK; nilai `boss`, `password` | enum `alasan_putus`; `boss` → `diputus`, `password` → `ganti_sandi`, + `dinonaktifkan` | Nilai menyebut alasan, bukan peran pelaku; `dinonaktifkan` dari keputusan `pengguna`. |
| — | `diputus_oleh` | Konvensi #5: pasangan `diputus_at`. |
| index `(boss_id)` penuh | index `(kantor_id) WHERE diputus_at IS NULL` | Layar bos hanya membaca perangkat aktif. |
| `created_at` | `dibuat_at` | Konvensi #5. |

## Keputusan & timbangan

- **Nama tetap `perangkat`.** Secara teknis tiap baris adalah sesi
  (akun × perangkat), tetapi aplikasi dan bos mengenalnya sebagai "perangkat
  tertaut"; dokumen ini menjelaskan artinya.
- **Salinan `kantor_id` dipertahankan** demi daftar per kantor tanpa join —
  aman karena FK gabungan.
- **Tanpa pembersihan baris lama.** Belasan pengguna menghasilkan puluhan
  baris per tahun; baris yang diputus adalah jejak keamanan (siapa login
  kapan, diputus siapa).

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /auth/perangkat` | semua | Bos: perangkat aktif seluruh kantor. Peran lain: perangkat aktif miliknya. `?termasukDiputus=true` (bos): riwayat juga. Tiap baris: `{ id, pengguna: { id, nama, peran }, nama, platform, terakhirAktifAt, kedaluwarsaAt, dibuatAt, sedangDipakai, diputus: { at, oleh, alasan } \| null }`, urut terakhir aktif. |
| `DELETE /auth/perangkat/:id` | bos (perangkat mana pun di kantornya); pengguna (miliknya sendiri) | Alasan `keluar` bila milik sendiri, selain itu `diputus` (bos). Perangkat orang lain bagi selain bos → 403; sudah diputus → `PERANGKAT_SUDAH_DIPUTUS` (409). Token akses yang sudah terbit tetap berlaku sampai habis (≤ 15 menit); token segarnya langsung ditolak. |
| `POST /auth/keluar` | semua | Memutus perangkat yang sedang dipakai, alasan `keluar`. |
| `POST /auth/refresh` | — | Rotasi token perangkat. |

## Service / logika nantinya

- **Refresh** = satu baca (perangkat JOIN pengguna aktif) + satu `UPDATE`
  bersyarat `WHERE putaran = $dibaca AND diputus_at IS NULL`; dua refresh
  berbarengan → hanya satu yang menang, yang kalah dijawab token putaran baru.
- **Token putaran sebelumnya** dijawab dengan token putaran sekarang; **lebih
  tua** → putus `pakai_ulang`.
- **Sesi lewat `kedaluwarsa_at`** ditolak; bila dicoba dipakai, diputus
  `kedaluwarsa`.
- **Putus massal** (`tautan_baru`, `ganti_sandi`, `dinonaktifkan`) di
  transaksi yang sama dengan penyebabnya, lewat index parsial per pengguna.
- **Bos memutus** hanya perangkat di kantornya (`WHERE kantor_id = $kantor`).

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama `user_id` → `pengguna_id`, `boss_id` → `kantor_id`,
   `created_at` → `dibuat_at`.
2. Buat enum `platform_perangkat` & `alasan_putus`; ubah tipe kolom
   (`boss` → `diputus`, `password` → `ganti_sandi`).
3. Tambah `diputus_oleh`; isi untuk baris lama: `keluar` → `pengguna_id`;
   `diputus` / `tautan_baru` → bos kantor itu; alasan sistem → NULL.
4. Pasang FK gabungan **sesudah** akun bos ber-`kantor_id`
   ([schema-pengguna.md](schema-pengguna.md)).
5. Ganti index `(boss_id)` dengan index parsial per kantor.
