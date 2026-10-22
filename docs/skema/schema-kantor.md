# `kantor` — tenant: profil, kalender, status penjadwal

**Status:** final (21 Okt 2026).

## Ringkasan

Satu baris = satu kantor (tenant). Semua tabel bisnis menunjuk ke sini lewat
`kantor_id`. Isinya hanya tiga urusan:

1. **profil** — nama kantor;
2. **kalender** — zona waktu, hari kerja, jam kerja; menentukan "hari ini"
   kantor dan kapan kolektor boleh bekerja;
3. **status penjadwal** — hari terakhir yang sudah disapu tutup hari.

`kantor` **tidak punya FK keluar**. Relasinya satu arah: semua pengguna —
termasuk bos pemiliknya — dan semua data bisnis menunjuk ke kantor.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama, **mandiri** (tidak lagi sama dengan id akun bos). |
| `nama` | `varchar(100)` | — | | Nama kantor, mis. "Nael Capital". |
| `zona_waktu` | enum `zona_waktu` (`WIB`, `WITA`, `WIT`) | — | `WIB` | Zona Indonesia, offset tetap tanpa jam musim panas. |
| `jam_buka` | `time` | — | `07:00` | Awal jam operasi lapangan (waktu kantor). |
| `jam_tutup` | `time` | — | `24:00` | Akhir jam operasi (eksklusif); `24:00` = tengah malam. |
| `tanggal_tutup_terakhir` | `date` | ya | | Hari terakhir yang sudah disapu tutup hari (macet & posisi harian). NULL = belum pernah. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | Diisi ulang setiap perubahan. |

Contoh baris:

```
id                      9f3c…
nama                    Nael Capital
zona_waktu              WIB
jam_buka                07:00
jam_tutup               24:00
tanggal_tutup_terakhir  2026-10-20
```

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `kantor_pkey` | PK | `(id)` |
| `kantor_jam_check` | CHECK | `jam_buka < jam_tutup` |

Tidak ada index tambahan: semua pembacaan lewat PK, dan sapuan tutup hari
membaca seluruh tabel yang barisnya sedikit.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `id` = id akun bos, FK ke `users.id` | `id` mandiri, tanpa FK keluar | Relasi melingkar kantor ↔ pengguna hilang; kantor tidak lagi terikat pada satu akun orang (pemilik bisa berganti). |
| Akun bos tanpa `boss_id` (NULL); kantornya ditemukan lewat `kantor.id = id boss` | Akun bos ber-`kantor_id` seperti peran lain | Tenant setiap pengguna dibaca dengan cara yang sama. Diputuskan tuntas di audit `pengguna`. |
| `jam_buka`, `jam_tutup` `smallint` jam bulat | `time` | Bisa 07:30, dan langsung terbaca di database. |
| `terakhir_ditutup` | `tanggal_tutup_terakhir` | Konvensi #9 — kolom `date` bernama `tanggal_*`. |
| `buku_kas_mulai` | **dibuang** → tabel `buku_kas` | Fakta pembukaan buku kas (tanggal + kas awal) bukan profil kantor; lihat di bawah. |
| Saklar rem di `kebijakan_kantor` (1:1) | tabel `kebijakan` lapis kantor | Lihat [schema-kebijakan.md](schema-kebijakan.md). |
| `created_at`, `updated_at` | `dibuat_at`, `diubah_at` | Konvensi #5. |
| `hari_kerja` | **dipindah** → tabel bertanggal [`pekan_kerja`](schema-pekan-kerja.md) | Mengubah pekan kerja tak boleh menggeser jadwal & tunggakan hari lampau (tinjauan ulang 23 Okt 2026). |

## Keputusan & timbangan

### Hubungan kantor ↔ pemilik — dipilih: bos juga ber-`kantor_id` (P2)

| | P0. `kantor.id` = id bos (lama) | P1. `kantor.pemilik_id` | **P2. Bos ber-`kantor_id` (dipilih)** |
|---|---|---|---|
| Arah relasi | melingkar | melingkar | **satu arah** pengguna → kantor |
| Semua pengguna punya `kantor_id` | ✗ bos NULL | ✗ bos NULL | **✓** |
| Ganti pemilik | ✗ mustahil | ✓ | ✓ |
| Jaminan satu bos per kantor | otomatis | UNIQUE `pemilik_id` | UNIQUE parsial di `pengguna` |
| Siap 2 bos (SaaS) | ✗ | ✗ | ✓ |

Siapa pemilik kantor = pengguna berperan bos di kantor itu, dijaga
`UNIQUE (kantor_id) WHERE peran = 'bos'` di tabel pengguna.

### Saklar rem — tabel `kebijakan`, bukan kolom di sini

Saklar dibaca tiga lapis sekaligus (kantor, kolektor, nasabah); menaruh lapis
kantor di sini tidak menghemat kueri dan mencampur urusan. Lihat
[schema-kebijakan.md](schema-kebijakan.md).

### Jam kerja — `time`

| | jam bulat `smallint` | menit `smallint` | **`time` (dipilih)** |
|---|---|---|---|
| Bisa 07:30 | ✗ | ✓ | ✓ |
| Terbaca di database | `7` | `450` | **`07:30`** |
| Konversi di kode | tidak perlu | tidak perlu | sekali, di pembaca kalender |

Ukuran tidak berpengaruh — satu baris per kantor.

### `hari_kerja` pindah ke `pekan_kerja` (bertanggal)

Tetap bitmask, tetapi satu baris per perubahan dengan `berlaku_mulai` — lihat
[schema-pekan-kerja.md](schema-pekan-kerja.md).

### `tanggal_tutup_terakhir` tetap di sini

Ini status penjadwal, bukan profil. Tidak bisa diturunkan dari
`posisi_harian` — kantor tanpa pinjaman aktif tidak punya baris di sana. Satu
baris per kantor, ditulis sekali semalam.

### `buku_kas_mulai` dibuang — pindah ke tabel `buku_kas`

Isinya tanggal bos membuka buku kas kantor. Tanggal itu **berpasangan**
dengan kas awal (isi brankas & rekening pada hari itu): kas awal tanpa
tanggal membuat setoran kolektor sebelum hari itu terhitung dua kali; tanggal
tanpa kas awal tidak punya titik mulai. Keduanya dipertahankan — itulah yang
membuat laporan kas bisa berkata "brankas seharusnya berisi sekian" dan
mendeteksi kebocoran — tetapi sebagai satu fakta di tabelnya sendiri:

```
buku_kas
  kantor_id        uuid PK → kantor    (satu kantor, satu buku kas)
  tanggal_buka     date
  kas_awal_tunai   bigint ≥ 0          (isi brankas/laci saat dibuka)
  kas_awal_bank    bigint ≥ 0          (saldo rekening saat dibuka)
  dibuka_oleh      uuid → pengguna
  dibuka_at        timestamptz
```

Nama `kas_awal_*` dipilih di atas `modal_awal_*`: isi brankas saat itu
bercampur (modal pemilik, laba terkumpul, tabungan nasabah titipan), dan
`modal` sudah dipakai jenis mutasi setoran pemilik. Rancangan lengkap
`buku_kas`: [schema-buku-kas.md](schema-buku-kas.md).

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /kantor` | semua | `{ id, nama, zonaWaktu, hariKerja: [1,2,3,4,5,6], jamBuka: "07:00", jamTutup: "24:00" }` |
| `PATCH /kantor` | bos | Sebagian dari `nama`, `zonaWaktu`, `jamBuka`, `jamTutup` (`"HH:MM"`, buka < tutup; `"24:00"` boleh untuk tutup). Pekan kerja lewat `PUT /kantor/pekan-kerja` ([schema-pekan-kerja.md](schema-pekan-kerja.md)). |

`tanggal_tutup_terakhir` tidak dikirim ke klien — urusan penjadwal.

Respons lama (`jamBuka: 7`, angka jam) dipertahankan sampai aplikasi beralih
ke `"HH:MM"`.

## Service / logika nantinya

- **Tenant** setiap permintaan = `kantor_id` dari token, sama untuk semua
  peran.
- **Registrasi bos** (berkode): dalam satu transaksi, buat `kantor` lebih
  dulu, lalu akun bos dengan `kantor_id`-nya, lalu baris pertama
  [`pekan_kerja`](schema-pekan-kerja.md) (126) dan tarif kantor
  [`tarif_gaji`](schema-tarif-gaji.md) (500) — keduanya berlaku mulai hari itu.
- **Kalender kantor**: satu baca PK per permintaan; `jam_buka`/`jam_tutup`
  diubah ke menit sejak tengah malam untuk dibandingkan dengan jam sekarang di
  zona kantor.
- **Mengubah pengaturan** (bos): satu transaksi; setiap kolom yang berubah
  tercatat di `riwayat_perubahan` (tabel `kantor`). Mengganti zona waktu
  menggeser "hari ini" seketika; hari yang sudah tercatat tidak bergeser
  karena pembukuan memakai kolom `date`.
- **Tutup hari**: penjadwal berdetak tiap jam, membaca semua kantor, dan
  menyapu kantor yang tengah malamnya sudah lewat menurut zona waktunya
  sendiri; lalu `tanggal_tutup_terakhir` dimajukan dengan
  `UPDATE … WHERE tanggal_tutup_terakhir IS NULL OR tanggal_tutup_terakhir < $tanggal`
  (tak pernah mundur; aman diulang).
- **Ganti pemilik** (kelak): akun bos lama dinonaktifkan, akun baru berperan
  bos di kantor yang sama — tanpa menyentuh data bisnis.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Lepas FK `kantor.id → users.id`. **Nilai `id` lama dipertahankan** (kebetulan
   sama dengan id akun bos), sehingga tidak ada data tabel lain yang ditulis
   ulang.
2. Akun bos: isi `kantor_id = kantor.id` (= id akun itu sendiri).
3. `jam_buka`/`jam_tutup`: `smallint` → `time` (`make_time(jam, 0, 0)`; nilai
   24 → `'24:00'`).
4. Ganti nama `terakhir_ditutup` → `tanggal_tutup_terakhir`,
   `created_at`/`updated_at` → `dibuat_at`/`diubah_at`.
5. Pindahkan `buku_kas_mulai` ke `buku_kas` (bersama kas awal) — urutan
   rinciannya di [schema-buku-kas.md](schema-buku-kas.md).
6. Saklar `kebijakan_kantor` → `kebijakan` — lihat dokumennya.
