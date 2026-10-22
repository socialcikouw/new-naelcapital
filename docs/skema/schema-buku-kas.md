# `buku_kas` — pembukaan buku kas kantor (baru)

**Status:** final (22 Okt 2026). Tabel baru; menggantikan
`kantor.buku_kas_mulai` dan mutasi jenis `saldo_awal`.

## Ringkasan

Satu baris = **satu kantor membuka buku kasnya**: tanggal mulai dan isi kas
pada hari itu (brankas & rekening). Inilah titik nol laporan kas — sejak
tanggal ini sistem bisa berkata "brankas seharusnya berisi sekian" dan
mendeteksi kebocoran.

Tanpa baris ini buku kas **belum dibuka**: mutasi kas, penarikan tabungan, dan
pembayaran gaji ditolak (`BUKU_KAS_BELUM_DIBUKA`), laporan kas kosong.

## Akun kas

Kantor memakai **satu rekening bank** (keputusan pemilik usaha), jadi akun kas
tetap dua — enum `akun_kas`:

| Akun | Isi |
|---|---|
| `tunai` | Uang fisik di brankas/laci kantor. |
| `bank` | Satu-satunya rekening kantor. |

Bila kelak ada rekening/e-wallet kedua, enum ini diganti tabel `rekening`
(kolom `dari_akun`/`ke_akun` di tabel uang menjadi FK) — tidak perlu sekarang.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `kantor_id` | `uuid` | — | | **PK** — satu kantor, satu buku kas. |
| `tanggal_buka` | `date` | — | | Hari pembukuan pertama (kalender kantor). Uang kolektor sebelum tanggal ini tidak dihitung (sudah terkandung di kas awal). |
| `kas_awal_tunai` | `bigint` | — | `0` | Isi brankas/laci saat dibuka. |
| `kas_awal_bank` | `bigint` | — | `0` | Saldo rekening saat dibuka. |
| `dibuka_oleh` | `uuid` | — | | Bos. |
| `dibuka_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | Disentuh bila kas awal dibetulkan (hanya di hari pembukaan). |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `buku_kas_pkey` | PK | `(kantor_id)` |
| `buku_kas_kantor_fk` | FK | `(kantor_id)` → `kantor(id)` |
| `buku_kas_dibuka_oleh_fk` | FK | `(dibuka_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `buku_kas_nominal_check` | CHECK | `kas_awal_tunai >= 0 AND kas_awal_bank >= 0` |

## Rumus saldo akun

Buku kas **tidak menyalin** uang yang punya tabel asal — saldo dijumlahkan dari
sumbernya, sejak `tanggal_buka`:

```
saldo tunai = kas_awal_tunai
            + Σ mutasi_kas_kantor ke 'tunai' − Σ dari 'tunai'
            + Σ (serah_terima_kas.tunai_diterima − kas_lapangan − uang_jalan)
                (hari kolektor yang punya serah terima berlaku)
            − Σ penarikan_tabungan dari 'tunai'
            − Σ pembayaran_gaji dari 'tunai'

saldo bank  = kas_awal_bank
            + Σ mutasi_kas_kantor ke 'bank' − Σ dari 'bank'
            + Σ transfer_setoran berlaku (transaksinya berlaku), menurut
                transaksi.tanggal — SEJAK DICATAT kasir, tanpa menunggu
                serah terima: uangnya sudah ada di rekening
            + Σ hari_kolektor.transfer_lama (arsip; hari yang dulu sudah
                diterima kasnya)
            − Σ penarikan_tabungan dari 'bank'
            − Σ pembayaran_gaji dari 'bank'

kas di lapangan = Σ (kas_lapangan + uang_jalan) hari kolektor masuk kerja
                  yang BELUM punya serah terima berlaku

brankas seharusnya = saldo tunai − kas di lapangan
```

Kas lapangan & uang jalan keluar dari brankas pagi hari, tetapi baru
dikurangkan dari saldo tunai saat serah terima. Jadi **saldo tunai buku
= isi brankas + uang yang sedang dibawa kolektor**; yang dicocokkan dengan
brankas adalah `brankas seharusnya`
([schema-pencocokan-kas.md](schema-pencocokan-kas.md)).

Semua yang batal tidak dihitung. Satu rupiah tidak pernah punya dua catatan.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `kantor.buku_kas_mulai` | `buku_kas.tanggal_buka` | Fakta pembukaan buku, bukan profil kantor ([schema-kantor.md](schema-kantor.md)). |
| mutasi `saldo_awal` (satu per akun) | `kas_awal_tunai`, `kas_awal_bank` | Tanggal & kas awal satu fakta, satu baris; mutasi tinggal kejadian sungguhan. |
| `saldo_awal` tidak bisa dibatalkan sama sekali | boleh dibetulkan bos **di hari pembukaan** | Salah ketik di hari pertama wajar; sesudahnya lewat mutasi `lain_masuk`/`lain_keluar` berketerangan. |

## Keputusan & timbangan

- **Nama `kas_awal_*`**, bukan `modal_awal_*`: isi brankas saat itu bercampur
  (modal, laba terkumpul, tabungan nasabah titipan).
- **Bisa diubah hanya di hari pembukaan** (dicatat di `riwayat_perubahan`):
  sesudah ada mutasi & serah terima, mengubah titik nol menggeser semua saldo
  lampau.
- **Satu rekening** → enum dua akun, tanpa tabel `rekening`.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /kas/buka` | bos | `{ tunai, bank }` — sekali; tanggal = hari ini (`BUKU_KAS_SUDAH_DIBUKA`). |
| `PATCH /kas/buka` | bos | `{ tunai?, bank? }` — hanya di `tanggal_buka` (`BATAL_HANYA_HARI_INI`). |
| `GET /kas/laporan?mulai=&selesai=` | bos, pengawas | Saldo awal & akhir per akun, kas di lapangan, rincian mutasi, serah terima, penarikan tabungan, gaji. |

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat tabel; isi dari `kantor.buku_kas_mulai` + mutasi `saldo_awal` per akun
   (yang tidak batal).
2. Buang mutasi `saldo_awal` dan nilainya dari enum; buang
   `kantor.buku_kas_mulai`.
3. Alihkan laporan kas ke rumus di atas.
