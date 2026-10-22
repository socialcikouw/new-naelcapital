# `mutasi_kas_kantor` — uang kantor yang tidak punya tabel asal

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu gerakan uang kantor yang dicatat tangan oleh bos**: setor
atau tarik modal, biaya kantor, pindah tunai ↔ bank, dan lain-lain.

Hanya mutasi yang **tidak punya tabel asal**. Uang kolektor
(`serah_terima_kas`, `transfer_setoran`), penarikan tabungan, dan gaji **tidak
disalin** ke sini — laporan kas membacanya langsung dari tabelnya
([schema-buku-kas.md](schema-buku-kas.md#rumus-saldo-akun)).

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor). |
| `jenis` | enum `jenis_mutasi_kas` | — | | Lihat tabel jenis. |
| `dari_akun` | enum `akun_kas` (`tunai`, `bank`) | ya | | Akun yang **berkurang**; kosong untuk mutasi masuk. |
| `ke_akun` | enum `akun_kas` | ya | | Akun yang **bertambah**; kosong untuk mutasi keluar. |
| `nominal` | `bigint` | — | | |
| `keterangan` | `varchar(200)` | — | | **Wajib.** Isi bebas ("listrik Oktober", "setor ke BRI"). |
| `dibuat_oleh` | `uuid` | — | | Bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan. |

### Jenis

| Jenis | Arah | Contoh | Masuk laba/rugi? |
|---|---|---|---|
| `setor_modal` | masuk (`ke_akun`) | Pemilik menambah modal. | tidak |
| `tarik_modal` (baru) | keluar (`dari_akun`) | Pemilik mengambil uang untuk pribadi / mengambil keuntungan. | tidak |
| `biaya_kantor` | keluar | Sewa, listrik, ATK. | **ya** (pengeluaran) |
| `pindah_akun` | keduanya, beda akun | Setor tunai ke bank, tarik dari bank. | tidak |
| `lain_masuk` | masuk | Selain di atas, keterangan menjelaskan. | ya |
| `lain_keluar` | keluar | Selain di atas; juga pembetulan kas awal sesudah hari pembukaan. | ya |

`tarik_modal` dipisah supaya uang yang diambil pemilik tidak tercampur dengan
"lain keluar" — laporan laba tetap jujur, dan bos melihat berapa yang sudah ia
ambil.

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `mutasi_kas_kantor_pkey` | PK | `(id)` |
| `mutasi_kas_kantor_kantor_fk` | FK | `(kantor_id)` → `buku_kas(kantor_id)` — tak ada mutasi sebelum buku kas dibuka. |
| `mutasi_kas_kantor_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `mutasi_kas_kantor_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `idx_mutasi_kas_kantor_kantor_tanggal` | INDEX | `(kantor_id, tanggal)` — buku kas per rentang tanggal. |
| `mutasi_kas_kantor_nominal_check` | CHECK | `nominal > 0` |
| `mutasi_kas_kantor_keterangan_check` | CHECK | `length(btrim(keterangan)) > 0` |
| `mutasi_kas_kantor_akun_check` | CHECK | masuk (`setor_modal`, `lain_masuk`): hanya `ke_akun`; keluar (`tarik_modal`, `biaya_kantor`, `lain_keluar`): hanya `dari_akun`; `pindah_akun`: keduanya terisi dan berbeda. Ditulis dengan `IS NOT NULL` eksplisit dan `jenis::text`. |
| `mutasi_kas_kantor_batal_check` | CHECK | Kolom batal terisi bersamaan atau kosong bersamaan. |
| `mutasi_kas_kantor_append_only` | TRIGGER | UPDATE hanya boleh menandai batal; DELETE ditolak (`uang_hanya_batal()`, sudah ada). |

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` → `kantor` | `kantor_id` → `buku_kas` | Konvensi #2; FK ke `buku_kas` menggantikan pemeriksaan "buku sudah dibuka" di service. |
| jenis `saldo_awal` | **dibuang** | Kas awal di `buku_kas`. |
| jenis `modal` | `setor_modal` | Pasangan `tarik_modal`. |
| — | jenis `tarik_modal` | Pemilik pernah mengambil uang dari kas (keputusan pemilik usaha). |
| jenis `pengeluaran` | `biaya_kantor` | "Pengeluaran" terlalu umum; sejajar `biaya_tak_terduga`. |
| jenis `pindah` | `pindah_akun` | Jelas apa yang pindah. |
| dicatat boss/admin | **bos saja** | Keputusan peran: buku kas kantor hanya bos. |
| FK tunggal `dibuat_oleh`, `dibatalkan_oleh` | FK gabungan | Pelaku pasti orang kantor itu. |
| `created_at` | `dibuat_at` | Konvensi #5. |
| `alasan_batal varchar(200)` | `varchar(100)` | Seragam dengan tabel uang lain. |
| index `idx_mutasi_kas_kantor_tanggal` | `idx_mutasi_kas_kantor_kantor_tanggal` | Konvensi #8. |

## Keputusan & timbangan

- **Hanya mutasi tanpa tabel asal** (dipertahankan) — satu rupiah satu catatan.
- **Nama tabel tetap** `mutasi_kas_kantor`: membedakan dari kas lapangan
  kolektor.
- **Laba/rugi** membaca `biaya_kantor`, `lain_masuk`, `lain_keluar`;
  `setor_modal`, `tarik_modal`, `pindah_akun` bukan laba/rugi.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /kas/mutasi` | bos | `{ jenis, dariAkun?, keAkun?, nominal, keterangan }` — hari ini. |
| `POST /kas/mutasi/:id/batal` | bos | `{ alasan }` — hari yang sama (`BATAL_HANYA_HARI_INI`). |
| Daftar | lewat `GET /kas/laporan` | bos, pengawas. |

Nilai jenis lama (`modal`, `pengeluaran`, `pindah`) diterima & diterjemahkan
sampai aplikasi beralih.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Pindahkan `saldo_awal` ke `buku_kas`, lalu hapus baris-baris itu di
   transaksi migrasi yang membuka `nael.hapus_data_uji` (satu-satunya jalan
   DELETE yang diizinkan trigger hanya-bertambah).
2. Ganti nilai enum: `modal` → `setor_modal`, `pengeluaran` → `biaya_kantor`,
   `pindah` → `pindah_akun` (`ALTER TYPE … RENAME VALUE`); tambah `tarik_modal`;
   buang `saldo_awal` (buat ulang tipe).
3. Ganti nama kolom & index; ganti FK; pasang CHECK baru.
