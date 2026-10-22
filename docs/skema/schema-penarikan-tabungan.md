# `penarikan_tabungan` — tabungan diserahkan ke nasabah di luar pelunasan (baru)

**Status:** final (22 Okt 2026). Tabel baru.

## Ringkasan

Satu baris = **satu penyerahan uang tabungan** ke nasabah atas keputusan bos,
di luar pelunasan. Kasusnya jarang: nasabah setia minta sebagian tabungannya
saat gulung, dan bos memilih mengeluarkannya daripada nasabah melunasi lalu
meminjam dari awal.

Contoh: Lasminati — pokok 1 jt, saldo 800 rb, tabungan 600 rb. Bos
mengeluarkan 300 rb.

| | Sebelum | Sesudah |
|---|---|---|
| Saldo tabungan Lasminati | 600.000 | 300.000 |
| Kas kantor (akun tunai) | — | −300.000 |

Gulung kolektor tetap berjalan seperti biasa, tanpa kolom tambahan.

Berbeda dari [`koreksi_tabungan`](schema-koreksi-tabungan.md) (membetulkan
angka yang salah, tanpa uang): penarikan adalah **uang tunai sungguhan**,
sehingga ikut menjadi **kas keluar** di buku kas kantor.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `nasabah_id` | `uuid` | — | | Pemilik tabungan. |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor) — tanggal kas keluar. |
| `nominal` | `bigint` | — | | Uang tabungan yang diserahkan. |
| `dari_akun` | enum `akun_kas` (`tunai`, `bank`) | — | | Dari brankas atau ditransfer dari rekening kantor. |
| `saldo_sebelum` | `bigint` | — | | Saldo tabungan tepat sebelum penarikan — potret untuk riwayat, dan pembanding CHECK. |
| `alasan_penarikan` | `varchar(200)` | — | | **Wajib.** Mis. "diambil separuh saat gulung, nasabah setia". |
| `dibuat_oleh` | `uuid` | — | | Bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `penarikan_tabungan_pkey` | PK | `(id)` |
| `penarikan_tabungan_kantor_fk` | FK | `(kantor_id)` → `buku_kas(kantor_id)` — kas keluar; buku kas harus sudah dibuka (sama dengan mutasi & gaji). |
| `penarikan_tabungan_nasabah_fk` | FK | `(nasabah_id, kantor_id)` → `nasabah(id, kantor_id)` |
| `penarikan_tabungan_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `penarikan_tabungan_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_penarikan_tabungan_nasabah` | INDEX | `(nasabah_id, dibuat_at)` — riwayat satu nasabah. |
| `idx_penarikan_tabungan_kantor_tanggal` | INDEX | `(kantor_id, tanggal)` — buku kas per rentang tanggal. |
| `penarikan_tabungan_nominal_check` | CHECK | `nominal > 0 AND nominal <= saldo_sebelum` |
| `penarikan_tabungan_alasan_check` | CHECK | `length(btrim(alasan_penarikan)) > 0` |
| `penarikan_tabungan_batal_check` | CHECK | `dibatalkan_at`, `dibatalkan_oleh`, `alasan_batal` terisi bersamaan atau kosong bersamaan. |
| `penarikan_tabungan_append_only` | TRIGGER | UPDATE hanya boleh menandai batal; DELETE ditolak (fungsi `uang_hanya_batal()`, sama dengan buku kas & gaji). |

`nasabah_saldo_tabungan_check` (`saldo_tabungan >= 0`) menjadi pengaman
terakhir: penarikan yang melebihi saldo gagal di database walau service lalai.

## Keputusan & timbangan

- **Kejadian terpisah oleh bos (C1), bukan bagian akad gulung (C2).**
  - Hanya bos yang mengeluarkan tabungan — kolektor tak bisa menarik tabungan
    nasabah atas namanya sendiri.
  - Bentuk `pinjaman` dan alur gulung tidak disentuh demi kasus yang jarang.
  - Bisa terjadi kapan saja, tidak hanya saat gulung.
  - Syaratnya: uangnya diambil dari **kas kantor** (brankas atau rekening),
    bukan dari tas setoran kolektor — bos menyerahkan sendiri, atau
    menitipkannya ke kolektor sebagai uang terpisah. Kalau diambil dari
    setoran, kasir akan melihat tekor di kolektor itu.
- **Buku kas menjumlahkan langsung dari tabel ini** (`dari_akun`, `nominal`),
  sama dengan transaksi kolektor & gaji — tidak disalin ke `mutasi_kas_kantor`,
  sehingga satu rupiah tak punya dua catatan.
- **Boleh dibatalkan** (berbeda dari koreksi): membatalkan penarikan hanya
  *menambah* tabungan kembali, jadi saldo tak mungkin minus. Batal hanya di
  hari yang sama, seperti tabel uang lain.
- **Tanpa `pinjaman_id`**: tabungan milik orangnya; konteks gulung cukup di
  alasan.
- **Tanpa foto** untuk sekarang; kelak cukup satu kolom penunjuk ke `foto`.
- **Tidak dihalangi pinjaman aktif**: menarik tabungan saat masih berutang
  adalah keputusan bos; layar menampilkan neraca nasabah (tabungan − piutang)
  sebagai peringatan, bukan penolakan.
- **Nama `penarikan_tabungan`**: kata yang biasa dipakai untuk mengambil uang
  dari tabungan; berpasangan dengan `tabungan_masuk` / `tabungan_keluar`.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /nasabah/:id/penarikan-tabungan` | bos | `{ nominal, dariAkun, saldoSebelum, alasan }` |
| `GET /nasabah/:id/penarikan-tabungan` | bos, pengawas | Riwayat penarikan satu nasabah. |
| `POST /penarikan-tabungan/:id/batal` | bos | `{ alasan }` |

## Service / logika nantinya

1. Hanya bos.
2. Kunci baris nasabah (`FOR UPDATE`); `saldoSebelum` dari klien harus sama
   dengan saldo di database (`TABUNGAN_BERUBAH`); `nominal ≤ saldo`
   (`TABUNGAN_TIDAK_CUKUP`).
3. Buku kas harus sudah dibuka (`BUKU_KAS_BELUM_DIBUKA`, dijaga juga FK ke
   `buku_kas`); `tanggal` = hari ini kalender kantor.
4. Tulis baris penarikan, lalu kurangi `nasabah.saldo_tabungan` sebesar
   nominal — di transaksi database yang sama.
5. **Batal** (bos, hari yang sama): tandai batal dengan alasan, kembalikan
   `saldo_tabungan` sebesar nominal, di transaksi yang sama.
6. Ikut dihitung di: saldo akun buku kas (keluar dari `dari_akun`),
   `GET /nasabah/:id/neraca` (arus kas nasabah), posisi modal per tanggal,
   dan layar aktivitas bos.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat tabel, constraint, index, dan trigger `uang_hanya_batal()`.
2. Tambahkan tabel ini ke penjumlahan buku kas dan rumus rekonsiliasi tabungan
   (uji-alur).
3. Tidak ada data lama yang dipindah: penarikan di masa lalu (bila ada) tercatat
   sebagai koreksi dan dibiarkan begitu.
