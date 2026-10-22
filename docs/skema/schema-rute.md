# `rute_kolektor` + `rute_wilayah` — urutan kampung yang didatangi kolektor

**Status:** final (23 Okt 2026).

## Ringkasan

Rute = **urutan kampung yang didatangi seorang kolektor**. Kartu nasabah di
layar Tagihan disusun mengikutinya: Rute 1 paling atas, lalu Rute 2, dan
seterusnya; kampung yang tak masuk rute menyusul, urut abjad. **Tanpa rute**
(belum pernah diatur) kartu diurutkan abjad kampung.

Dua tabel:

| Tabel | Satu baris = |
|---|---|
| `rute_kolektor` | Kepala rute satu kolektor — penjaga `versi` dan siapa yang terakhir menyimpan. |
| `rute_wilayah` | Satu kampung dalam rute itu beserta nomor urutnya. |

Diatur **dua pihak** — kolektor sendiri dan bos — karena itu ada `versi`:
penyimpan wajib menyebut versi yang terakhir ia baca, dan penyimpanan ditolak
bila sudah ada yang menyimpan sesudahnya. Tanpa ini layar kolektor yang masih
memuat urutan lama akan diam-diam menimpa urutan yang baru disusun bos.

## Kolom `rute_kolektor`

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `kolektor_id` | `uuid` | — | | **PK** — satu kolektor, satu rute. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `versi` | `integer` | — | `1` | Naik setiap penyimpanan (dan saat kampung di dalamnya digabung). Sengaja angka, bukan waktu: presisi timestamp Postgres (mikrodetik) ≠ JavaScript (milidetik). |
| `diubah_oleh` | `uuid` | ya | | Kolektor atau bos yang terakhir menyimpan. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | |

## Kolom `rute_wilayah`

| Kolom | Tipe | Kosong? | Penjelasan |
|---|---|---|---|
| `kolektor_id` | `uuid` | — | Rute milik kolektor ini. |
| `kantor_id` | `uuid` | — | |
| `wilayah_id` | `uuid` | — | Kampung. |
| `urutan` | `smallint` | — | 1 = Rute 1. |

Tanpa kolom waktu, sengaja: rute disimpan **utuh sekali jalan** (hapus lalu
tulis ulang semua baris satu rute) di bawah penjaga `versi`; waktu & pelakunya
di kepala rute, urutan lama & baru di `riwayat_perubahan`.

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `rute_kolektor_pkey` | PK | `(kolektor_id)` — juga target `ON CONFLICT` saat rute pertama dibuat. |
| `rute_kolektor_kolektor_fk` | FK | `(kolektor_id, kantor_id)` → `pengguna(id, kolektor_kantor_id)` — pasti kolektor kantor itu. |
| `rute_kolektor_diubah_oleh_fk` | FK | `(diubah_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_rute_kolektor_kolektor_kantor` | UNIQUE | `(kolektor_id, kantor_id)` — sasaran FK gabungan dari `rute_wilayah`. |
| `rute_kolektor_versi_check` | CHECK | `versi >= 1` |
| `rute_wilayah_pkey` | PK | `(kolektor_id, wilayah_id)` — satu kampung sekali per rute. |
| `rute_wilayah_rute_fk` | FK | `(kolektor_id, kantor_id)` → `rute_kolektor(kolektor_id, kantor_id)` `ON DELETE CASCADE` |
| `rute_wilayah_wilayah_fk` | FK | `(wilayah_id, kantor_id)` → `wilayah(id, kantor_id)` — **tanpa** cascade: kampung yang masih di rute tak bisa dihapus (`WILAYAH_MASIH_DIPAKAI`, [schema-wilayah.md](schema-wilayah.md)). |
| `uniq_rute_wilayah_urutan` | UNIQUE | `(kolektor_id, urutan)` — satu nomor rute, satu kampung. |
| `idx_rute_wilayah_wilayah` | INDEX | `(wilayah_id)` — gabung kampung: rute mana saja yang memuatnya. |
| `rute_wilayah_urutan_check` | CHECK | `urutan >= 1` |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `rute_kolektor.id` uuid + UNIQUE `(collector_id)` + UNIQUE `(id, boss_id)` | PK `kolektor_id` + UNIQUE `(kolektor_id, kantor_id)` | Satu kolektor satu rute — `id` terpisah tak menambah apa-apa; dua index hilang. |
| `rute_wilayah.rute_id` | `kolektor_id` | Mengikuti PK kepala. |
| `boss_id` (kedua tabel) | `kantor_id` | Konvensi #2. |
| `collector_id` | `kolektor_id` | Konvensi #3. |
| `diperbarui_oleh` (FK tunggal) | `diubah_oleh`, FK gabungan | Padanan README; pelaku orang kantor itu. |
| `created_at` / `updated_at` | `dibuat_at` / `diubah_at` | Konvensi #5. |
| FK `…_collector_tenant_fk`, `…_rute_tenant_fk`, `…_wilayah_tenant_fk` | `rute_kolektor_kolektor_fk`, `rute_wilayah_rute_fk`, `rute_wilayah_wilayah_fk` | Konvensi #8. |
| menyimpan: boss, admin, kolektor | **bos & kolektor (miliknya)** | Mengatur rute bukan urusan kasir. |
| — | CHECK `versi >= 1` | Kecil, menutup nilai mustahil. |

## Keputusan & timbangan

- **Dua tabel dipertahankan** (kepala + baris): `versi` milik rute utuh, bukan
  milik satu kampung; urutan sebagai baris ber-FK menjamin rute hanya menunjuk
  kampung kantor yang sama, dan ganti nama kampung tak menyentuh rute.
- **Disimpan utuh sekali jalan** di bawah `versi`, bukan diubah per kampung:
  menggeser satu kampung mengubah nomor banyak kampung lain; menulis ulang
  semua baris lebih sederhana dan atomik.
- **Kampung di rute tak bisa dihapus** (bukan cascade) — sesuai keputusan
  audit `wilayah`.

## API nantinya

Tetap seperti sekarang; field berganti nama mengikuti rilis aplikasi.

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /rute-kolektor?kolektorId=` | kolektor: miliknya (dari token); bos, pengawas: kolektor mana pun | `{ kolektorId, urutan: [{ wilayahId, nama }], versi, diubahOleh, diubahAt }`; tanpa rute → `urutan: []`, `versi: 0`. |
| `PUT /rute-kolektor` | kolektor (miliknya), bos | `{ kolektorId, urutan: [wilayahId…] \| [nama…], versi }` — versi basi → 409 (`RUTE_VERSI_BASI`), pesannya untuk orang di lapangan. Nama kampung dipastikan **sesudah** versi diperiksa. |

## Service / logika nantinya

1. **Menyimpan**: periksa peran (kolektor hanya miliknya; bos kolektor
   kantornya); kunci kepala rute (`FOR UPDATE`, atau sisipkan versi 1 bila
   belum ada); versi ≠ yang dikirim → 409; ubah nama → `wilayah_id` (gabung
   urutan ganda); hapus baris lama, tulis baris baru; naikkan `versi`, isi
   `diubah_oleh`; catat urutan lama & baru di `riwayat_perubahan`.
2. **Gabung kampung** (audit `wilayah`): pindahkan baris `rute_wilayah` ke
   kampung tujuan (entri ganda dalam satu rute dipadatkan, posisi paling depan
   dipertahankan) dan naikkan `versi` setiap rute yang terkena.
3. **Kolektor dinonaktifkan**: rute dibiarkan (dibaca lagi bila diaktifkan).

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Tambah `rute_wilayah.kolektor_id` dari `rute_kolektor.collector_id` lewat
   `rute_id`; buang FK & PK lama, buang `rute_id`.
2. `rute_kolektor`: buang `id` dan dua UNIQUE lama; PK `(kolektor_id)`; UNIQUE
   `(kolektor_id, kantor_id)`; pasang FK baru di `rute_wilayah`.
3. Ganti nama kolom, constraint, index; ganti FK `diubah_oleh` menjadi
   gabungan.
