# `biaya_tak_terduga` — biaya lapangan yang ditanggung kantor

**Status:** final (22 Okt 2026). Menggantikan `beban_kolektor`.

## Ringkasan

Satu baris = **satu biaya tak terduga yang dikeluarkan seorang kolektor di
lapangan** (service motor, ban bocor, dan sejenisnya) — tanggungan **kantor**,
bukan kolektor. Dicatat **kasir** (atau bos) saat kolektor menyetor sore hari,
keterangan wajib; hanya **bos** yang membatalkan.

Biaya mengurangi tunai yang seharusnya diserahkan kolektor hari itu, dan
menjadi kas keluar kantor (lewat serah terima: kas yang diterima sudah
berkurang sebesar biaya).

Dulu tabel ini (`beban_kolektor`) juga menampung **tekor**. Kini tekor
**diturunkan** dari [`serah_terima_kas.selisih_setor`](schema-serah-terima-kas.md)
— kasir mengisi uang yang diterima, sistem menghitung kekurangannya. Tekor
manual tidak lagi diinput.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `kolektor_id` | `uuid` | — | | Kolektor yang mengeluarkan uangnya. |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor) — hari kas itu diserahkan. |
| `nominal` | `bigint` | — | | |
| `keterangan` | `varchar(100)` | — | | **Wajib.** Biaya apa ("ganti ban dalam", "service rem"). |
| `dibuat_oleh` | `uuid` | — | | Kasir atau bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | Tidak ada `diubah_at` — tidak disunting. |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `biaya_tak_terduga_pkey` | PK | `(id)` |
| `biaya_tak_terduga_kolektor_fk` | FK | `(kolektor_id, kantor_id)` → `pengguna(id, kolektor_kantor_id)` — pasti kolektor kantor itu. |
| `biaya_tak_terduga_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `biaya_tak_terduga_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_biaya_tak_terduga_kolektor_tanggal` | INDEX | `(kolektor_id, tanggal)` — biaya hari ini seorang kolektor (rumus tunai seharusnya), rekap per kolektor. |
| `idx_biaya_tak_terduga_kantor_tanggal` | INDEX | `(kantor_id, tanggal)` — laporan kas & daftar biaya kantor per rentang tanggal. |
| `biaya_tak_terduga_nominal_check` | CHECK | `nominal > 0` |
| `biaya_tak_terduga_keterangan_check` | CHECK | `length(btrim(keterangan)) > 0` |
| `biaya_tak_terduga_batal_check` | CHECK | `dibatalkan_at`, `dibatalkan_oleh`, `alasan_batal` terisi bersamaan atau kosong bersamaan. |
| `biaya_tak_terduga_terkunci` | TRIGGER (BEFORE INSERT OR UPDATE) | Tolak mencatat atau membatalkan bila hari kolektor itu sudah punya `serah_terima_kas` berlaku (`KAS_SUDAH_DITERIMA`). Jaring pengaman; service memeriksanya lebih dulu. |
| `biaya_tak_terduga_append_only` | TRIGGER | UPDATE hanya boleh menandai batal; DELETE ditolak (fungsi `uang_hanya_batal()`). |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| tabel `beban_kolektor` | `biaya_tak_terduga` | Isinya tinggal satu jenis; istilah pemilik usaha (dan rumus kas `biayaTakTerduga`). "Beban kolektor" menyesatkan — biaya ini tanggungan kantor. |
| `boss_id` | `kantor_id` | Konvensi #2. |
| `collector_id` | `kolektor_id` | Konvensi #3. |
| `jenis` (`tekor`, `biaya`) + enum `jenis_beban` | **dibuang** | Tekor diturunkan dari serah terima. |
| dicatat boss/admin | kasir atau bos | Keputusan peran: kasir hanya membuat. |
| bisa disunting (`updated_at`) | **tidak disunting**; `updated_at` dibuang | Tabel uang: salah nominal = batal lalu catat ulang. |
| `dihapus_at` / `dihapus_oleh` | `dibatalkan_at` / `dibatalkan_oleh` / `alasan_batal` (wajib) | Prinsip *tabel uang dibatalkan*; sama dengan tabel uang lain. |
| `created_at` | `dibuat_at` | Konvensi #5. |
| FK tunggal `dibuat_oleh`, `dihapus_oleh` → `users` | FK gabungan ke `pengguna` | Pelaku pasti orang kantor itu. |
| — | trigger terkunci & hanya-bertambah | Dijaga database, bukan hanya service. |

## Keputusan & timbangan

- **Tanpa foto nota** (keputusan pemilik usaha). Pengawasan lewat rekap biaya
  per kolektor di layar bos.
- **Tetap per kolektor**: biaya terjadi di tangan kolektor dan mengurangi uang
  yang ia serahkan hari itu.
- **Tidak disunting**: mengubah nominal biaya menggeser tunai seharusnya;
  jejak batal + catat ulang lebih jujur daripada nilai yang ditimpa.
- **Tanpa batas nominal di database**: wajar-tidaknya biaya adalah penilaian
  bos.

## Tekor lama (sebelum peralihan)

| Baris lama | Nasib |
|---|---|
| `jenis = tekor` yang ditunjuk `hari_kolektor.tekor_otomatis_id` | Sudah tercakup `serah_terima_kas.selisih_setor` → dicocokkan, lalu **dibuang** supaya tak terhitung dua kali. |
| `jenis = tekor` manual (tidak dihapus) | Dijumlahkan per kolektor per hari ke kolom arsip **`hari_kolektor.tekor_lama`** (pola sama dengan `transfer_lama`), lalu dibuang dari tabel ini. |
| `jenis = biaya` | Pindah apa adanya; yang `dihapus_at`-nya terisi menjadi batal dengan alasan "(dihapus, data lama)". |

```
tekor satu hari = coalesce(hari_kolektor.tekor_lama, 0)
                + greatest(−serah_terima_kas.selisih_setor, 0)   (serah terima berlaku)
```

Slip gaji yang sudah dibayar tidak terpengaruh — angkanya dibekukan di
`pembayaran_gaji`.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /biaya-tak-terduga?kolektorId=&tanggalMulai=&tanggalSelesai=&termasukBatal=` | bos, kasir, pengawas: semua; kolektor: miliknya | Daftar + total. |
| `POST /biaya-tak-terduga` | kasir, bos | `{ kolektorId, nominal, keterangan }` — hari ini. |
| `POST /biaya-tak-terduga/:id/batal` | bos | `{ alasan }` — hari yang sama. |

Jalur lama `/beban-kolektor` (dan `PATCH` sunting) dipertahankan sampai
aplikasi beralih; jenis `tekor` ditolak.

## Service / logika nantinya

1. **Mencatat** (kasir/bos): kolektor milik kantor, hari ini (kalender kantor),
   kolektor masuk kerja hari itu, kas belum diterima (`KAS_SUDAH_DITERIMA`).
2. **Membatalkan** (bos): hari yang sama (`BATAL_HANYA_HARI_INI`), kas belum
   diterima; alasan wajib.
3. Ikut dihitung di: rumus tunai seharusnya (`hari_kolektor`), operasional
   (`uang jalan + Σ biaya`), laporan kas, dan layar aktivitas bos.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat `biaya_tak_terduga`; salin baris `jenis = biaya` (yang dihapus menjadi
   batal).
2. Tekor otomatis: cocokkan dengan `−selisih_setor` serah terima yang
   dipindahkan; selisih dicatat untuk diperiksa.
3. Tekor manual: jumlahkan ke `hari_kolektor.tekor_lama`.
4. Alihkan rumus tunai, gaji, dan laporan; buang `beban_kolektor`, enum
   `jenis_beban`, dan `hari_kolektor.tekor_otomatis_id`.
