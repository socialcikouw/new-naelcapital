# `pencocokan_kas` — uang nyata dicocokkan dengan buku kas (baru)

**Status:** final (23 Okt 2026). Tabel baru — usulan antikecurangan
"hitung brankas" (`hitung_kas`) dari audit pengguna.

## Ringkasan

Satu baris = **bos atau pengawas menghitung uang nyata di satu akun kas** —
isi brankas (tunai) atau saldo rekening (bank) — lalu sistem membandingkannya
dengan saldo **buku kas** saat itu.

Ini menangkap **kebocoran di antara buku dan brankas**: uang yang hilang
sesudah diterima kantor, salah catat mutasi, atau pengeluaran yang tak
dicatat — hal yang tidak tertangkap tekor kolektor (tekor hanya mengukur
setoran sore).

Contoh:

| | |
|---|---|
| Akun | tunai (brankas) |
| `saldo_buku` (dibekukan) | 8.450.000 |
| `saldo_nyata` (dihitung pengawas) | 8.400.000 |
| `selisih` | −50.000 → kurang 50 ribu |

Tidak wajib setiap hari; boleh lebih dari sekali sehari. Pengawas bisa
menjadi **saksi independen** di luar bos dan kasir.

Nama `pencocokan_kas` (bukan `hitung_kas`): yang dikerjakan adalah mencocokkan
buku dengan kenyataan, dan berlaku juga untuk rekening bank (dicocokkan dengan
saldo di aplikasi bank), bukan hanya menghitung uang fisik.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor). |
| `akun` | enum `akun_kas` (`tunai`, `bank`) | — | | |
| `saldo_buku` | `bigint` | — | | Yang **seharusnya** ada saat dicocokkan, **dibekukan** server ([rumus](schema-buku-kas.md#rumus-saldo-akun)): tunai = `brankas seharusnya` (saldo tunai − kas di lapangan); bank = saldo bank. |
| `saldo_nyata` | `bigint` | — | | Uang yang benar-benar ada (dihitung / dibaca dari aplikasi bank). |
| `selisih` | `bigint`, **turunan** | — | | `saldo_nyata − saldo_buku`. Minus = kurang; plus = lebih. |
| `keterangan` | `varchar(200)` | ya | | Isi bebas — wajib bila selisih ≠ 0 (dugaan sebab). |
| `dicocokkan_oleh` | `uuid` | — | | Bos atau pengawas. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan (salah hitung). |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `pencocokan_kas_pkey` | PK | `(id)` |
| `pencocokan_kas_kantor_fk` | FK | `(kantor_id)` → `buku_kas(kantor_id)` — buku kas harus sudah dibuka. |
| `pencocokan_kas_dicocokkan_oleh_fk` | FK | `(dicocokkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `pencocokan_kas_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_pencocokan_kas_kantor_tanggal` | INDEX | `(kantor_id, tanggal)` — riwayat pencocokan & layar aktivitas. |
| `pencocokan_kas_nominal_check` | CHECK | `saldo_nyata >= 0` |
| `pencocokan_kas_keterangan_check` | CHECK | `saldo_nyata = saldo_buku OR length(btrim(keterangan)) > 0` |
| `pencocokan_kas_batal_check` | CHECK | Kolom batal terisi bersamaan atau kosong bersamaan. |
| `pencocokan_kas_append_only` | TRIGGER | UPDATE hanya boleh menandai batal; DELETE ditolak (`uang_hanya_batal()`). |

## Keputusan & timbangan

- **Hanya mencatat, tidak membetulkan buku.** Selisih adalah pengamatan; bila
  bos memutuskan buku harus disesuaikan, ia mencatat mutasi `lain_masuk` /
  `lain_keluar` berketerangan. Penyesuaian otomatis akan menyembunyikan
  kebocoran di balik angka yang selalu cocok.
- **`saldo_buku` dibekukan**: angka yang dibaca saat menghitung adalah dasar
  selisih; buku yang berubah sesudahnya tak menggeser hasil pencocokan.
- **Bos & pengawas** yang mencocokkan; **kasir tidak** — orang yang memegang
  uang tidak memeriksa dirinya sendiri. Kolektor tidak.
- **Tunai & bank**, satu baris per akun per pencocokan.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /kas/pencocokan` | bos, pengawas | `{ akun, saldoNyata, keterangan? }` — **hitung buta**: tak ada endpoint yang menampilkan saldo buku sebelumnya; server membekukan saldo buku dan baru menjawab saldo buku + selisihnya sesudah angka nyata tersimpan. Selisih ≠ 0 tanpa keterangan → ditolak, penghitung mengirim ulang dengan keterangan (angka nyata tetap). |
| `POST /kas/pencocokan/:id/batal` | bos | `{ alasan }` — hari yang sama. |
| `GET /kas/pencocokan?mulai=&selesai=` | bos: semua; pengawas: **pencocokannya sendiri** | Riwayat + selisih. Pengawas tidak membaca pencocokan orang lain atau laporan kas — saldo buku yang ia lihat hanya hasil hitungannya sendiri, sesudah disimpan (keputusan pemilik, 24 Okt 2026). |

## Service / logika nantinya

1. **Mencocokkan** (bos/pengawas): buku kas sudah dibuka; hitung saldo buku
   akun itu (tunai: brankas seharusnya; bank: saldo bank) di transaksi yang
   sama dengan penyisipan; selisih ≠ 0 tanpa keterangan → ditolak
   (`KETERANGAN_SELISIH_WAJIB`).
2. **Membatalkan** (bos, hari yang sama): salah hitung; lalu cocokkan ulang.
3. Pencocokan bertanda selisih tampil di layar aktivitas bos dan laporan kas.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat tabel, constraint, dan trigger. Tidak ada data lama.
