# `wilayah` — kampung/daerah tagih

**Status:** final (22 Okt 2026).

## Ringkasan

Satu baris = satu kampung (atau dusun, perumahan, pasar) di satu kantor,
dengan satu **nama baku**. Ini satu-satunya tempat nama kampung tersimpan:
nasabah merujuknya lewat `nasabah.wilayah_id`, rute kolektor lewat baris
`rute_wilayah`. Di aplikasi labelnya "Kampung".

- **Ganti nama** (termasuk membetulkan ejaan) = satu baris di sini.
- **Gabung** (salah ketik "Pelaukn" → "Pelaukan") = pindahkan `wilayah_id`
  nasabah & rute, lalu hapus baris lama.
- **Kampung baru** dibuat otomatis saat formulir nasabah menyebut kampung yang
  belum ada — oleh siapa pun yang mengisi formulir itu, termasuk kolektor.

## Kolom

| Kolom | Tipe | Kosong? | Bawaan | Penjelasan |
|---|---|---|---|---|
| `id` | `uuid` | — | `gen_random_uuid()` | Kunci utama. |
| `kantor_id` | `uuid` | — | | Kantor pemilik. |
| `nama` | `varchar(50)` | — | | Nama baku, mis. "Pelaukan". Spasi dirapikan, tidak kosong. |
| `kunci` | `text`, turunan | — | | `lower(btrim(regexp_replace(nama, '\s+', ' ', 'g')))` — pembanding "kampung yang sama". **Wajib kembar** dengan `kunciWilayah` di API dan aplikasi. |
| `dibuat_oleh` | `uuid` | — | | Orang yang memperkenalkan kampung ini (lewat formulir nasabah). |
| `dibuat_at` | `timestamptz` | — | `now()` | |
| `diubah_at` | `timestamptz` | — | `now()` | Berubah saat nama diganti. |

## Aturan database

| Nama | Jenis | Isi |
|---|---|---|
| `wilayah_pkey` | PK | `(id)` |
| `wilayah_kantor_fk` | FK | `kantor_id` → `kantor(id)` |
| `wilayah_dibuat_oleh_fk` | FK | `(dibuat_oleh, kantor_id)` → `pengguna(id, kantor_id)` — pembuatnya orang kantor itu. |
| `uniq_wilayah_kantor_kunci` | UNIQUE | `(kantor_id, kunci)` — satu kampung satu baris per kantor; jalur cari kampung yang diketik, urutan daftar, dan sasaran `ON CONFLICT`. |
| `uniq_wilayah_id_kantor` | UNIQUE | `(id, kantor_id)` — sasaran FK gabungan dari `nasabah` & `rute_wilayah`; wilayah kantor lain tak bisa dirujuk. |
| `wilayah_nama_check` | CHECK | `nama <> '' AND nama = btrim(regexp_replace(nama, '\s+', ' ', 'g'))` |

Jumlah nasabah per wilayah dibaca lewat index `nasabah(wilayah_id)` (tabel
`nasabah`); rute yang memuatnya lewat index `rute_wilayah(wilayah_id)`.

## Perubahan dari skema sekarang

| Sekarang | Nanti | Alasan |
|---|---|---|
| `boss_id` | `kantor_id` | Konvensi #2. |
| `nama text` | `nama varchar(50)` | Sama dengan batas formulir (3–50 huruf). |
| — | `dibuat_oleh` | Tahu dari HP siapa kampung salah ketik muncul. |
| UNIQUE `(boss_id, kunci)`, `(id, boss_id)` | `(kantor_id, kunci)`, `(id, kantor_id)` | Ganti nama kolom; nama constraint mengikuti konvensi #8. |
| `created_at`, `updated_at` | `dibuat_at`, `diubah_at` | Konvensi #5. |

## Keputusan & timbangan

- **Nama tabel tetap `wilayah`**, label aplikasi "Kampung": isinya tak selalu
  kampung (dusun, perumahan, pasar), dan istilah "wilayah" sudah dipakai di
  rute & laporan.
- **Kampung kosong dihapus bos, tanpa kolom arsip.** Kampung yang tak lagi
  punya nasabah maupun rute (mis. nasabah satu-satunya dipindah) mengotori
  saran formulir. FK menolak penghapusan kampung yang masih dipakai, jadi aman
  tanpa kolom tambahan.
- **Aturan kunci tetap sederhana** (huruf kecil, rapikan spasi). Aturan pintar
  (buang tanda baca, awalan "Kp.", angka Romawi) harus kembar di tiga tempat
  dan bisa menyatukan dua tempat yang sebenarnya berbeda ("Pule 2" ≠
  "Pule II"?). Salah ketik ditangani saran formulir + gabung.

## API nantinya

| Metode & jalur | Peran | Isi |
|---|---|---|
| `GET /wilayah` | semua (kolektor: saran formulir) | `[{ id, nama, kunci, nasabahAktif, nasabahTotal, dipakaiRute, dibuatOleh, dibuatAt }]`, urut nama. `?baru=7` (bos): kampung yang muncul 7 hari terakhir — bahan memeriksa salah ketik. |
| `POST /wilayah/ganti-nama` | bos | `{ dari, ke }` — ganti nama, atau gabung bila `ke` sudah dipakai kampung lain. |
| `DELETE /wilayah/:id` | bos | Hapus kampung kosong. Masih dirujuk nasabah/rute → `WILAYAH_MASIH_DIPAKAI` (409). |

Kampung baru tidak punya endpoint sendiri — dibuat lewat formulir nasabah
(`wilayahId` dipilih atau `alamat` diketik).

## Service / logika nantinya

- **Pastikan wilayah** (formulir akad / salin / perbaikan): `wilayahId` harus
  milik kantor; `alamat` dirapikan lalu dicari lewat kunci, dibuat bila belum
  ada dengan `dibuat_oleh = pengisi formulir`. Di dalam transaksi penulisnya:
  penolakan sesudahnya ikut membatalkan kampung baru itu.
- **Ganti nama / gabung** (bos) — satu transaksi:
  - kunci baris lama (`FOR UPDATE`);
  - nama baru belum dipakai → `UPDATE wilayah SET nama`; nasabah & rute tak
    disentuh;
  - nama baru sudah dipakai → pindahkan `nasabah.wilayah_id` dan baris
    `rute_wilayah` (entri ganda dalam satu rute dipadatkan, posisi paling depan
    yang dipertahankan), lalu hapus baris lama;
  - versi setiap rute yang memuatnya naik (layar Atur Rute yang basi
    ditolak);
  - catat di `riwayat_perubahan` (`ganti_nama_wilayah` / `gabung_wilayah`).
- **Hapus kampung kosong** (bos): `DELETE`; galat FK dipetakan ke
  `WILAYAH_MASIH_DIPAKAI`; dicatat di `riwayat_perubahan`.

## Catatan migrasi (tidak dijalankan di sesi desain)

1. Ganti nama `boss_id` → `kantor_id`, `created_at` → `dibuat_at`,
   `updated_at` → `diubah_at`; ganti nama constraint.
2. `nama` → `varchar(50)` (periksa dulu tak ada nama > 50 huruf).
3. Tambah `dibuat_oleh`; isi baris lama dengan id bos kantor itu; lalu
   NOT NULL + FK gabungan.
4. **Periksa sesudah migrasi:** nama baku hasil pengisian awal diambil dari
   tulisan alamat yang paling sering dipakai, sehingga bisa berhuruf kecil
   (mis. "pule" di DB dev). Bos membetulkannya sekali lewat ganti nama.
