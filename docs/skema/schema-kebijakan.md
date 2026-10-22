# `kebijakan` — rem operasional bos

**Status:** final (21 Okt 2026). Menggantikan `kebijakan_kantor` dan
`kebijakan_kolektor`.

## Ringkasan

Satu tabel untuk **semua saklar rem** yang ditarik bos dari aplikasinya,
di **tiga lapis**: seluruh kantor, satu kolektor, atau satu nasabah. Bos
mengunci atau membuka dengan satu toggle; tidak ada jangka waktu.

**Tanpa baris = terbuka.** Tabel hanya berisi rem yang sedang menyala.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Tenant. FK ke `kantor`. |
| `kolektor_id` | `uuid` | ya | | Terisi = saklar khusus kolektor itu. |
| `nasabah_id` | `uuid` | ya | | Terisi = saklar khusus nasabah itu. |
| `pinjaman_baru_dikunci` | `boolean` | — | `false` | Mengunci **semua akad baru**: orang baru maupun nasabah lama yang meminjam lagi. |
| `naik_pinjaman_dikunci` | `boolean` | — | `false` | Mengunci gulung yang **menaikkan** pokok. |
| `gulung_pinjaman_dikunci` | `boolean` | — | `false` | Mengunci **semua** gulung: naik, tetap, turun. |
| `alasan_kunci` | `varchar(100)` | ya | | Tercetak di pesan penolakan ke kolektor. |
| `diubah_oleh` | `uuid` | — | | Bos yang terakhir menekan toggle. FK ke pengguna. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | Diisi ulang setiap perubahan. |

Lapis ditentukan oleh kolom sasaran:

| `kolektor_id` | `nasabah_id` | Lapis |
|---|---|---|
| NULL | NULL | **kantor** |
| terisi | NULL | **kolektor** |
| NULL | terisi | **nasabah** |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `kebijakan_pkey` | PK | `(id)` |
| `kebijakan_kantor_fk` | FK | `kantor_id` → `kantor(id)` |
| `kebijakan_kolektor_fk` | FK | `(kolektor_id, kantor_id)` → `pengguna(id, kolektor_kantor_id)` — hanya kolektor kantor yang sama; NULL dilewati (MATCH SIMPLE). |
| `kebijakan_nasabah_fk` | FK | `(nasabah_id, kantor_id)` → `nasabah(id, kantor_id)` — hanya nasabah kantor yang sama. |
| `kebijakan_diubah_oleh_fk` | FK | `(diubah_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `kebijakan_sasaran_check` | CHECK | `num_nonnulls(kolektor_id, nasabah_id) <= 1` — satu baris, satu sasaran. |
| `kebijakan_lapis_nasabah_check` | CHECK | `nasabah_id IS NULL OR pinjaman_baru_dikunci = false` — "nasabah ini tak boleh pinjam lagi" adalah tugas **blokir** di `nasabah`, bukan di sini. |
| `kebijakan_menyala_check` | CHECK | `pinjaman_baru_dikunci OR naik_pinjaman_dikunci OR gulung_pinjaman_dikunci` — "tanpa baris = terbuka" dijaga database: baris yang semua saklarnya mati harus dihapus, bukan disimpan (ditambahkan saat pembangunan, 23 Okt 2026).
| `uniq_kebijakan_kantor` | UNIQUE parsial | `(kantor_id) WHERE kolektor_id IS NULL AND nasabah_id IS NULL` |
| `uniq_kebijakan_kolektor` | UNIQUE parsial | `(kolektor_id) WHERE kolektor_id IS NOT NULL` |
| `uniq_kebijakan_nasabah` | UNIQUE parsial | `(nasabah_id) WHERE nasabah_id IS NOT NULL` |

Ketiga UNIQUE parsial sekaligus menjadi jalur baca guard dan sasaran upsert
(`ON CONFLICT (kolektor_id) WHERE kolektor_id IS NOT NULL`, dst.). Berjalan di
semua versi Postgres — tidak bergantung pada `NULLS NOT DISTINCT`.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| Dua tabel kembar `kebijakan_kantor` (1:1) & `kebijakan_kolektor` | Satu tabel `kebijakan`, tiga lapis | Kolom saklar didefinisikan sekali; guard membaca **satu** kueri, bukan dua. |
| — | Lapis **nasabah** (`nasabah_id`) | Bos bisa menahan gulung satu nasabah tanpa mengunci kolektornya. |
| `pencairan_baru_dikunci` | `pinjaman_baru_dikunci` | Nama jujur: yang dikunci semua akad baru, bukan hanya "pencairan". |
| `gulung_naik_dikunci` | `naik_pinjaman_dikunci` | Penamaan keputusan pemilik usaha. |
| — | `gulung_pinjaman_dikunci` | Kebutuhan baru: "hari ini kolektor hanya menagih", semua gulung terkunci. |
| `keterangan` | `alasan_kunci` | Konvensi #6 — ini sebab kejadian. |
| `diperbarui_oleh` (boleh kosong) | `diubah_oleh` (wajib) | Konvensi #5; baris hanya ada bila bos pernah menekan toggle. |
| `boss_id`, `collector_id` | `kantor_id`, `kolektor_id` | Konvensi #2, #3. |
| `created_at`, `updated_at` | `dibuat_at`, `diubah_at` | Konvensi #5. |

## Keputusan & timbangan

**Satu tabel tiga lapis** dipilih di atas dua alternatif:

| | Satu tabel (dipilih) | Tiga tabel terpisah | Kolom di `kantor`/`pengguna`/`nasabah` |
|---|---|---|---|
| Kueri guard | 1 | 1–3 | 0 |
| Definisi kolom saklar | 1× | 3× | 3× |
| Menambah saklar baru | 1 kolom | 3 kolom | 3 kolom |
| Daftar "rem yang menyala" | 1 kueri | UNION | pindai 3 tabel besar |
| Kemurnian tabel lain | ✓ | ✓ | ✗ |

Selisih kecepatan kolom-di-pemilik hanya satu kueri ke tabel berbaris sedikit —
tak sepadan dengan saklar yang tercecer.

**Tidak memakai satu-baris-per-saklar** (`kunci = 'gulung'`, `nilai = true`):
tipe tak terjaga dan saklar jarang bertambah.

**Tanpa jangka waktu** (`berlaku_sampai` ditolak): bos membuka dengan toggle.

**Saklar kolektor & nasabah hanya bisa MENAMBAH kunci**, tak pernah
membebaskan dari saklar kantor (keputusan 14 Sep 2026, tetap berlaku):
"kunci semua kecuali X" = matikan saklar kantor, lalu kunci kolektor satu per
satu.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /kebijakan` | semua | Kolektor: saklar yang **berlaku** baginya (gabungan kantor + dirinya). Bos & pengawas: saklar kantor. |
| `GET /kebijakan/aktif` | bos, pengawas | Semua rem yang menyala di kantor (= semua baris), tiap baris dengan lapis & sasarannya. |
| `PUT /kebijakan/kantor` | bos | `{ pinjamanBaruDikunci, naikPinjamanDikunci, gulungPinjamanDikunci, alasanKunci? }` |
| `PUT /kebijakan/kolektor/:kolektorId` | bos | Sama seperti di atas. |
| `PUT /kebijakan/nasabah/:nasabahId` | bos | `{ naikPinjamanDikunci, gulungPinjamanDikunci, alasanKunci? }` — tanpa saklar pinjaman baru. |

Kartu pinjaman (`GET /pinjaman`) sebaiknya ikut membawa status kunci gulung
yang berlaku untuk nasabah itu, supaya tombol Gulung di aplikasi bisa
dinonaktifkan sebelum kolektor menekannya.

Jalur lama `/kebijakan-kantor` & `/kebijakan-kantor/kolektor/:collectorId`
dipertahankan sampai aplikasi beralih.

## Service / logika nantinya

**Membaca (guard)** — satu kueri, paling banyak 3 baris:

```sql
SELECT … FROM kebijakan
WHERE kantor_id = $kantor
  AND ( (kolektor_id IS NULL AND nasabah_id IS NULL)
     OR kolektor_id = $kolektor
     OR nasabah_id  = $nasabah )
```

- **Akad baru** ditolak (`PINJAMAN_BARU_DIKUNCI`) bila `pinjaman_baru_dikunci`
  menyala di lapis kantor **atau** kolektor.
- **Gulung** ditolak (`GULUNG_PINJAMAN_DIKUNCI`) bila `gulung_pinjaman_dikunci`
  menyala di lapis mana pun; **gulung naik** juga ditolak
  (`NAIK_PINJAMAN_DIKUNCI`) bila `naik_pinjaman_dikunci` menyala di lapis mana
  pun. Jenis naik/tetap/turun ditentukan dulu oleh aturan gulung.
- **Alasan yang tercetak**: milik lapis **paling spesifik** di antara yang
  mengunci — nasabah, lalu kolektor, lalu kantor. Kosong → pesan umum.

**Menulis (toggle)** — bos saja, satu transaksi:

- Upsert baris lapis itu; bila **ketiga saklar mati**, barisnya **dihapus**
  (tanpa baris = terbuka), sehingga `GET /kebijakan/aktif` cukup membaca semua
  baris.
- Setiap perubahan dicatat di `riwayat_perubahan` (tabel `kebijakan`, nilai
  sebelum & sesudah, siapa) — `diubah_oleh` hanya menyimpan yang terakhir.
- Kolektor & nasabah sasaran wajib milik kantor bos (FK menjaganya juga).

**Peristiwa lain:**

- Nasabah dipindah ke kolektor lain → kunci lapis nasabah **ikut nasabahnya**.
- Kolektor dinonaktifkan → barisnya tetap ada dan tak berbahaya; boleh dihapus
  bersama penonaktifan.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat `kebijakan` beserta aturannya.
2. Salin `kebijakan_kantor` → baris lapis kantor;
   `kebijakan_kolektor` → baris lapis kolektor
   (`pencairan_baru_dikunci` → `pinjaman_baru_dikunci`,
   `gulung_naik_dikunci` → `naik_pinjaman_dikunci`,
   `keterangan` → `alasan_kunci`, `diperbarui_oleh` → `diubah_oleh` — baris
   tanpa `diperbarui_oleh` memakai id bos pemilik kantor). Baris yang semua
   saklarnya mati tidak disalin.
3. `riwayat_perubahan`: enum `tabel_berjejak` memuat `kebijakan`
   ([schema-riwayat-perubahan.md](schema-riwayat-perubahan.md)); jejak lama tetap bernama `kebijakan_kantor` /
   `kebijakan_kolektor`.
4. Hapus `kebijakan_kantor` & `kebijakan_kolektor` setelah kode beralih.
