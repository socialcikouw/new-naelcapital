# `tarif_gaji` — persen gaji kolektor atas storting

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu tarif gaji yang mulai berlaku pada suatu tanggal**, dalam
basis poin atas storting (500 = 5%, 450 = 4,5%). Dua lapis, polanya sama dengan
[`kebijakan`](schema-kebijakan.md):

| Lapis | `kolektor_id` | Arti |
|---|---|---|
| Kantor | kosong | Berlaku untuk semua kolektor. **Wajib ada** sejak kantor dibuat. |
| Kolektor | terisi | Tarif khusus, menimpa tarif kantor. `tarif_bp` kosong = mulai tanggal itu **kembali ikut tarif kantor**. |

**Bertanggal, tidak ditimpa**: tarif untuk satu hari adalah baris terbaru yang
`berlaku_mulai`-nya ≤ hari itu. Mengganti 5% menjadi 6% bulan ini tidak
mengubah gaji bulan-bulan lalu.

Contoh:

| `kolektor_id` | `tarif_bp` | `berlaku_mulai` | |
|---|---|---|---|
| — | 500 | 1 Jan | kantor 5% |
| Andi | 600 | 1 Okt | Andi 6% mulai Oktober |
| Andi | — | 1 Des | Andi kembali ikut kantor |
| — | 550 | 1 Des | kantor 5,5% |

Gaji Andi 15 Nov = storting × 6%; 15 Des = storting × 5,5%.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `kolektor_id` | `uuid` | ya | | Kosong = tarif kantor. |
| `tarif_bp` | `integer` | ya | | Basis poin, 0–10000. Kosong hanya di lapis kolektor ("ikut kantor"). Bilangan bulat supaya persen pecahan tak tersimpan sebagai float. |
| `berlaku_mulai` | `date` | — | | Hari pertama tarif ini dipakai (kalender kantor). |
| `dibuat_oleh` | `uuid` | — | | Bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | Disentuh bila bos menimpa baris bertanggal mulai sama (salah ketik, sebelum berlaku). |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `tarif_gaji_pkey` | PK | `(id)` |
| `tarif_gaji_kantor_fk` | FK | `(kantor_id)` → `kantor(id)` |
| `tarif_gaji_kolektor_fk` | FK | `(kolektor_id, kantor_id)` → `pengguna(id, kolektor_kantor_id)` — pasti kolektor kantor itu. |
| `tarif_gaji_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_tarif_gaji_kantor` | UNIQUE parsial | `(kantor_id, berlaku_mulai) WHERE kolektor_id IS NULL` — satu tarif kantor per tanggal mulai; jalur "tarif kantor terbaru pada tanggal X". |
| `uniq_tarif_gaji_kolektor` | UNIQUE parsial | `(kolektor_id, berlaku_mulai) WHERE kolektor_id IS NOT NULL` — sama untuk lapis kolektor. |
| `tarif_gaji_tarif_check` | CHECK | `(tarif_bp IS NULL AND kolektor_id IS NOT NULL) OR (tarif_bp IS NOT NULL AND tarif_bp BETWEEN 0 AND 10000)` — `IS NOT NULL` ditulis terang (CHECK meloloskan NULL). |
| `tarif_gaji_tidak_mundur` | TRIGGER (BEFORE INSERT OR UPDATE OR DELETE) | Tolak INSERT dengan `berlaku_mulai` < hari ini (zona kantor); tolak UPDATE/DELETE baris yang `berlaku_mulai`-nya < hari ini (`TARIF_TIDAK_BOLEH_MUNDUR`). Kecuali transaksi migrasi (mengisi tarif sejak tanggal data paling awal) dan skrip data uji (`nael.hapus_data_uji`). Tarif pertama saat kantor dibuat berlaku hari itu, jadi lolos tanpa pengecualian. |

Dua UNIQUE parsial, bukan satu index atas `(kantor_id, kolektor_id,
berlaku_mulai)`: NULL di unique index dianggap saling berbeda, sehingga tarif
kantor bisa dobel. (`NULLS NOT DISTINCT` butuh Postgres 15 — versi VPS belum
pasti.)

## Cara membaca tarif satu hari

```
tarif(kolektor, hari) =
  coalesce(
    (tarif_bp baris lapis kolektor terbaru dengan berlaku_mulai ≤ hari),  -- kosong → lanjut
    (tarif_bp baris lapis kantor terbaru dengan berlaku_mulai ≤ hari)
  )
gaji_kotor(periode) = round(Σ per hari (storting × tarif) / 10000)
```

Tidak ada lagi angka bawaan 5% di kode: lapis kantor selalu punya baris.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` | `kantor_id` | Konvensi #2. |
| `collector_id` | `kolektor_id` | Kolom sasaran; pola sama dengan `kebijakan`. |
| `persen_bp` | `tarif_bp` | "Persen basis poin" bertentangan sendiri; `_bp` menyebut satuannya. |
| bawaan 5% di kode (`GAJI_BAWAAN_BP`, di service **dan** query gaji) | baris tarif kantor wajib, dibuat saat kantor dibuat | Satu sumber kebenaran; tak ada dua tempat yang wajib sama. |
| tarif mundur dicegah service | + trigger `tarif_gaji_tidak_mundur` | Jaring pengaman: tarif lampau yang berubah diam-diam menggeser gaji yang belum dibayar. |
| FK tunggal `dibuat_oleh`; `tarif_gaji_collector_tenant_fk` | FK gabungan; `tarif_gaji_kolektor_fk` | Konvensi #8; pelaku orang kantor itu. |
| `created_at` | `dibuat_at` + `diubah_at` | Timpa baris bertanggal sama kini terlihat. |

## Keputusan & timbangan

- **"Kosong = ikut kantor" dipertahankan**, tanpa kolom `ikut_kantor`
  tambahan — kolom itu hanya mengulang arti `tarif_bp` kosong. Artinya dikunci
  CHECK dan dokumen ini.
- **Boleh menimpa baris bertanggal mulai sama** selama belum berlaku (hari ini
  atau ke depan) — salah ketik; nilai lama tercatat di `riwayat_perubahan`.
- **Nama tabel tetap** `tarif_gaji`.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /tarif-gaji/berlaku?kolektorId=` | bos, pengawas; kolektor: miliknya | Tarif hari ini + sumbernya (`kolektor` / `kantor`). Sumber `bawaan` hilang. |
| `GET /tarif-gaji` | bos, pengawas | Riwayat seluruh tarif kantor, terbaru dulu. |
| `PUT /tarif-gaji` | bos | `{ kolektorId?, tarifBp \| null, berlakuMulai? }` — bawaan hari ini; tidak boleh mundur. |

Field lama `persenBp` diterima sampai aplikasi beralih.

## Service / logika nantinya

- **Membuat kantor** menulis baris tarif kantor pertama (500, `berlaku_mulai`
  = tanggal kantor dibuat) di transaksi database yang sama.
- **Mengatur tarif** (bos): `berlakuMulai` ≥ hari ini; tarif kantor wajib
  berpersen (`TARIF_KANTOR_WAJIB_PERSEN`); kolektor milik kantor; tanggal mulai
  yang sudah ada → timpa + catat riwayat, selain itu baris baru.
- **Pratinjau & pembayaran gaji** memakai rumus di atas; hasilnya dibekukan di
  [`pembayaran_gaji`](schema-pembayaran-gaji.md).

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama kolom, constraint, dan index; ganti FK.
2. Kantor yang belum punya tarif kantor: sisipkan 500 berlaku sejak tanggal
   transaksi/akad paling awal kantor itu (atau `kantor.dibuat_at`, mana yang
   lebih dulu) — gaji lama tetap sama karena dulu bawaannya 5%.
3. Pasang trigger; buang `GAJI_BAWAAN_BP` dari kode setelah semua kantor punya
   baris.
