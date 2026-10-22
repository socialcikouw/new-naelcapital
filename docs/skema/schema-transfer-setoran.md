# `transfer_setoran` — setoran yang dibayar lewat transfer (baru)

**Status:** final (22 Okt 2026). Tabel baru; menggantikan kolom total
`hari_kolektor.transfer`.

## Ringkasan

Satu baris = **satu setoran nasabah (transaksi) yang dibayar sebagian atau
seluruhnya lewat transfer** ke rekening kantor. Dicatat **kasir** saat
kolektor menyetor sore hari; hanya **bos** yang membatalkan atau mengoreksi.

Dulu transfer hanya satu angka total per kolektor per hari, diisi kolektor
sendiri — tak ada catatan nasabah mana yang mentransfer, sehingga bos tak bisa
mencocokkannya satu per satu dengan mutasi rekening.

Contoh setoran Andi hari ini:

| Nasabah | Setoran | Lewat transfer |
|---|---|---|
| Budi | 50.000 | 50.000 |
| Sari | 30.000 | 20.000 (sisanya tunai) |
| Tono | 40.000 | — |

Total transfer Andi = 70.000 → dipakai menghitung tunai yang seharusnya ia
serahkan, dan masuk ke akun **bank** di buku kas kantor.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `transaksi_id` | `uuid` | — | | Setoran yang dibayar lewat transfer. Kolektor & tanggalnya dibaca dari transaksi itu (`pencatat_id`, `tanggal`) — tidak disalin. |
| `nominal` | `bigint` | — | | Bagian setoran yang ditransfer. |
| `dibuat_oleh` | `uuid` | — | | Kasir atau bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos. |
| `alasan_batal` | `varchar(100)` | ya | | Wajib saat dibatalkan. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `transfer_setoran_pkey` | PK | `(id)` |
| `transfer_setoran_transaksi_fk` | FK | `(transaksi_id, kantor_id)` → `transaksi(id, kantor_id)` |
| `transfer_setoran_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `transfer_setoran_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_transfer_setoran_transaksi` | UNIQUE parsial | `(transaksi_id) WHERE dibatalkan_at IS NULL` — satu catatan transfer berlaku per setoran; sekaligus jalur join dari transaksi. |
| `transfer_setoran_nominal_check` | CHECK | `nominal > 0` |
| `transfer_setoran_batal_check` | CHECK | `dibatalkan_at`, `dibatalkan_oleh`, `alasan_batal` terisi bersamaan atau kosong bersamaan. |
| `transfer_setoran_batas` | TRIGGER (BEFORE INSERT) | Nominal ≤ uang yang benar-benar dibayar nasabah di transaksi itu — lihat tabel batas. Transaksi `gulung` atau yang sudah batal ditolak. |
| `transfer_setoran_append_only` | TRIGGER | Hanya bertambah: UPDATE hanya boleh menandai batal; DELETE ditolak (fungsi `uang_hanya_batal()`, sama dengan buku kas & gaji). |

Batas nominal:

| Jenis transaksi | Batas transfer |
|---|---|
| `angsuran` | `setoran_murni + setoran_pelunasan` |
| `pelunasan` | `setoran_murni` — bagian yang ditutup tabungan bukan uang dari nasabah |
| `gulung` | tidak boleh — tak ada uang yang dibayar nasabah |
| transaksi batal | tidak boleh |

Karena `transaksi` hanya bertambah, batas yang lolos saat dicatat tetap benar
selamanya.

## Keputusan & timbangan

- **Ramping — kolektor & tanggal diturunkan lewat join ke `transaksi`.**
  Transfer per kolektor per hari hanya beberapa belas baris; join lewat index
  `transaksi (pencatat_id, tanggal)` lalu `uniq_transfer_setoran_transaksi`
  sangat cepat. Menyalinnya akan butuh FK gabungan empat kolom dan satu index
  tambahan di tabel transaksi yang besar.
- **Batas per jenis dijaga trigger**, lebih ketat dari pengecekan lama (total
  transfer ≤ total setoran sehari).
- **Transfer sebagian boleh** — satu catatan per setoran.
- **Terkunci setelah kas diterima**: mengubah transfer menggeser tunai
  seharusnya dan tekor yang sudah dihitung. Koreksi = bos membatalkan
  penerimaan kas, membetulkan transfer, kasir menerima ulang.
- **Tanpa foto bukti** untuk sekarang: bukti terkuat adalah mutasi rekening
  yang dicocokkan bos. Kelak cukup satu kolom penunjuk ke `foto`.
- **Nama `transfer_setoran`**: transfer atas sebuah setoran — satu baris
  menempel pada satu transaksi.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /transfer-setoran?kolektorId=&tanggal=` | bos, kasir, pengawas; kolektor miliknya | Daftar transfer satu kolektor satu hari + total, beserta nama nasabah & setorannya. |
| `POST /transfer-setoran` | kasir, bos | `{ transaksiId, nominal }` |
| `POST /transfer-setoran/:id/batal` | bos | `{ alasan }` |

Pilihan nasabah di layar kasir diambil dari setoran kolektor itu hari itu
(`GET /transaksi?kolektorId=&tanggal=`), hanya yang jenisnya angsuran atau
pelunasan dan belum punya catatan transfer.

## Service / logika nantinya

- **Mencatat** (kasir/bos): transaksi harus milik kantor, tanggalnya hari ini
  (kalender kantor), dan hari kolektor itu **belum diterima kasnya**
  (`KAS_SUDAH_DITERIMA`). Batas nominal dijaga trigger
  (`TRANSFER_MELEBIHI_SETORAN`).
- **Membatalkan** (bos): hanya selama kas hari itu belum diterima; dicatat
  dengan alasan.
- **Transaksi dibatalkan** → transfer yang menempel padanya **ikut dibatalkan**
  di transaksi database yang sama (alasan: "transaksi dibatalkan").
- **Total transfer** kolektor per hari =
  `Σ nominal` transfer berlaku yang transaksinya berlaku, untuk
  `transaksi.pencatat_id = kolektor` dan `transaksi.tanggal = hari itu`.
  Dipakai di rumus tunai seharusnya (`hari_kolektor`) dan akun bank buku kas.
- Setiap pencatatan & pembatalan terlihat di layar aktivitas bos.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Buat tabel, constraint, trigger batas, dan trigger hanya-bertambah.
2. Data lama: `hari_kolektor.transfer` adalah total tanpa rincian nasabah,
   jadi **tidak bisa dipecah** ke baris per transaksi. Diputuskan di audit
   `hari_kolektor`: totalnya disimpan di kolom arsip
   `hari_kolektor.transfer_lama` (tak pernah ditulis lagi); total transfer =
   `coalesce(transfer_lama, 0) + Σ transfer_setoran`.
3. "Kas sudah diterima" kini = ada `serah_terima_kas` berlaku untuk hari
   kolektor itu ([schema-serah-terima-kas.md](schema-serah-terima-kas.md)).
