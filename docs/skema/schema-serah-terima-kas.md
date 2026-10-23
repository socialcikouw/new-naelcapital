# `serah_terima_kas` — uang tunai kolektor diterima kantor (baru)

**Status:** final (22 Okt 2026). Tabel baru; menggantikan kolom serah terima
di `hari_kolektor` dan tekor otomatis di `beban_kolektor`.

## Ringkasan

Satu baris = **kantor menerima uang tunai dari seorang kolektor untuk satu
hari**. Dicatat **kasir** (atau bos) sore hari sesudah kolektor membuka
laporannya; hanya **bos** yang membatalkan.

Server menghitung dan **membekukan** tunai yang seharusnya diserahkan; kasir
mengisi uang yang benar-benar diterima. Selisihnya adalah tekor (kurang) atau
lebih setor — **dihitung sistem, tidak diinput tangan**.

Contoh Andi hari ini:

| | |
|---|---|
| Tunai seharusnya (dibekukan) | 1.250.000 |
| Tunai diterima (input kasir) | 1.200.000 |
| `selisih_setor` | −50.000 → **tekor 50.000**, dipotong dari gaji Andi |

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `hari_kolektor_id` | `uuid` | — | | Hari kolektor yang kasnya diterima. Kolektor & tanggal dibaca dari sana — tidak disalin. |
| `tunai_seharusnya` | `bigint` | — | | Rumus tunai seharusnya ([schema-hari-kolektor.md](schema-hari-kolektor.md#rumus)), **dibekukan** saat diterima — tak bergeser oleh perubahan rumus atau data sesudahnya. Boleh negatif (droping melebihi uang masuk). |
| `tunai_diterima` | `bigint` | — | | Uang fisik yang benar-benar diterima. |
| `selisih_setor` | `bigint`, **turunan** | — | | `tunai_diterima − tunai_seharusnya`. Minus = tekor; plus = lebih setor. |
| `diterima_oleh` | `uuid` | — | | Kasir atau bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | Waktu kas diterima. |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `serah_terima_kas_pkey` | PK | `(id)` |
| `serah_terima_kas_hari_fk` | FK | `(hari_kolektor_id, kantor_id)` → `hari_kolektor(id, kantor_id)` |
| `serah_terima_kas_diterima_oleh_fk` | FK | `(diterima_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `serah_terima_kas_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_serah_terima_kas_hari` | UNIQUE parsial | `(hari_kolektor_id) WHERE dibatalkan_at IS NULL` — satu serah terima berlaku per kolektor per hari; jalur join dari `hari_kolektor`. |
| `serah_terima_kas_nominal_check` | CHECK | `tunai_diterima >= 0` |
| `serah_terima_kas_batal_check` | CHECK | `dibatalkan_at`, `dibatalkan_oleh`, `alasan_batal` terisi bersamaan atau kosong bersamaan. |
| `serah_terima_kas_syarat` | TRIGGER (BEFORE INSERT) | Hari kolektor harus `masuk_kerja` dan `laporan_dibuka_at` terisi (`LAPORAN_BELUM_DIBUKA`). |
| `serah_terima_kas_append_only` | TRIGGER | UPDATE hanya boleh menandai batal; DELETE ditolak (fungsi `uang_hanya_batal()`). |

Pasangannya di `hari_kolektor`: trigger `hari_kolektor_terkunci` menolak
perubahan angka hari & laporan selama ada serah terima berlaku. Di
`transfer_setoran` dan `biaya_tak_terduga`: trigger `*_terkunci`.

**Kirim bersamaan** (ditambahkan saat pembangunan, 24 Okt 2026): trigger
`serah_terima_kas_syarat` mengunci baris `hari_kolektor` (`FOR UPDATE`),
trigger `*_terkunci` di transfer & biaya menguncinya bersama (`FOR SHARE`).
Serah terima dan transfer/biaya yang dikirim pada detik yang sama jadi
berurutan — yang belakangan melihat yang lebih dulu, tidak sama-sama lolos.
Service menerima kas mengunci baris yang sama **sebelum** menghitung tunai
seharusnya, supaya angka yang dibekukan memuat semua transfer & biaya.

## Keputusan & timbangan

- **Tabel sendiri, hanya bertambah** — sesuai prinsip *tabel uang
  dibatalkan*. Dulu membatalkan penerimaan menimpa kolom menjadi kosong; bukti
  hanya tersisa di `riwayat_perubahan`.
- **Tekor diturunkan dari `selisih_setor`**, bukan baris tekor otomatis di
  `beban_kolektor`. Batal serah terima = tekornya ikut hilang tanpa langkah
  tambahan; tidak ada tautan silang yang bisa tak sinkron.
- **Lebih setor dibiarkan tercatat** sebagai selisih plus (tidak menutup tekor
  hari lain otomatis); kas kantor membaca `tunai_diterima` apa adanya.
- **`tunai_seharusnya` dibekukan**: angka yang dibaca saat serah terima menjadi
  dasar tekor & gaji; tak boleh bergeser walau rumus berubah kelak.
- **Hitung buta** (tinjauan ulang 23 Okt 2026): kasir tidak melihat tunai
  seharusnya sebelum mengisi — sama dengan `pencocokan_kas`. Rincian
  seharusnya (setoran, droping, transfer, biaya) ditampilkan **sesudah**
  disimpan. Kolektor melihat uang yang dicatat diterima darinya, jadi kasir
  tak bisa diam-diam mencatat kurang lalu membebankannya ke kolektor.
- **Ramping**: kolektor & tanggal lewat join ke `hari_kolektor` (unik per
  kolektor per hari, tabel kecil).
- **Nama `serah_terima_kas`**: istilah yang sudah dipakai di kode & layar —
  kolektor menyerahkan, kantor menerima.

## Rumus turunan

```
tekor kolektor (periode)  = Σ greatest(−selisih_setor, 0)   (serah terima berlaku)
                          + Σ hari_kolektor.tekor_lama      (arsip sebelum peralihan)
lebih setor (periode)     = Σ greatest(selisih_setor, 0)
kas tunai kantor (hari)   = tunai_diterima − kas_lapangan − uang_jalan
                            (hanya hari yang punya serah terima berlaku)
```

Potongan gaji (`pembayaran_gaji.potongan_tekor`) membaca tekor dari sini
(ditambah tekor manual lama sebelum peralihan) — dirinci di audit kas/gaji.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /hari-kolektor/:kolektorId/terima-kas` | kasir, bos | `{ tunaiDiterima }` — **hitung buta**: kasir mengisi uang yang ia hitung tanpa melihat angka seharusnya; server menghitung & membekukan seharusnya, lalu baru menjawab seharusnya + selisihnya. |
| `GET /hari-kolektor?kolektorId=&tanggal=` | kolektor: miliknya; bos, kasir, pengawas | Serah terima yang berlaku beserta `tunaiDiterima` & `selisihSetor` — kolektor **langsung melihat** hasilnya di HP-nya, sehingga bisa protes saat itu juga. Tanpa `kolektorId` = semua kolektor hari itu. **Rincian tunai seharusnya** sebelum kas diterima hanya untuk **kolektor itu sendiri** (ia perlu tahu yang harus diserahkan); kasir, bos, dan pengawas melihatnya sesudah menyimpan uang yang diterima — hitung buta berlaku untuk siapa pun yang menerima. *(Diputuskan saat pembangunan, 24 Okt 2026.)* |
| `POST /serah-terima-kas/:id/batal` | bos | `{ alasan }` |

## Service / logika nantinya

1. **Menerima** (kasir/bos): hari ini (kalender kantor); hari kolektor masuk
   kerja & laporan sudah dibuka; belum ada serah terima berlaku
   (`KAS_SUDAH_DITERIMA`, dijaga juga UNIQUE parsial). Hitung tunai seharusnya
   di transaksi database yang sama, simpan bersama uang diterima.
2. **Membatalkan** (bos, hari yang sama): tandai batal dengan alasan; hari
   kolektor terbuka lagi (angka, laporan, transfer, biaya bisa dibetulkan),
   lalu kasir menerima ulang.
3. Selama serah terima berlaku: pembetulan angka hari, batal laporan, transfer
   setoran, biaya tak terduga, batal transaksi, dan batal akad kolektor itu
   hari itu ditolak (`KAS_SUDAH_DITERIMA`).
4. Penerimaan & pembatalan terlihat di layar aktivitas bos.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat tabel, constraint, dan trigger.
2. Salin baris `hari_kolektor` yang `diterima_at`-nya terisi:
   `tunai_seharusnya`, `tunai_diterima`, `diterima_oleh`, `dibuat_at =
   diterima_at`.
3. Cocokkan tekor otomatis lama (`hari_kolektor.tekor_otomatis_id`) dengan
   `−selisih_setor`; selisih dicatat untuk diperiksa sebelum baris tekor lama
   diarsipkan ([schema-biaya-tak-terduga.md](schema-biaya-tak-terduga.md#tekor-lama-sebelum-peralihan)).
4. Alihkan buku kas & gaji ke tabel ini, lalu buang kolom lama di
   `hari_kolektor`.
