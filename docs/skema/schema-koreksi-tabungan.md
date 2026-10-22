# `koreksi_tabungan` — bos membetulkan angka tabungan yang salah

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu pembetulan data** saldo tabungan seorang nasabah oleh bos:
salah ketik, salah salin dari buku lama, dan sejenisnya. **Tidak ada uang yang
berpindah tangan** — koreksi tidak menyentuh buku kas.

Uang tabungan yang benar-benar diserahkan ke nasabah di luar pelunasan
(mis. separuh tabungan diambil saat gulung) **bukan koreksi**: ia dicatat di
[`penarikan_tabungan`](schema-penarikan-tabungan.md) yang ikut menggerakkan kas.
Kalau dicatat sebagai koreksi, saldo tabungannya benar tetapi uang yang keluar
hilang dari buku kas — brankas tampak kurang, atau kolektor tampak tekor.

Koreksi menyimpan **selisih**, bukan nilai baru, sehingga saldo tabungan selalu
bisa dicocokkan dari baris data (lihat
[schema-nasabah.md](schema-nasabah.md#saldo_tabungan--cache-yang-disengaja)):

```
saldo_tabungan = Σ pinjaman.tabungan_masuk
               − Σ transaksi.tabungan_keluar
               − Σ penarikan_tabungan.nominal
               + Σ koreksi_tabungan.selisih
```

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `nasabah_id` | `uuid` | — | | Nasabah yang tabungannya dibetulkan. |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor) — untuk laporan harian & posisi modal per tanggal. |
| `saldo_sebelum` | `bigint` | — | | Saldo tabungan tepat sebelum koreksi — potret untuk layar riwayat ("600.000 → 550.000"). Kebenaran tetap dari penjumlahan, bukan kolom ini. |
| `selisih` | `bigint` | — | | Pergeseran saldo; positif menambah, negatif mengurangi. |
| `alasan_koreksi` | `varchar(200)` | — | | **Wajib.** Kenapa angkanya salah. |
| `dibuat_oleh` | `uuid` | — | | Bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | Tidak ada `diubah_at` — tabel hanya bertambah. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `koreksi_tabungan_pkey` | PK | `(id)` |
| `koreksi_tabungan_nasabah_fk` | FK | `(nasabah_id, kantor_id)` → `nasabah(id, kantor_id)` |
| `koreksi_tabungan_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_koreksi_tabungan_nasabah` | INDEX | `(nasabah_id, dibuat_at)` — riwayat koreksi satu nasabah, berurutan walau beberapa koreksi di hari yang sama; juga penjumlahan rekonsiliasi. |
| `koreksi_tabungan_nominal_check` | CHECK | `selisih <> 0 AND saldo_sebelum >= 0 AND saldo_sebelum + selisih >= 0` |
| `koreksi_tabungan_alasan_check` | CHECK | `length(btrim(alasan_koreksi)) > 0` |
| `koreksi_tabungan_append_only` | TRIGGER | UPDATE dan DELETE **selalu ditolak** (fungsi umum `hanya_bertambah()`), kecuali DELETE oleh skrip data uji yang membuka `nael.hapus_data_uji`. |

Tidak ada index per kantor: koreksi jarang (puluhan baris setahun), pindaian
tabel kecil sudah cukup.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` (FK ke `kantor`) | `kantor_id` | Konvensi #2. |
| `sebelum` | `saldo_sebelum` | "Sebelum" saja tak menjelaskan sebelum apa. |
| `alasan` boleh kosong | `alasan_koreksi`, wajib | Bos mengubah angka yang kelak menjadi uang tunai; tanpa alasan tak boleh. Konvensi #6. |
| `oleh` (FK tunggal ke `users`) | `dibuat_oleh`, FK gabungan ke `pengguna` | Konvensi #5; pelaku pasti orang kantor itu. |
| `created_at` | `dibuat_at` | Konvensi #5. |
| FK `koreksi_tabungan_nasabah_tenant_fk` | `koreksi_tabungan_nasabah_fk` | Konvensi #8. |
| Index `(nasabah_id, tanggal)` | `(nasabah_id, dibuat_at)` | Urutan tepat di dalam satu hari. |
| Komentar "hanya bertambah" tanpa trigger | trigger `koreksi_tabungan_append_only` | Sekarang baris koreksi masih bisa diubah/dihapus diam-diam — jejak yang bisa disunting bukan jejak. |

## Keputusan & timbangan

- **Koreksi data saja, tanpa uang.** Kasus nasabah mengambil sebagian tabungan
  (jarang, atas keputusan bos) dipisah ke `penarikan_tabungan` (pilihan C1) —
  bukan kolom tambahan di akad gulung (C2), karena C1 tak menyentuh bentuk
  gulung, kendalinya tetap di tangan bos, dan bisa terjadi kapan saja.
- **Salah koreksi dibetulkan dengan koreksi tandingan, bukan dibatalkan.**
  Contoh: koreksi +100.000 → nasabah melunasi (tabungan keluar tunai) → kalau
  koreksi tadi dibatalkan, saldo menjadi **minus**. Koreksi tandingan selalu
  diperiksa terhadap saldo saat itu (`saldo_sebelum + selisih >= 0`). Karena
  itu tabel ini **tidak punya kolom batal**, berbeda dari tabel uang lain.
- **`saldo_sebelum` dipertahankan** walau bisa dihitung: layar riwayat cukup
  membaca satu baris, dan CHECK di atas butuh pembandingnya.
- **Tanpa `pinjaman_id`**: tabungan milik orangnya, bukan pinjaman tertentu.
- **Tidak ditulis lagi ke `riwayat_perubahan`** (dulu ganda sebagai jsonb):
  baris koreksi sudah menyimpan siapa, kapan, saldo sebelum, selisih, dan
  alasannya — prinsip [schema-riwayat-perubahan.md](schema-riwayat-perubahan.md#prinsip-kapan-menulis-ke-riwayat).

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /nasabah/:id/koreksi-tabungan` | bos | `{ saldoBaru, saldoSebelum, alasan }` — `saldoSebelum` = angka yang dilihat bos di layar. |
| `GET /nasabah/:id/koreksi-tabungan` | bos, pengawas | Riwayat koreksi satu nasabah, terbaru dulu, dengan nama pembuat. |

Field `tabungan` di `PATCH /pinjaman/:id` (perbaiki) **dibuang** setelah
aplikasi beralih — identitas pindah ke `PATCH /nasabah/:id`, tabungan ke
endpoint di atas.

## Service / logika nantinya

1. Hanya bos (kasir, pengawas, kolektor ditolak).
2. Kunci baris nasabah (`FOR UPDATE`) supaya tak berbalapan dengan pelunasan
   atau akad yang sedang dicatat.
3. `saldoSebelum` dari klien harus sama dengan `saldo_tabungan` di database;
   berbeda → `TABUNGAN_BERUBAH` (ada gerakan tabungan di sela bos membaca dan
   menyimpan).
4. `saldoBaru` = `saldoSebelum` → tak ada yang dicatat. `saldoBaru` wajar:
   ≤ batas kali pokok pinjaman terakhir nasabah (`TABUNGAN_TIDAK_WAJAR`, aturan
   yang sama dengan sekarang).
5. Tulis baris koreksi (`selisih = saldoBaru − saldoSebelum`, `tanggal` = hari
   ini kalender kantor), lalu geser `nasabah.saldo_tabungan` sebesar selisih —
   di transaksi database yang sama.
6. Koreksi terlihat di layar aktivitas bos.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama kolom (`boss_id` → `kantor_id`, `sebelum` → `saldo_sebelum`,
   `alasan` → `alasan_koreksi`, `oleh` → `dibuat_oleh`,
   `created_at` → `dibuat_at`), constraint, dan index.
2. Isi `alasan_koreksi` yang kosong dengan "(data lama tanpa alasan)", lalu
   pasang NOT NULL & CHECK.
3. Ganti FK `dibuat_oleh` menjadi gabungan.
4. Buat fungsi `hanya_bertambah()` dan pasang trigger.
5. Koreksi negatif lama bisa jadi sebenarnya penarikan tunai; tak bisa
   dibedakan otomatis — dibiarkan sebagai koreksi.
