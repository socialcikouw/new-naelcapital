# `libur_kantor` — tanggal khusus kantor tutup

**Status:** final (22 Okt 2026). Menggantikan nama `hari_libur_kantor`.

## Ringkasan

Satu baris = **satu tanggal kantor libur** di luar pekan kerja rutin (Lebaran,
17 Agustus, acara keluarga). Libur mingguan rutin **tidak** di sini — ia
dibaca dari [`pekan_kerja`](schema-pekan-kerja.md) (bertanggal).

Libur kantor menentukan:

- **hari tagih & aturan macet** — hari libur bukan hari wajib bayar (harian),
  dan tidak dihitung dalam jendela macet;
- **gerbang lapangan** — absen, setoran, akad, gulung, libur nasabah, dan
  serah terima ditolak pada hari libur.

**Libur tidak boleh mengubah sejarah.** Mendeklarasikannya untuk tanggal yang
sudah lewat — atau untuk hari ini sesudah uang bergerak — diam-diam menggeser
tagihan, macet, dan tunggakan hari-hari itu.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `tanggal` | `date` | — | | Tanggal libur (kalender kantor). |
| `alasan_libur` | `varchar(100)` | — | | **Wajib.** "Idul Fitri", "17 Agustus". |
| `dibuat_oleh` | `uuid` | — | | Bos. |
| `dibuat_at` | `timestamptz` | — | `now()` | Tidak ada `diubah_at` — tidak disunting. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `libur_kantor_pkey` | PK | `(id)` |
| `libur_kantor_kantor_fk` | FK | `(kantor_id)` → `kantor(id)` |
| `libur_kantor_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_libur_kantor_kantor_tanggal` | UNIQUE | `(kantor_id, tanggal)` — satu deklarasi per tanggal; jalur "tanggal X libur?" dan "libur dalam rentang ini" (jadwal tagih, kartu, sapuan macet). |
| `libur_kantor_alasan_check` | CHECK | `length(btrim(alasan_libur)) > 0` |
| `libur_kantor_tidak_mundur` | TRIGGER (BEFORE INSERT OR UPDATE OR DELETE) | INSERT bertanggal < hari ini (zona kantor) ditolak; DELETE bertanggal ≤ hari ini ditolak; UPDATE **selalu** ditolak (`LIBUR_KANTOR_TANGGAL_LAMPAU` / `LIBUR_KANTOR_SUDAH_BERJALAN`). Kecuali skrip data uji (`nael.hapus_data_uji`). |

Aturan "hari ini hanya bila belum ada peristiwa" (setoran, akad, libur
nasabah) **tetap di service**: melibatkan banyak tabel, dan service memeriksanya
di transaksi yang sama dengan penyisipan.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| tabel `hari_libur_kantor` | `libur_kantor` | Berpasangan dengan `libur_nasabah`; nama modul kode sudah `libur-kantor`. |
| `boss_id` | `kantor_id` | Konvensi #2. |
| `keterangan` | `alasan_libur` | Isinya sebab — konvensi #6; sama dengan `libur_nasabah`. |
| `created_by` (FK tunggal) | `dibuat_oleh`, FK gabungan | Konvensi #5. |
| `created_at` | `dibuat_at` | Konvensi #5. |
| deklarasi & batal oleh boss/admin | **bos saja** | Tabel hak per peran ([schema-pengguna.md](schema-pengguna.md)). |
| `uniq_libur_kantor_boss_tanggal` | `uniq_libur_kantor_kantor_tanggal` | Ikut nama kolom. |
| aturan tidak mundur hanya di service | + trigger `libur_kantor_tidak_mundur` | Jaring pengaman, pola sama dengan `tarif_gaji`. |

## Keputusan & timbangan

- **Batal = dihapus** (dipertahankan), jejak di `riwayat_perubahan`: prinsip
  *tanda yang bukan uang dihapus*; tanggal yang belum tiba tak memengaruhi
  hitungan apa pun.
- **Tidak disunting**: mengganti alasan = hapus lalu deklarasi ulang (hanya
  untuk tanggal yang belum tiba).
- **Satu baris per tanggal**, bukan rentang (`tanggal_mulai`–`tanggal_selesai`):
  pembaca jadwal cukup "tanggal ada di himpunan libur?"; rentang dipecah saat
  deklarasi.
- **Tanpa impor libur nasional otomatis** untuk sekarang — bos yang memutuskan
  kantor tutup atau tidak.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /libur-kantor?tanggalMulai=&tanggalSelesai=` | semua peran kantor | Kolektor perlu tahu kapan kantor libur. |
| `POST /libur-kantor` | bos | `{ tanggalMulai, tanggalSelesai?, alasan }` — rentang dipecah per tanggal; tanggal yang sudah ada dilewati. |
| `POST /libur-kantor/:tanggal/batal` | bos | `{ alasan }` — hanya tanggal yang belum tiba. |

Field lama `keterangan` diterima sampai aplikasi beralih.

## Service / logika nantinya

1. **Deklarasi** (bos): `tanggalMulai` ≥ hari ini; bila rentang memuat hari
   ini, tolak kalau sudah ada setoran, akad, atau libur nasabah hari ini
   (`LIBUR_KANTOR_HARI_SUDAH_BERJALAN`); sisipkan per tanggal (`ON CONFLICT DO
   NOTHING`) + jejak di `riwayat_perubahan`.
2. **Batal** (bos): tanggal > hari ini; hapus baris + jejak (alasan).
3. Pembaca jadwal memuat himpunan tanggal libur satu kali per permintaan.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. `ALTER TABLE hari_libur_kantor RENAME TO libur_kantor`; ganti nama kolom,
   index, constraint; ganti FK.
2. Pasang CHECK alasan (periksa tak ada keterangan kosong) dan trigger.
