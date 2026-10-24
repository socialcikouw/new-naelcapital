# `riwayat_perubahan` — jejak data yang ditimpa atau dihapus

**Status:** final (23 Okt 2026).

## Ringkasan

Satu baris = **satu perbuatan tangan yang menimpa atau menghapus data yang
sudah tersimpan**: bos membetulkan nama nasabah, memindah pemegang, membuka
lagi laporan kolektor, menghapus libur, mengubah rem, dan sejenisnya.
`sebelum`/`sesudah` memuat **kolom yang berubah saja**, bukan seluruh baris.

Hanya bertambah — dijaga trigger, bukan hanya kesepakatan. Jejak yang bisa
disunting bukan jejak.

### Prinsip: kapan menulis ke riwayat

> **Riwayat hanya untuk data yang ditimpa atau dihapus. Tabel yang hanya
> bertambah sudah menjadi jejaknya sendiri** — barisnya menyimpan siapa,
> kapan, dan alasan batalnya.

| Ditulis ke riwayat (data ditimpa / dihapus) | **Tidak** ditulis (berjejak sendiri) |
|---|---|
| `nasabah`: identitas, pindah pemegang, titik rumah, blokir & buka blokir | `transaksi` dan batalnya |
| `pinjaman`: `pinjaman_ke`, **batal pemutihan** (kolom pemutihan ditimpa) | `transfer_setoran`, `serah_terima_kas`, `biaya_tak_terduga` |
| `kebijakan` (rem), `kantor` (pengaturan), `buku_kas` (kas awal di hari pembukaan) | `mutasi_kas_kantor`, `pembayaran_gaji` |
| `hari_kolektor`: angka lapangan dibetulkan bos, batal laporan | `penarikan_tabungan`, `koreksi_tabungan` |
| `tarif_gaji` yang ditimpa, `rute_kolektor`, `wilayah` (ganti nama, gabung, hapus) | `pinjaman` saat akad & saat diputihkan (kolom `pencair_id`, `diputihkan_oleh`/`_at`) |
| `libur_nasabah` dihapus, `libur_kantor` dibatalkan | `riwayat_status_pinjaman` (diisi trigger), `pinjaman` saat **batal akad** (kolom `dibatalkan_*`) |
| `pengguna` (sunting, nonaktif/aktif, **persetujuan tautan HP** — `baris_id` = akun yang ditautkan) | `perangkat` (jejaknya `diputus_at`/`_oleh`/`alasan_putus`), `pencocokan_kas` |
| `pekan_kerja` yang ditimpa | |

Contoh yang **berhenti** ditulis: batal transaksi dulu mencatat saldo & status
pinjaman sebelum/sesudah — keduanya sudah terbaca dari
`transaksi.saldo_sesudah` dan `riwayat_status_pinjaman`. Koreksi tabungan dan
terima kas dulu juga ditulis dua kali.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `tabel` | enum `tabel_berjejak` | — | | Tabel yang barisnya diubah — lihat daftar nilai. |
| `baris_id` | `uuid` | — | | Baris yang diubah. Sengaja **tanpa FK**: satu tabel jejak melayani semua tabel, dan jejak harus bertahan walau barisnya dihapus. |
| `aksi` | `varchar(40)` | — | | Nama perbuatan, mis. `perbaiki_nasabah`, `pindah_pemegang`, `hapus_libur`. Daftarnya dijaga konstanta di kode. |
| `sebelum` | `jsonb` | ya | | Kolom yang berubah, nilai lama. Kosong untuk pembuatan. NIK tersamar. |
| `sesudah` | `jsonb` | ya | | Kolom yang berubah, nilai baru. Kosong untuk penghapusan. NIK tersamar. |
| `alasan_perubahan` | `varchar(200)` | ya | | Wajib untuk aksi yang alasannya diminta (hapus libur, batal akad, batal laporan…). |
| `pelaku_id` | `uuid` | — | | Siapa yang melakukannya. |
| `dibuat_at` | `timestamptz` | — | `now()` | |

### Nilai `tabel_berjejak`

`kantor`, `pekan_kerja`, `buku_kas`, `kebijakan`, `pengguna`, `wilayah`,
`nasabah`, `pinjaman`, `hari_kolektor`, `libur_nasabah`, `libur_kantor`,
`tarif_gaji`, `rute_kolektor`.

Ditambah nilai **arsip** — hanya untuk jejak lama sebelum peralihan, tidak
ditulis lagi; `baris_id`-nya tetap menunjuk baris tabel lama:
`transaksi`, `biaya_tak_terduga` (dulu `beban_kolektor`), `kebijakan_kantor`,
`kebijakan_kolektor`, `perangkat`.

Tabel baru yang menimpa/menghapus data → `ALTER TYPE tabel_berjejak ADD
VALUE`. Tabel uang yang hanya bertambah **tidak** masuk daftar.

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `riwayat_perubahan_pkey` | PK | `(id)` |
| `riwayat_perubahan_kantor_fk` | FK | `(kantor_id)` → `kantor(id)` |
| `riwayat_perubahan_pelaku_fk` | FK | `(pelaku_id, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_riwayat_perubahan_baris` | INDEX | `(tabel, baris_id, dibuat_at)` — "apa saja yang pernah diubah pada baris ini". |
| `idx_riwayat_perubahan_kantor` | INDEX | `(kantor_id, dibuat_at)` — layar aktivitas kantor, terbaru dulu. |
| `idx_riwayat_perubahan_pelaku` | INDEX | `(pelaku_id, dibuat_at)` — aktivitas satu orang (mis. kasir hari ini). |
| `riwayat_perubahan_aksi_check` | CHECK | `aksi ~ '^[a-z_]+$'` |
| `riwayat_perubahan_isi_check` | CHECK | `sebelum IS NOT NULL OR sesudah IS NOT NULL` |
| `riwayat_perubahan_append_only` | TRIGGER | UPDATE & DELETE selalu ditolak — fungsi umum **`hanya_bertambah()`** (sama dengan `koreksi_tabungan`, `riwayat_status_pinjaman`), kecuali DELETE oleh skrip data uji (`nael.hapus_data_uji`). |

### Fungsi umum `hanya_bertambah()`

Satu fungsi trigger untuk tabel yang **tak pernah diubah atau dihapus**:
menolak UPDATE, menolak DELETE kecuali transaksi yang membuka
`nael.hapus_data_uji`; nama constraint di galat = `<tabel>_append_only`.
Pasangannya `uang_hanya_batal()` (sudah ada) untuk tabel uang yang boleh
**ditandai batal**.

| Fungsi | Dipakai |
|---|---|
| `hanya_bertambah()` | `riwayat_perubahan`, `riwayat_status_pinjaman`, `koreksi_tabungan` |
| `uang_hanya_batal()` | `mutasi_kas_kantor`, `pembayaran_gaji`, `transfer_setoran`, `serah_terima_kas`, `biaya_tak_terduga`, `penarikan_tabungan`, `pencocokan_kas` (`transaksi` memakai `transaksi_append_only` yang setara) |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` | `kantor_id` | Konvensi #2. |
| `tabel varchar(40)` + CHECK daftar nama | enum `tabel_berjejak` | 4 byte, index lebih kecil; tabel baru cukup `ADD VALUE`; nilainya nama tabel baru. |
| `alasan` | `alasan_perubahan` | Konvensi #6. |
| `oleh` (FK tunggal ke `users`) | `pelaku_id`, FK gabungan | Satu nama jelas untuk "siapa" di layar aktivitas (konvensi #4). |
| `created_at` | `dibuat_at` | Konvensi #5. |
| index `idx_riwayat_perubahan_boss` | `idx_riwayat_perubahan_kantor` | Ikut nama kolom. |
| — | index `(pelaku_id, dibuat_at)` | Aktivitas satu orang. |
| — | CHECK `aksi` & isi | Menutup nilai mustahil. |
| trigger `riwayat_perubahan_append_only()` sendiri | fungsi umum `hanya_bertambah()` | Satu fungsi untuk semua tabel hanya-bertambah. |
| semua suntingan **dan** kejadian uang ditulis | hanya data ditimpa/dihapus | Tanpa pencatatan ganda. |

## Layar "aktivitas hari ini" (bos)

Siapa melakukan apa hari ini, bisa disaring per orang (mis. kasir). Satu
query menggabungkan:

- `riwayat_perubahan` hari ini (index `(kantor_id, dibuat_at)`);
- tabel uang — baris yang **dibuat atau dibatalkan** hari ini: `transfer_setoran`,
  `serah_terima_kas`, `biaya_tak_terduga`, `mutasi_kas_kantor`,
  `pembayaran_gaji`, `penarikan_tabungan`, `koreksi_tabungan`,
  `pencocokan_kas`, `transaksi` (yang dibatalkan), `pinjaman` (akad,
  salinan migrasi pada hari disalin, & pemutihan hari ini).

Karena **setiap pembatalan uang hanya boleh di hari yang sama**, menyaring
"tanggal = hari ini" lewat index `(kantor_id, tanggal)` yang sudah ada di tiap
tabel menangkap pencatatan maupun pembatalannya — tanpa tabel atau index baru.

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /aktivitas?tanggal=&pelakuId=` | bos, pengawas | `[{ waktu, pelaku, peran, kejadian, ringkasan, nominal, alasan, rujukan: { tabel, id } }]`, terbaru dulu. Bawaan hari ini. Pengawas tidak melihat kas kantor (`mutasi_kas_kantor`, jejak `buku_kas`) — bacaannya milik bos. |
| `GET /riwayat?tabel=&barisId=` | bos, pengawas | Jejak satu baris (mis. riwayat suntingan seorang nasabah). |

## Service / logika nantinya

- Penulis riwayat memakai satu fungsi (`catatRiwayat`) di transaksi database
  yang sama dengan perubahannya; hanya kolom yang **benar-benar berubah**; NIK
  disamarkan.
- Jalur yang berhenti menulis riwayat: batal transaksi, batal akad, putus
  perangkat, terima & batal terima kas, catat/ubah/hapus beban (kini biaya tak terduga), koreksi tabungan,
  bayar & batal gaji, buka buku kas (barisnya sendiri di `buku_kas`; hanya
  pembetulan kas awal yang ditulis).

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat enum `tabel_berjejak`; petakan nilai lama yang hanya **berganti nama**
   (baris_id tetap sah): `users` → `pengguna`, `hari_libur_kantor` →
   `libur_kantor`, `beban_kolektor` → `biaya_tak_terduga`. `kebijakan_kantor`,
   `kebijakan_kolektor`, `transaksi`, `perangkat` tetap bernama sama sebagai
   nilai arsip (baris_id lama menunjuk tabel lama). Jejak tidak dihapus. Nilai
   lain yang tak terpetakan diperiksa tangan sebelum kolom diganti tipe.
2. Ganti nama kolom, index, constraint; ganti FK `pelaku_id` menjadi gabungan.
3. Buat fungsi `hanya_bertambah()`; ganti trigger; buang
   `riwayat_perubahan_append_only()` lama.
4. Hentikan penulisan ganda di jalur uang setelah layar aktivitas membaca
   tabel uang langsung.
