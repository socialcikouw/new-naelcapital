# `transaksi` — buku uang masuk atas pinjaman

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = **satu peristiwa uang** atas satu pinjaman pada satu hari:
angsuran, pelunasan, atau gulung. Tabel ini **hanya bertambah**: nominal yang
sudah tertulis tidak pernah disunting dan barisnya tidak pernah dihapus
(dijaga trigger). Salah input dibetulkan dengan **membatalkan** baris itu
(bos, hari yang sama) lalu mencatat ulang; baris batal tetap terbaca sebagai
jejak dan tidak ikut laporan.

Yang **tidak** ada di sini: libur (`libur_nasabah`), dan cara bayar per
transaksi — transfer dicatat kasir di `transfer_setoran`.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `pencatat_id` | `uuid` | — | | Kolektor yang **mencatat** — fakta sejarah, tak ikut pindah bila nasabah dialihkan. Dasar gaji. |
| `pinjaman_id` | `uuid` | — | | |
| `tanggal` | `date` | — | | Hari pembukuan (kalender kantor) — satu-satunya sumbu waktu laporan. |
| `jenis` | enum `jenis_transaksi` (`angsuran`, `pelunasan`, `gulung`) | — | | |
| `setoran_murni` | `bigint` | — | `0` | Setoran angsuran yang **dibayar** nasabah (bukan yang ditagih). Dasar aturan macet. |
| `setoran_pelunasan` | `bigint` | — | `0` | Bagian yang mengurangi saldo di luar setoran murni — lihat tabel di bawah. |
| `tabungan_keluar` | `bigint` | — | `0` | Tabungan nasabah yang keluar (hanya pelunasan). |
| `storting` | `bigint`, **turunan** | — | | `setoran_murni + setoran_pelunasan − tabungan_keluar`. Bisa negatif pada pelunasan bila tabungan melebihi saldo (kantor mengembalikan selisihnya). |
| `saldo_sesudah` | `bigint` | — | | Saldo pinjaman sesudah baris ini — posisi piutang pada tanggal lampau terbaca dari baris terakhir pada/sebelum tanggal itu. |
| `dibatalkan_at` | `timestamptz` | ya | | |
| `dibatalkan_oleh` | `uuid` | ya | | Bos yang membatalkan. |
| `alasan_batal` | `varchar(100)` | ya | | **Wajib** saat dibatalkan. |
| `dibuat_at` | `timestamptz` | — | `now()` | Tidak ada `diubah_at` — tabel hanya bertambah. |

Isi nominal per jenis (arti kolom tidak berubah dari skema lama — gaji
kolektor bergantung padanya):

| Jenis | `setoran_murni` | `setoran_pelunasan` | `tabungan_keluar` | `saldo_sesudah` |
|---|---|---|---|---|
| `angsuran` | angsuran dibayar | uang lebih untuk melunasi sebagian | 0 | > 0 |
| `pelunasan` | bagian saldo dibayar nasabah | bagian saldo ditutup tabungan | seluruh tabungan | 0 |
| `gulung` | 0 | sisa saldo ditutup pinjaman penerus | 0 | 0 |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `transaksi_pkey` | PK | `(id)` |
| `transaksi_pencatat_fk` | FK | `(pencatat_id, kantor_id)` → `pengguna(id, kolektor_kantor_id)` — pencatat pasti kolektor kantor itu. |
| `transaksi_pinjaman_fk` | FK | `(pinjaman_id, kantor_id)` → `pinjaman(id, kantor_id)` |
| `transaksi_dibatalkan_oleh_fk` | FK | `(dibatalkan_oleh, kantor_id)` → `pengguna(id, kantor_id)` |
| `uniq_transaksi_id_kantor` | UNIQUE | `(id, kantor_id)` — sasaran FK dari `transfer_setoran`. |
| `uniq_transaksi_pinjaman_tanggal` | UNIQUE parsial | `(pinjaman_id, tanggal) WHERE dibatalkan_at IS NULL` — satu transaksi berlaku per pinjaman per hari (penahan dobel-kirim); jalur jendela macet & Buku nasabah. |
| `idx_transaksi_pencatat_tanggal` | INDEX | `(pencatat_id, tanggal) INCLUDE (setoran_murni, setoran_pelunasan, tabungan_keluar, storting, dibatalkan_at)` |
| `idx_transaksi_kantor_tanggal` | INDEX | `(kantor_id, tanggal) INCLUDE (pencatat_id, setoran_murni, setoran_pelunasan, tabungan_keluar, storting, dibatalkan_at)` |
| `idx_transaksi_tabungan_keluar` | INDEX parsial | `(kantor_id, pencatat_id) WHERE tabungan_keluar > 0 AND dibatalkan_at IS NULL` — tabungan keluar sepanjang masa di portofolio. |
| `transaksi_nominal_check` | CHECK | semua nominal & `saldo_sesudah` ≥ 0; `setoran_murni + setoran_pelunasan > 0` |
| `transaksi_jenis_check` | CHECK | sesuai tabel isi per jenis di atas |
| `transaksi_batal_check` | CHECK | `dibatalkan_at`, `dibatalkan_oleh`, `alasan_batal` terisi bersamaan atau kosong bersamaan |
| `transaksi_append_only` | TRIGGER | UPDATE hanya boleh menandai batal (tanpa mengubah kolom lain); DELETE ditolak, kecuali skrip data uji yang membuka `nael.hapus_data_uji` di transaksinya sendiri. |
| `transaksi_terkunci` | TRIGGER (BEFORE UPDATE OF dibatalkan_at) | Saat transaksi **ditandai batal**: tolak bila hari kolektor pencatatnya (`pencatat_id`, `tanggal`) sudah punya `serah_terima_kas` berlaku (`KAS_SUDAH_DITERIMA`, aturan-usaha I4). Jaring pengaman; service memeriksanya lebih dulu. *(Ditambahkan saat pembangunan, 24 Okt 2026.)* |
| `transaksi_bentrok_libur` | TRIGGER (BEFORE INSERT) | Tolak bila pinjaman itu sudah ditandai libur di tanggal yang sama — pasangan `libur_nasabah_bentrok` ([schema-libur-nasabah.md](schema-libur-nasabah.md)). |

### Kenapa `INCLUDE`

Hampir semua laporan (ringkasan harian, gaji, storting per kolektor, neraca
nasabah) menyaring `dibatalkan_at IS NULL` lalu menjumlahkan nominal. Dengan
nominal ikut tersimpan di index, laporan dijawab **langsung dari index**
(*index-only scan*) tanpa membaca tabel — sangat efektif untuk tabel yang hanya
bertambah (halaman cepat ditandai "terlihat semua" oleh autovacuum). Biaya:
±40 byte per baris per index.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` | `kantor_id` | Konvensi #2. |
| `collector_id` | `pencatat_id` | Konvensi #4. |
| `murni` | `setoran_murni` | Isinya uang yang dibayar (setoran), bukan yang ditagih. |
| `pelunasan` (kolom) | `setoran_pelunasan` | Tak lagi bernama sama dengan jenis `pelunasan`; berpasangan dengan `setoran_murni`. |
| `tab_keluar` | `tabungan_keluar` | Berpasangan dengan `pinjaman.tabungan_masuk` & `nasabah.saldo_tabungan`. |
| `alasan_batal` boleh kosong | wajib saat batal | Sama dengan tabel uang lain; pembatalan adalah satu-satunya koreksi uang. |
| FK `dibatalkan_oleh` → `users(id)` | FK gabungan | Pembatal pasti orang kantor itu. |
| — | `UNIQUE (id, kantor_id)` | Sasaran FK `transfer_setoran`. |
| index `(collector_id, tanggal)`, `(boss_id, tanggal)` | sama, + `INCLUDE` nominal | Laporan dari index saja. |
| `created_at` | `dibuat_at` | Konvensi #5. |

## Keputusan & timbangan

- **Nilai jenis tetap `angsuran`, `pelunasan`, `gulung`.** "Pembayaran"
  mencakup ketiganya sehingga tak membedakan; "gulung" adalah bahasa lapangan
  dan dipakai di `pinjaman.asal`, `pinjaman.status` (`digulung`),
  `jenis_gulung`, saklar `kebijakan`, endpoint, dan tombol aplikasi.
- **`storting` tetap** sebagai istilah lapangan.
- **Tidak dipartisi.** Dengan index `INCLUDE`, satu tabel tetap cepat
  bertahun-tahun; partisi baru dipertimbangkan bila tabel melewati ±20 juta
  baris (FK dari `transfer_setoran` lalu harus menyertakan kunci partisi).

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `POST /transaksi/bayar` | kolektor | `{ pinjamanId, setoranMurni, setoranPelunasan }` — angsuran. Kunci idempoten. |
| `POST /transaksi/lunas` | kolektor | `{ pinjamanId }` — nominal dihitung server (tabungan menutup saldo lebih dulu). |
| `POST /transaksi/gulung` | kolektor | `{ pinjamanId, pokok, tenor?, fotoSerahTerimaId }` |
| `POST /transaksi/:id/batal` | bos | `{ alasan }` — hanya hari dicatatnya. |
| `GET /transaksi` | bos, pengawas, kasir | Setoran berlaku satu hari per kolektor beserta transfernya (`?kolektorId=&tanggal=`) — pilihan transfer kasir. |
| `GET /transaksi/:id` | bos, pengawas; kolektor: pinjaman pegangannya | Satu transaksi lengkap, termasuk yang dibatalkan (`dibatalkan: { at, oleh, alasan }`) dan pencatatnya. |
| `GET /transaksi/peristiwa` | bos, pengawas: semua; kolektor: pinjaman pegangannya | Transaksi **berlaku** + libur nasabah dalam satu bentuk (`kategori` = `angsuran` · `pelunasan` · `gulung` · `libur`; libur bernominal nol, `saldoSesudah` kosong), urut tanggal lalu waktu catat. Saringan: `pinjamanId`, `kolektorId` (pemegang), `jenis` (jenis pinjaman), `tanggal` atau `tanggalMulai`+`tanggalSelesai`. Tanpa `pinjamanId` wajib bertanggal, rentang paling panjang 62 hari (`RENTANG_TIDAK_SAH`). |
| `GET /transaksi/rekap-bulanan` | sama | Isi grid kartu satu bulan: `?bulan=YYYY-MM&kolektorId=` → `[{ pinjamanId, tanggal, kategori }]` untuk pinjaman yang dipegang (pemegang saat ini). |
| `GET /nasabah/:id/buku` | bos, pengawas; kolektor: pegangannya | Buku nasabah: `{ nasabah, pinjaman, peristiwa }` — identitas (bentuk `GET /nasabah`), semua pinjaman termasuk yang batal urut `pinjamanKe` (bentuk kartu `GET /pinjaman`), dan semua peristiwa berlaku pinjaman-pinjaman itu urut tanggal. |

"Pegangan" = `nasabah.kolektor_id` saat ini, bukan pencatat transaksinya —
riwayat ikut pindah bersama nasabah saat pemegang diganti (sama dengan
`GET /pinjaman` dan `GET /nasabah`).

Field API lama (`murni`, `pelunasan`, `tabKeluar`, `collectorId`)
dipertahankan sampai aplikasi beralih.

## Service / logika nantinya

- **Gerbang lapangan** (bayar, lunas, gulung): jam kerja & hari kerja kantor,
  bukan libur kantor, kolektor sudah absen masuk kerja, laporan kas hari itu
  belum dibuka / kas belum diterima.
- **Satu transaksi**: kunci pinjaman (`FOR UPDATE`) → satu peristiwa per
  pinjaman per hari (transaksi atau libur) → tulis baris `transaksi` → ubah
  `pinjaman.saldo` (& status) → ubah `nasabah.saldo_tabungan` bila ada
  tabungan keluar/masuk.
- **Aturan nominal angsuran**: harian minimal & kelipatan Rp 5.000; mingguan
  minimal Rp 5.000 kelipatan Rp 1.000; tempoan tidak bisa dicicil. Setoran
  yang menghabiskan saldo wajib lewat **lunas**.
- **Pelunasan**: `setoran_pelunasan = min(tabungan, saldo)`,
  `setoran_murni = saldo − setoran_pelunasan`, seluruh tabungan keluar.
- **Gulung**: lihat [schema-pinjaman.md](schema-pinjaman.md).
- **Batal** (bos, hari yang sama): angsuran → saldo dikembalikan; pelunasan →
  pinjaman dibuka lagi & tabungan dikembalikan; gulung → penerus dibatalkan
  lebih dulu (bila belum bertransaksi), lalu asal dibuka lagi. Ditolak bila
  pinjaman sudah berubah sesudahnya.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama kolom: `boss_id` → `kantor_id`, `collector_id` → `pencatat_id`,
   `murni` → `setoran_murni`, `pelunasan` → `setoran_pelunasan`,
   `tab_keluar` → `tabungan_keluar`, `created_at` → `dibuat_at`. Kolom turunan
   `storting` dibuat ulang dengan rumus nama baru.
2. Trigger `transaksi_append_only` & fungsi pembandingnya ikut disesuaikan
   (nama kolom penanda batal tetap).
3. Baris batal lama tanpa alasan: isi `alasan_batal = 'tanpa alasan (data lama)'`,
   lalu pasang CHECK baru.
4. Ganti FK `dibatalkan_oleh` menjadi gabungan; tambah `UNIQUE (id, kantor_id)`.
5. Buat ulang dua index utama dengan `INCLUDE` (`CONCURRENTLY` di produksi),
   lalu hapus yang lama.
