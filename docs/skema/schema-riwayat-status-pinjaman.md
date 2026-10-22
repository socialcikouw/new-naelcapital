# `riwayat_status_pinjaman` — perjalanan status setiap pinjaman

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu perpindahan `pinjaman.status`**, termasuk kelahirannya.
`pinjaman.status` hanya menyimpan keadaan sekarang; tabel inilah yang
menjawab: berapa lama sebuah pinjaman pernah macet, berapa kali ia pulih,
berapa persen yang macet akhirnya lunas, atau status pinjaman X pada tanggal
lampau.

Contoh perjalanan satu pinjaman:

| `status_sebelum` | `status_sesudah` | `tanggal` |
|---|---|---|
| — | `berjalan` | 1 Okt (akad) |
| `berjalan` | `macet` | 12 Okt |
| `macet` | `berjalan` | 15 Okt (pulih) |
| `berjalan` | `lunas` | 30 Okt |

**Diisi trigger database, bukan kode aplikasi.** Enam jalur mengubah status
(sapuan malam macet/pulih, pelunasan, gulung, batal akad, batal transaksi,
pemutihan & batalnya) — tak satu pun bisa lupa mencatat. Aplikasi hanya
membaca.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `pinjaman_id` | `uuid` | — | | |
| `status_sebelum` | enum `status_pinjaman` | ya | | Kosong = baris kelahiran pinjaman. |
| `status_sesudah` | enum `status_pinjaman` | — | | |
| `tanggal` | `date` | — | | Hari pembukuan perpindahan (kalender kantor) — lihat tabel asal tanggal. |
| `dibuat_at` | `timestamptz` | — | `clock_timestamp()` | Urutan pasti: kelahiran dan perpindahan dalam satu transaksi database tetap berurutan (`now()` akan sama). |

Tanpa kolom pelaku atau penyebab, sengaja: trigger tak bisa tahu pelakunya
dengan pasti, dan keduanya sudah tercatat di tabel asal — `transaksi`
(pencatat, batal), kolom batal & pemutihan di `pinjaman`; sapuan malam adalah
sistem. Penyebab ditemukan lewat join `(pinjaman_id, tanggal)` ke `transaksi`.

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `riwayat_status_pinjaman_pkey` | PK | `(id)` |
| `riwayat_status_pinjaman_pinjaman_fk` | FK | `(pinjaman_id, kantor_id)` → `pinjaman(id, kantor_id)` |
| `uniq_riwayat_status_pinjaman_lahir` | UNIQUE parsial | `(pinjaman_id) WHERE status_sebelum IS NULL` — satu pinjaman lahir sekali. |
| `idx_riwayat_status_pinjaman_pinjaman` | INDEX | `(pinjaman_id, dibuat_at)` — perjalanan satu pinjaman; status pada tanggal lampau (baris terakhir dengan `tanggal ≤ X`; per pinjaman hanya beberapa baris). |
| `idx_riwayat_status_pinjaman_kantor_tanggal` | INDEX | `(kantor_id, tanggal) INCLUDE (pinjaman_id, status_sebelum, status_sesudah)` — "berapa yang jatuh macet / pulih bulan ini" dijawab langsung dari index. |
| `riwayat_status_pinjaman_urutan_check` | CHECK | `(status_sebelum IS NULL AND status_sesudah = 'berjalan') OR (status_sebelum IS NOT NULL AND status_sebelum <> status_sesudah)` |
| `riwayat_status_pinjaman_append_only` | TRIGGER | UPDATE dan DELETE **selalu ditolak** (fungsi umum `hanya_bertambah()`, sama dengan `koreksi_tabungan`), kecuali DELETE oleh skrip data uji yang membuka `nael.hapus_data_uji`. |

### Trigger pengisi: `pinjaman_riwayat_status`

Di `pinjaman`: `AFTER INSERT OR UPDATE OF status`.

- **INSERT**: satu baris kelahiran (`— → berjalan`, tanggal `tanggal_akad`).
  Pinjaman yang lahir sudah selesai/macet (salinan migrasi, data uji): baris
  kelahiran tetap `berjalan`, lalu satu perpindahan ke status itu.
- **UPDATE yang mengubah status**: satu baris, tanggalnya:

| Perpindahan | `tanggal` |
|---|---|
| `lunas`/`digulung` → dibuka lagi (batal pelunasan/gulung) | `tanggal_selesai` **lama** — pembatalan hanya boleh di hari penutupan |
| → `diputihkan` | `tanggal_selesai` (hari pemutihan) |
| `diputihkan` → (batal pemutihan) | `nael.tanggal_pembukuan` dari service; **cadangan: hari ini menurut `kantor.zona_waktu`** |
| → `macet` | `tanggal_macet` |
| → `lunas` / `digulung` / `batal` | `tanggal_selesai` |
| `macet` → `berjalan` (pulih) | `nael.tanggal_pembukuan` dari sapuan malam; **kosong → error** |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` | `kantor_id` | Konvensi #2. |
| `dari` / `ke` | `status_sebelum` / `status_sesudah` | "Dari apa, ke apa?" — sejajar dengan `saldo_sebelum` / `saldo_sesudah` di `transaksi` & `koreksi_tabungan`. |
| `created_at` | `dibuat_at` | Konvensi #5. |
| FK `riwayat_status_pinjaman_tenant_fk` | `riwayat_status_pinjaman_pinjaman_fk` | Konvensi #8. |
| Index `(pinjaman_id, created_at)`, `(boss_id, tanggal)` | lihat di atas (+ `INCLUDE`) | Nama konvensi #8; hitungan dari index. |
| Tanpa CHECK & UNIQUE kelahiran | `urutan_check`, `uniq_…_lahir` | Baris mustahil ditolak database. |
| Tanpa penjaga hanya-bertambah | trigger `append_only` | Jejak yang bisa disunting bukan jejak. |
| Trigger membaca `macet_sejak` | `tanggal_macet` | Nama baru di `pinjaman`. |
| Cadangan tanggal: hari ini `Asia/Jakarta` di dua jalur | pulih: **error**; batal pemutihan: hari ini zona kantor | Lihat timbangan. |

## Keputusan & timbangan

- **Pulih tanpa tanggal pembukuan = error, bukan tebakan.** Sapuan malam
  berjalan sesudah tengah malam untuk menutup hari **kemarin**; cadangan
  "hari ini" pasti meleset satu hari, dan kesalahan itu diam-diam merusak
  analisis lama macet. Lebih baik jalur yang lupa memasang tanggal gagal di uji
  daripada menulis tanggal salah. Risikonya kecil: hanya sapuan yang memulihkan
  pinjaman.
- **Batal pemutihan tetap bercadangan**, karena memang terjadi "hari ini" —
  cukup dibaca menurut zona kantor (WIB/WITA/WIT), bukan Jakarta tetap.
- **Diisi trigger** (dipertahankan): lebih andal daripada mengandalkan enam
  jalur aplikasi.
- **Nama tabel tetap** `riwayat_status_pinjaman`.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /pinjaman/:id/riwayat-status` | bos, pengawas | Garis waktu status satu pinjaman (opsional; data tetap tercatat walau layarnya belum dibuat). |

Analisis tingkat kantor (jatuh macet / pulih per bulan, lama macet rata-rata)
kelak dibaca dari index `(kantor_id, tanggal)`.

## Service / logika nantinya

- Aplikasi **tidak pernah menulis** ke tabel ini.
- Sapuan malam memasang `nael.tanggal_pembukuan` = hari yang ditutupnya, di
  transaksi database yang sama dengan perubahan status (sudah begitu
  sekarang).
- Batal pemutihan memasang `nael.tanggal_pembukuan` = hari ini kalender kantor.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama kolom, constraint, dan index; buat index baru dengan `INCLUDE`
   (`CONCURRENTLY` di produksi).
2. Periksa data lama melanggar CHECK/UNIQUE baru (seharusnya tidak ada —
   semua baris dari trigger), lalu pasang.
3. Ganti fungsi `pinjaman_riwayat_status()`: nama kolom baru, `tanggal_macet`,
   cadangan zona kantor, error untuk pulih tanpa tanggal.
4. Pasang trigger hanya-bertambah (`hanya_bertambah()`).
5. Skrip demo yang menghapus riwayat harus membuka `nael.hapus_data_uji`.
