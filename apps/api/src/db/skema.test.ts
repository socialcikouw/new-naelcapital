import { describe, expect, test } from "bun:test";
import postgres from "postgres";
import { pastikanDatabasePengembangan } from "./penjaga";

/**
 * UJI SKEMA — database sendiri yang menolak data salah (CHECK, FK, UNIQUE,
 * trigger), bukan hanya service. Semua berjalan di SATU transaksi yang
 * dibatalkan di akhir: database pengembangan tidak berubah.
 *
 * Butuh `DATABASE_URL` Supabase pengembangan (`apps/api/.env`); tanpa itu
 * dilewati.
 */
const url = process.env.DATABASE_URL;

class Batalkan extends Error {}

type Tx = postgres.TransactionSql;

/** Pernyataan harus ditolak database dengan nama constraint itu. */
async function tolak(tx: Tx, constraint: string, jalankan: (sp: Tx) => Promise<unknown>) {
  let galat: unknown;
  try {
    await tx.savepoint((sp) => jalankan(sp as unknown as Tx));
  } catch (e) {
    galat = e;
  }
  expect(galat, `harus ditolak ${constraint}`).toBeInstanceOf(postgres.PostgresError);
  expect((galat as postgres.PostgresError).constraint_name).toBe(constraint);
}

describe.skipIf(!url)("skema database", () => {
  test("kantor, pengguna, pekan_kerja, tarif_gaji, perangkat menolak data salah", async () => {
    pastikanDatabasePengembangan(url);
    const sql = postgres(url as string, { prepare: false, max: 1, onnotice: () => {} });
    try {
      await sql
        .begin(async (tx) => {
          // ---- kantor ------------------------------------------------------
          const [k] =
            await tx`insert into kantor (nama) values ('Uji A') returning id, jam_buka, jam_tutup`;
          const [k2] = await tx`insert into kantor (nama) values ('Uji B') returning id`;
          expect(k?.jam_buka).toBe("07:00:00");
          expect(k?.jam_tutup).toBe("24:00:00");
          await tolak(
            tx,
            "kantor_jam_check",
            (sp) =>
              sp`insert into kantor (nama, jam_buka, jam_tutup) values ('x', '18:00', '07:00')`,
          );

          // ---- pengguna ----------------------------------------------------
          const [bos] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k?.id}, 'bos', 'Bos A', '+6281234567890', 'hash') returning id`;
          const [bos2] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k2?.id}, 'bos', 'Bos B', '+6281111111111', 'hash') returning id`;
          const [kol] = await tx`
            insert into pengguna (kantor_id, peran, nama, resort)
            values (${k?.id}, 'kolektor', 'Andi', 'Resort 1') returning id, kolektor_kantor_id`;
          const [kasir] = await tx`
            insert into pengguna (kantor_id, peran, nama) values (${k?.id}, 'kasir', 'Sari')
            returning kolektor_kantor_id`;
          expect(kol?.kolektor_kantor_id).toBe(k?.id);
          expect(kasir?.kolektor_kantor_id).toBeNull();

          await tolak(
            tx,
            "pengguna_peran_check",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, nomor_hp) values (${k2?.id}, 'bos', 'x', '+6280000000')`,
          );
          await tolak(
            tx,
            "pengguna_peran_check",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, hash_sandi) values (${k?.id}, 'kolektor', 'x', 'hash')`,
          );
          await tolak(
            tx,
            "pengguna_resort_check",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, resort) values (${k?.id}, 'kasir', 'x', 'R')`,
          );
          await tolak(
            tx,
            "pengguna_nomor_hp_check",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, nomor_hp) values (${k?.id}, 'kasir', 'x', '081234567890')`,
          );
          await tolak(
            tx,
            "uniq_pengguna_bos_kantor",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
               values (${k?.id}, 'bos', 'Bos kedua', '+6289999999999', 'hash')`,
          );
          // Kantor ketiga (belum punya bos) — yang diuji hanya nomor HP kembar.
          const [k3] = await tx`insert into kantor (nama) values ('Uji C') returning id`;
          await tolak(
            tx,
            "uniq_pengguna_nomor_hp_bos",
            (sp) =>
              sp`insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
               values (${k3?.id}, 'bos', 'x', '+6281234567890', 'hash')`,
          );
          await tolak(
            tx,
            "pengguna_nonaktif_check",
            (sp) => sp`update pengguna set dinonaktifkan_at = now() where id = ${kol?.id}`,
          );
          // Penonaktif harus orang kantor yang sama.
          await tolak(
            tx,
            "pengguna_dinonaktifkan_oleh_fk",
            (sp) =>
              sp`update pengguna set dinonaktifkan_at = now(), dinonaktifkan_oleh = ${bos2?.id},
                 alasan_nonaktif = 'x' where id = ${kol?.id}`,
          );

          // `diubah_at` disentuh database, bukan kode aplikasi.
          await tx`update pengguna set diubah_at = '2000-01-01' where id = ${kol?.id}`;
          const [ubah] = await tx`select extract(year from diubah_at)::int as tahun
                                  from pengguna where id = ${kol?.id}`;
          expect(ubah?.tahun).toBeGreaterThan(2000);

          // ---- pekan_kerja -------------------------------------------------
          const [hari] = await tx`select kantor_hari_ini(${k?.id}) as h`;
          const hariIni = hari?.h as Date;
          await tx`insert into pekan_kerja (kantor_id, berlaku_mulai, hari_kerja, dibuat_oleh)
                   values (${k?.id}, ${hariIni}, 126, ${bos?.id})`;
          await tolak(
            tx,
            "pekan_kerja_tidak_mundur",
            (sp) =>
              sp`insert into pekan_kerja (kantor_id, berlaku_mulai, hari_kerja, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date - 1, 126, ${bos?.id})`,
          );
          await tolak(
            tx,
            "pekan_kerja_hari_check",
            (sp) =>
              sp`insert into pekan_kerja (kantor_id, berlaku_mulai, hari_kerja, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date + 1, 0, ${bos?.id})`,
          );
          await tolak(
            tx,
            "pekan_kerja_dibuat_oleh_fk",
            (sp) =>
              sp`insert into pekan_kerja (kantor_id, berlaku_mulai, hari_kerja, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date + 2, 62, ${bos2?.id})`,
          );

          // Migrasi data lama boleh mengisi masa lalu; sesudah itu terkunci.
          await tx.savepoint(async (sp) => {
            await sp`select set_config('nael.migrasi_data', 'ya', true)`;
            await sp`insert into pekan_kerja (kantor_id, berlaku_mulai, hari_kerja, dibuat_oleh)
                     values (${k?.id}, '2020-01-01', 126, ${bos?.id})`;
            await sp`select set_config('nael.migrasi_data', '', true)`;
          });
          await tolak(
            tx,
            "pekan_kerja_tidak_mundur",
            (sp) =>
              sp`update pekan_kerja set hari_kerja = 62 where kantor_id = ${k?.id} and berlaku_mulai = '2020-01-01'`,
          );
          await tolak(
            tx,
            "pekan_kerja_tidak_mundur",
            (sp) =>
              sp`delete from pekan_kerja where kantor_id = ${k?.id} and berlaku_mulai = '2020-01-01'`,
          );
          // Pola hari ini masih boleh ditimpa (salah ketik sebelum berlaku penuh).
          await tx`update pekan_kerja set hari_kerja = 62 where kantor_id = ${k?.id} and berlaku_mulai = ${hariIni}`;

          // ---- tarif_gaji --------------------------------------------------
          await tx`insert into tarif_gaji (kantor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
                   values (${k?.id}, 500, ${hariIni}, ${bos?.id})`;
          await tolak(
            tx,
            "uniq_tarif_gaji_kantor",
            (sp) =>
              sp`insert into tarif_gaji (kantor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
               values (${k?.id}, 600, ${hariIni}, ${bos?.id})`,
          );
          await tolak(
            tx,
            "tarif_gaji_tarif_check",
            (sp) =>
              sp`insert into tarif_gaji (kantor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
               values (${k?.id}, null, ${hariIni}::date + 1, ${bos?.id})`,
          );
          await tolak(
            tx,
            "tarif_gaji_tarif_check",
            (sp) =>
              sp`insert into tarif_gaji (kantor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
               values (${k?.id}, 10001, ${hariIni}::date + 1, ${bos?.id})`,
          );
          await tolak(
            tx,
            "tarif_gaji_tidak_mundur",
            (sp) =>
              sp`insert into tarif_gaji (kantor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
               values (${k?.id}, 500, ${hariIni}::date - 1, ${bos?.id})`,
          );
          // Tarif khusus kolektor: kosong = kembali ikut tarif kantor.
          await tx`insert into tarif_gaji (kantor_id, kolektor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
                   values (${k?.id}, ${kol?.id}, null, ${hariIni}::date + 7, ${bos?.id})`;
          // Sasaran tarif khusus harus KOLEKTOR kantor itu (bukan bos/kasir).
          await tolak(
            tx,
            "tarif_gaji_kolektor_fk",
            (sp) =>
              sp`insert into tarif_gaji (kantor_id, kolektor_id, tarif_bp, berlaku_mulai, dibuat_oleh)
               values (${k?.id}, ${bos?.id}, 600, ${hariIni}::date + 7, ${bos?.id})`,
          );

          // ---- perangkat ---------------------------------------------------
          const [dev] = await tx`
            insert into perangkat (pengguna_id, kantor_id, kedaluwarsa_at)
            values (${bos?.id}, ${k?.id}, now() + interval '90 days') returning id`;
          await tolak(
            tx,
            "perangkat_pengguna_fk",
            (sp) =>
              sp`insert into perangkat (pengguna_id, kantor_id, kedaluwarsa_at)
               values (${bos?.id}, ${k2?.id}, now())`,
          );
          // Putus selalu beralasan; pelaku wajib untuk alasan orang, kosong untuk sistem.
          await tolak(
            tx,
            "perangkat_putus_check",
            (sp) => sp`update perangkat set diputus_at = now() where id = ${dev?.id}`,
          );
          await tolak(
            tx,
            "perangkat_putus_check",
            (sp) =>
              sp`update perangkat set diputus_at = now(), alasan_putus = 'diputus' where id = ${dev?.id}`,
          );
          await tolak(
            tx,
            "perangkat_putus_check",
            (sp) =>
              sp`update perangkat set diputus_at = now(), alasan_putus = 'kedaluwarsa', diputus_oleh = ${bos?.id}
               where id = ${dev?.id}`,
          );
          await tx`update perangkat set diputus_at = now(), alasan_putus = 'pakai_ulang' where id = ${dev?.id}`;

          // ---- tautan ------------------------------------------------------
          const [tt] = await tx`
            insert into tautan (kode, hash_klaim, kedaluwarsa_at)
            values ('K7QM28XD', ${"a".repeat(64)}, now() + interval '2 minutes') returning id`;
          await tolak(
            tx,
            "uniq_tautan_kode",
            (sp) =>
              sp`insert into tautan (kode, hash_klaim, kedaluwarsa_at) values ('K7QM28XD', 'x', now())`,
          );
          // Persetujuan: keempat kolom bersamaan; dipakai hanya sesudah disetujui.
          await tolak(
            tx,
            "tautan_setuju_check",
            (sp) => sp`update tautan set disetujui_at = now() where id = ${tt?.id}`,
          );
          await tolak(
            tx,
            "tautan_pakai_check",
            (sp) => sp`update tautan set perangkat_id = ${dev?.id} where id = ${tt?.id}`,
          );
          await tolak(
            tx,
            "tautan_pengguna_fk",
            (sp) =>
              sp`update tautan set kantor_id = ${k2?.id}, pengguna_id = ${kol?.id}, disetujui_at = now(),
                 disetujui_oleh = ${bos2?.id} where id = ${tt?.id}`,
          );

          // ---- riwayat_perubahan -------------------------------------------
          const [jejak] = await tx`
            insert into riwayat_perubahan (kantor_id, tabel, baris_id, aksi, sesudah, pelaku_id)
            values (${k?.id}, 'pengguna', ${kol?.id}, 'buat_pengguna', '{"nama":"Andi"}', ${bos?.id}) returning id`;
          await tolak(
            tx,
            "riwayat_perubahan_append_only",
            (sp) => sp`update riwayat_perubahan set aksi = 'lain' where id = ${jejak?.id}`,
          );
          await tolak(
            tx,
            "riwayat_perubahan_append_only",
            (sp) => sp`delete from riwayat_perubahan where id = ${jejak?.id}`,
          );
          await tolak(
            tx,
            "riwayat_perubahan_aksi_check",
            (sp) =>
              sp`insert into riwayat_perubahan (kantor_id, tabel, baris_id, aksi, sesudah, pelaku_id)
               values (${k?.id}, 'pengguna', ${kol?.id}, 'Aksi Salah', '{}', ${bos?.id})`,
          );
          await tolak(
            tx,
            "riwayat_perubahan_isi_check",
            (sp) =>
              sp`insert into riwayat_perubahan (kantor_id, tabel, baris_id, aksi, pelaku_id)
               values (${k?.id}, 'pengguna', ${kol?.id}, 'kosong', ${bos?.id})`,
          );
          await tolak(
            tx,
            "riwayat_perubahan_pelaku_fk",
            (sp) =>
              sp`insert into riwayat_perubahan (kantor_id, tabel, baris_id, aksi, sesudah, pelaku_id)
               values (${k?.id}, 'pengguna', ${kol?.id}, 'x', '{}', ${bos2?.id})`,
          );
          // Skrip data uji boleh menghapus jejak, hanya di transaksinya sendiri.
          await tx.savepoint(async (sp) => {
            await sp`select set_config('nael.hapus_data_uji', 'ya', true)`;
            await sp`delete from riwayat_perubahan where id = ${jejak?.id}`;
            await sp`select set_config('nael.hapus_data_uji', '', true)`;
          });

          throw new Batalkan();
        })
        .catch((e) => {
          if (!(e instanceof Batalkan)) throw e;
        });
    } finally {
      await sql.end();
    }
  }, 30_000);

  test("wilayah, foto, nasabah menolak data salah", async () => {
    pastikanDatabasePengembangan(url);
    const sql = postgres(url as string, { prepare: false, max: 1, onnotice: () => {} });
    const sha = (c: string) => c.repeat(64);
    try {
      await sql
        .begin(async (tx) => {
          const [k] = await tx`insert into kantor (nama) values ('Uji A') returning id`;
          const [k2] = await tx`insert into kantor (nama) values ('Uji B') returning id`;
          const [bos] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k?.id}, 'bos', 'Bos A', '+6281234567890', 'hash') returning id`;
          const [bos2] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k2?.id}, 'bos', 'Bos B', '+6281111111111', 'hash') returning id`;
          const [kol] = await tx`
            insert into pengguna (kantor_id, peran, nama) values (${k?.id}, 'kolektor', 'Andi') returning id`;

          // ---- wilayah -----------------------------------------------------
          const [w] = await tx`
            insert into wilayah (kantor_id, nama, dibuat_oleh)
            values (${k?.id}, 'Pule Barat', ${kol?.id}) returning id, kunci`;
          expect(w?.kunci).toBe("pule barat");
          await tolak(
            tx,
            "uniq_wilayah_kantor_kunci",
            (sp) =>
              sp`insert into wilayah (kantor_id, nama, dibuat_oleh) values (${k?.id}, 'PULE BARAT', ${bos?.id})`,
          );
          for (const nama of ["", " Pule", "Pule  Barat"]) {
            await tolak(
              tx,
              "wilayah_nama_check",
              (sp) =>
                sp`insert into wilayah (kantor_id, nama, dibuat_oleh) values (${k?.id}, ${nama}, ${bos?.id})`,
            );
          }
          // Kantor lain boleh punya kampung bernama sama.
          const [w2] = await tx`
            insert into wilayah (kantor_id, nama, dibuat_oleh)
            values (${k2?.id}, 'Pule Barat', ${bos2?.id}) returning id`;
          await tolak(
            tx,
            "wilayah_dibuat_oleh_fk",
            (sp) =>
              sp`insert into wilayah (kantor_id, nama, dibuat_oleh) values (${k?.id}, 'Pasar', ${bos2?.id})`,
          );

          // ---- foto --------------------------------------------------------
          const fotoBaru = (
            sp: Tx,
            kantor: unknown,
            oleh: unknown,
            isi: Record<string, unknown> = {},
          ) =>
            sp`insert into foto ${sp({
              kantor_id: kantor,
              jenis: "ktp",
              kunci_berkas: "kantor/uji/foto/1.webp",
              sha256: sha("a"),
              ukuran_byte: 150_000,
              tipe_mime: "image/webp",
              diunggah_oleh: oleh,
              ...isi,
            } as Record<string, postgres.ParameterOrJSON<never>>)} returning id`;
          const [f] = (await fotoBaru(tx, k?.id, kol?.id)) as unknown as postgres.Row[];
          await tolak(tx, "uniq_foto_kantor_sha256", (sp) => fotoBaru(sp, k?.id, bos?.id));
          const [fLain] = (await fotoBaru(tx, k2?.id, bos2?.id)) as unknown as postgres.Row[];
          await tolak(tx, "foto_ukuran_check", (sp) =>
            fotoBaru(sp, k?.id, kol?.id, { sha256: sha("b"), ukuran_byte: 0 }),
          );
          await tolak(tx, "foto_ukuran_check", (sp) =>
            fotoBaru(sp, k?.id, kol?.id, { sha256: sha("b"), ukuran_byte: 2_000_001 }),
          );
          await tolak(tx, "foto_sha256_check", (sp) =>
            fotoBaru(sp, k?.id, kol?.id, { sha256: sha("X") }),
          );
          await tolak(tx, "foto_lokasi_check", (sp) =>
            fotoBaru(sp, k?.id, kol?.id, { sha256: sha("c"), latitude: -7.5, longitude: 110.4 }),
          );
          await tolak(tx, "foto_lokasi_check", (sp) =>
            fotoBaru(sp, k?.id, kol?.id, {
              sha256: sha("c"),
              latitude: 40,
              longitude: 110.4,
              akurasi_meter: 10,
            }),
          );
          await tolak(tx, "foto_diunggah_oleh_fk", (sp) =>
            fotoBaru(sp, k?.id, bos2?.id, { sha256: sha("d") }),
          );

          // ---- nasabah -----------------------------------------------------
          const nasabahBaru = (sp: Tx, isi: Record<string, unknown> = {}) =>
            sp`insert into nasabah ${sp({
              kantor_id: k?.id,
              kolektor_id: kol?.id,
              nama: "Sari",
              wilayah_id: w?.id,
              ...isi,
            } as Record<string, postgres.ParameterOrJSON<never>>)} returning id`;
          const [n] = (await nasabahBaru(tx, {
            nik: "3201010101010001",
            nomor_hp: "+6281299990003",
            latitude: -7.5,
            longitude: 110.4,
            akurasi_meter: 8,
            foto_ktp_id: f?.id,
          })) as unknown as postgres.Row[];
          await tolak(tx, "nasabah_kolektor_fk", (sp) => nasabahBaru(sp, { kolektor_id: bos?.id }));
          await tolak(tx, "nasabah_wilayah_fk", (sp) => nasabahBaru(sp, { wilayah_id: w2?.id }));
          await tolak(tx, "nasabah_foto_ktp_fk", (sp) =>
            nasabahBaru(sp, { foto_ktp_id: fLain?.id }),
          );
          await tolak(tx, "uniq_nasabah_kantor_nik", (sp) =>
            nasabahBaru(sp, { nik: "3201010101010001" }),
          );
          await tolak(tx, "nasabah_nik_check", (sp) => nasabahBaru(sp, { nik: "32010101" }));
          await tolak(tx, "nasabah_nomor_hp_check", (sp) =>
            nasabahBaru(sp, { nomor_hp: "081299990003" }),
          );
          await tolak(tx, "nasabah_saldo_tabungan_check", (sp) =>
            nasabahBaru(sp, { saldo_tabungan: -1 }),
          );
          await tolak(tx, "nasabah_lokasi_check", (sp) => nasabahBaru(sp, { latitude: -7.5 }));
          await tolak(
            tx,
            "nasabah_blokir_check",
            (sp) => sp`update nasabah set diblokir_at = now() where id = ${n?.id}`,
          );
          await tolak(
            tx,
            "nasabah_diblokir_oleh_fk",
            (sp) =>
              sp`update nasabah set diblokir_at = now(), diblokir_oleh = ${bos2?.id}, alasan_blokir = 'x'
               where id = ${n?.id}`,
          );
          // Nama kembar & tanpa NIK boleh (orang berbeda).
          await nasabahBaru(tx);
          await nasabahBaru(tx);

          // Kampung yang masih dipakai nasabah tak bisa dihapus.
          await tolak(
            tx,
            "nasabah_wilayah_fk",
            (sp) => sp`delete from wilayah where id = ${w?.id}`,
          );

          // `diubah_at` disentuh database.
          await tx`update nasabah set diubah_at = '2000-01-01' where id = ${n?.id}`;
          const [ubah] =
            await tx`select extract(year from diubah_at)::int as tahun from nasabah where id = ${n?.id}`;
          expect(ubah?.tahun).toBeGreaterThan(2000);

          throw new Batalkan();
        })
        .catch((e) => {
          if (!(e instanceof Batalkan)) throw e;
        });
    } finally {
      await sql.end();
    }
  }, 30_000);
  test("pinjaman, transaksi, riwayat_status_pinjaman menolak data salah", async () => {
    pastikanDatabasePengembangan(url);
    const sql = postgres(url as string, { prepare: false, max: 1, onnotice: () => {} });
    try {
      await sql
        .begin(async (tx) => {
          const [k] = await tx`insert into kantor (nama) values ('Uji A') returning id`;
          const [bos] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k?.id}, 'bos', 'Bos A', '+6281234567890', 'hash') returning id`;
          const [kol] = await tx`
            insert into pengguna (kantor_id, peran, nama) values (${k?.id}, 'kolektor', 'Andi') returning id`;
          const [w] = await tx`
            insert into wilayah (kantor_id, nama, dibuat_oleh) values (${k?.id}, 'Pule', ${kol?.id}) returning id`;
          const nasabahBaru = async (nama: string) =>
            (
              await tx`insert into nasabah (kantor_id, kolektor_id, nama, wilayah_id)
                       values (${k?.id}, ${kol?.id}, ${nama}, ${w?.id}) returning id`
            )[0]?.id as string;
          let nomorFoto = 0;
          const fotoBaru = async () =>
            (
              await tx`insert into foto (kantor_id, jenis, kunci_berkas, sha256, ukuran_byte, tipe_mime, diunggah_oleh)
                       values (${k?.id}, 'serah_terima', 'f', ${String(++nomorFoto).padStart(64, "0")},
                               1000, 'image/webp', ${kol?.id}) returning id`
            )[0]?.id as string;
          const n1 = await nasabahBaru("Sari");
          const n2 = await nasabahBaru("Budi");

          // Akad harian pokok 1 jt (aturan-usaha A5).
          const akad = (isi: Record<string, unknown>) => ({
            kantor_id: k?.id,
            pencair_id: kol?.id,
            dibuat_oleh: kol?.id,
            nasabah_id: n1,
            pinjaman_ke: 1,
            jenis: "harian",
            tenor: 24,
            asal: "baru",
            tanggal_akad: "2026-10-01",
            pokok: 1_000_000,
            potongan_admin: 50_000,
            tabungan_masuk: 50_000,
            pencairan: 900_000,
            total_kembali: 1_200_000,
            angsuran: 50_000,
            saldo_awal: 1_200_000,
            drop_baru: 1_000_000,
            saldo: 1_200_000,
            ...isi,
          });
          const masuk = (sp: Tx, isi: Record<string, unknown>) =>
            sp`insert into pinjaman ${sp(akad(isi) as Record<string, postgres.ParameterOrJSON<never>>)} returning *`;

          const [p] = (await masuk(tx, {
            foto_serah_terima_id: await fotoBaru(),
          })) as unknown as postgres.Row[];
          expect(p?.droping).toBe("1000000");
          expect(p?.angsuran_ke).toBe(0);
          expect(p?.jatuh_tempo).toBeNull();
          const lahir = await tx`select status_sebelum, status_sesudah, tanggal::text as tanggal
                                 from riwayat_status_pinjaman where pinjaman_id = ${p?.id}`;
          expect([...lahir]).toEqual([
            { status_sebelum: null, status_sesudah: "berjalan", tanggal: "2026-10-01" },
          ]);

          await tolak(tx, "pinjaman_foto_check", (sp) => masuk(sp, { nasabah_id: n2 }));
          const fotoLain = await fotoBaru();
          await tolak(tx, "uniq_pinjaman_aktif_nasabah", (sp) =>
            masuk(sp, { pinjaman_ke: 2, foto_serah_terima_id: fotoLain }),
          );
          await tolak(tx, "uniq_pinjaman_foto", (sp) =>
            masuk(sp, { nasabah_id: n2, foto_serah_terima_id: p?.foto_serah_terima_id }),
          );
          const salah = async (constraint: string, isi: Record<string, unknown>) => {
            const fotoId = await fotoBaru();
            await tolak(tx, constraint, (sp) =>
              masuk(sp, { nasabah_id: n2, foto_serah_terima_id: fotoId, ...isi }),
            );
          };
          await salah("pinjaman_pokok_check", {
            pokok: 1_050_000,
            pencairan: 950_000,
            drop_baru: 1_050_000,
          });
          await salah("pinjaman_tenor_check", { tenor: 20, angsuran: 60_000 });
          await salah("pinjaman_pencairan_check", { pencairan: 950_000 });
          await salah("pinjaman_angsuran_check", { angsuran: 40_000 });
          await salah("pinjaman_saldo_check", { saldo: 1_300_000 });
          await salah("pinjaman_status_check", { status: "lunas", tanggal_selesai: "2026-10-02" });
          await salah("pinjaman_macet_check", { status: "macet" });
          await salah("pinjaman_batal_check", { status: "batal", tanggal_selesai: "2026-10-01" });
          await salah("pinjaman_gulung_check", { asal: "gulung" });
          await salah("pinjaman_disalin_check", { tanggal_disalin: "2026-10-05" });
          await salah("pinjaman_pencair_fk", { pencair_id: bos?.id });
          // Gulung hanya dari pinjaman nasabah yang sama.
          await salah("pinjaman_asal_fk", {
            asal: "gulung",
            jenis_gulung: "tetap",
            pinjaman_asal_id: p?.id,
            saldo_lama: 100_000,
            pencairan: 800_000,
            drop_baru: 0,
            drop_gulung: 1_000_000,
          });

          // Salinan migrasi: tanpa uang keluar & tanpa foto.
          const [m] = (await masuk(tx, {
            nasabah_id: n2,
            asal: "migrasi",
            tanggal_disalin: "2026-10-05",
            potongan_admin: 0,
            pencairan: 0,
            drop_baru: 0,
            saldo_awal: 600_000,
            saldo: 600_000,
          })) as unknown as postgres.Row[];
          expect(m?.angsuran_ke).toBe(12);

          // Tempoan: jatuh tempo = akad + tenor.
          const n3 = await nasabahBaru("Tono");
          const fotoTempo = await fotoBaru();
          const [tp] = (await masuk(tx, {
            nasabah_id: n3,
            jenis: "tempoan",
            tenor: 14,
            potongan_admin: 0,
            tabungan_masuk: 0,
            pencairan: 1_000_000,
            total_kembali: 1_250_000,
            angsuran: 1_250_000,
            saldo_awal: 1_250_000,
            saldo: 1_250_000,
            foto_serah_terima_id: fotoTempo,
          })) as unknown as postgres.Row[];
          expect(new Date(tp?.jatuh_tempo).toISOString().slice(0, 10)).toBe("2026-10-15");

          // ---- transaksi ---------------------------------------------------
          const setor = (sp: Tx, isi: Record<string, unknown>) =>
            sp`insert into transaksi ${sp({
              kantor_id: k?.id,
              pencatat_id: kol?.id,
              pinjaman_id: p?.id,
              tanggal: "2026-10-02",
              jenis: "angsuran",
              setoran_murni: 50_000,
              saldo_sesudah: 1_150_000,
              ...isi,
            } as Record<string, postgres.ParameterOrJSON<never>>)} returning *`;
          const [t] = (await setor(tx, {})) as unknown as postgres.Row[];
          expect(t?.storting).toBe("50000");
          await tolak(tx, "uniq_transaksi_pinjaman_tanggal", (sp) => setor(sp, {}));
          await tolak(tx, "transaksi_pencatat_fk", (sp) =>
            setor(sp, { tanggal: "2026-10-03", pencatat_id: bos?.id }),
          );
          await tolak(tx, "transaksi_nominal_check", (sp) =>
            setor(sp, { tanggal: "2026-10-03", setoran_murni: 0 }),
          );
          await tolak(tx, "transaksi_jenis_check", (sp) =>
            setor(sp, { tanggal: "2026-10-03", tabungan_keluar: 10_000 }),
          );
          await tolak(tx, "transaksi_jenis_check", (sp) =>
            setor(sp, { tanggal: "2026-10-03", jenis: "pelunasan", saldo_sesudah: 100 }),
          );
          // Hanya bertambah: nominal tak bisa disunting, baris tak bisa dihapus.
          await tolak(
            tx,
            "transaksi_append_only",
            (sp) => sp`update transaksi set setoran_murni = 60000 where id = ${t?.id}`,
          );
          await tolak(
            tx,
            "transaksi_append_only",
            (sp) => sp`delete from transaksi where id = ${t?.id}`,
          );
          await tolak(
            tx,
            "transaksi_batal_check",
            (sp) => sp`update transaksi set dibatalkan_at = now() where id = ${t?.id}`,
          );
          await tx`update transaksi set dibatalkan_at = now(), dibatalkan_oleh = ${bos?.id},
                   alasan_batal = 'salah ketik' where id = ${t?.id}`;
          await tolak(
            tx,
            "transaksi_append_only",
            (sp) => sp`update transaksi set alasan_batal = 'lain' where id = ${t?.id}`,
          );
          // Sesudah batal, hari yang sama boleh dicatat ulang.
          await setor(tx, {});
          // Pelunasan bertabungan lebih: storting negatif (aturan-usaha D2).
          const [lunas] = (await setor(tx, {
            pinjaman_id: m?.id,
            jenis: "pelunasan",
            setoran_murni: 0,
            setoran_pelunasan: 600_000,
            tabungan_keluar: 800_000,
            saldo_sesudah: 0,
          })) as unknown as postgres.Row[];
          expect(lunas?.storting).toBe("-200000");

          // ---- riwayat status ----------------------------------------------
          await tx`update pinjaman set status = 'macet', tanggal_macet = '2026-10-20' where id = ${p?.id}`;
          // Pulih tanpa tanggal pembukuan → galat (cadangan "hari ini" pasti meleset).
          await tolak(
            tx,
            "riwayat_status_pinjaman_tanggal",
            (sp) =>
              sp`update pinjaman set status = 'berjalan', tanggal_macet = null where id = ${p?.id}`,
          );
          await tx.savepoint(async (sp) => {
            await sp`select set_config('nael.tanggal_pembukuan', '2026-10-22', true)`;
            await sp`update pinjaman set status = 'berjalan', tanggal_macet = null where id = ${p?.id}`;
            await sp`select set_config('nael.tanggal_pembukuan', '', true)`;
          });
          const jalan = await tx`
            select coalesce(status_sebelum::text, '-') || '>' || status_sesudah || '@' || tanggal as j
            from riwayat_status_pinjaman where pinjaman_id = ${p?.id} order by dibuat_at`;
          expect(jalan.map((r) => r.j)).toEqual([
            "->berjalan@2026-10-01",
            "berjalan>macet@2026-10-20",
            "macet>berjalan@2026-10-22",
          ]);
          const [rs] =
            await tx`select id from riwayat_status_pinjaman where pinjaman_id = ${p?.id} limit 1`;
          await tolak(
            tx,
            "riwayat_status_pinjaman_append_only",
            (sp) =>
              sp`update riwayat_status_pinjaman set tanggal = '2026-01-01' where id = ${rs?.id}`,
          );
          await tolak(
            tx,
            "uniq_riwayat_status_pinjaman_lahir",
            (sp) =>
              sp`insert into riwayat_status_pinjaman (kantor_id, pinjaman_id, status_sesudah, tanggal)
               values (${k?.id}, ${p?.id}, 'berjalan', '2026-10-01')`,
          );
          await tolak(
            tx,
            "riwayat_status_pinjaman_urutan_check",
            (sp) =>
              sp`insert into riwayat_status_pinjaman (kantor_id, pinjaman_id, status_sebelum, status_sesudah, tanggal)
               values (${k?.id}, ${p?.id}, 'macet', 'macet', '2026-10-01')`,
          );

          throw new Batalkan();
        })
        .catch((e) => {
          if (!(e instanceof Batalkan)) throw e;
        });
    } finally {
      await sql.end();
    }
  }, 60_000);
  test("hari_kolektor, libur, kebijakan menolak data salah", async () => {
    pastikanDatabasePengembangan(url);
    const sql = postgres(url as string, { prepare: false, max: 1, onnotice: () => {} });
    try {
      await sql
        .begin(async (tx) => {
          const [k] = await tx`insert into kantor (nama) values ('Uji A') returning id`;
          const [bos] = await tx`
            insert into pengguna (kantor_id, peran, nama, nomor_hp, hash_sandi)
            values (${k?.id}, 'bos', 'Bos A', '+6281234567890', 'hash') returning id`;
          const [kol] = await tx`
            insert into pengguna (kantor_id, peran, nama) values (${k?.id}, 'kolektor', 'Andi') returning id`;
          const [kasir] = await tx`
            insert into pengguna (kantor_id, peran, nama) values (${k?.id}, 'kasir', 'Sari') returning id`;
          const [w] = await tx`
            insert into wilayah (kantor_id, nama, dibuat_oleh) values (${k?.id}, 'Pule', ${kol?.id}) returning id`;
          const [n] = await tx`
            insert into nasabah (kantor_id, kolektor_id, nama, wilayah_id)
            values (${k?.id}, ${kol?.id}, 'Budi', ${w?.id}) returning id`;
          const [p] = await tx`
            insert into pinjaman (kantor_id, pencair_id, dibuat_oleh, nasabah_id, pinjaman_ke, jenis, tenor,
              asal, tanggal_akad, tanggal_disalin, pokok, potongan_admin, tabungan_masuk, pencairan,
              total_kembali, angsuran, saldo_awal, drop_baru, saldo)
            values (${k?.id}, ${kol?.id}, ${bos?.id}, ${n?.id}, 1, 'harian', 24, 'migrasi', '2026-10-01',
              '2026-10-01', 1000000, 0, 50000, 0, 1200000, 50000, 1200000, 0, 1200000) returning id`;
          const [hari] = await tx`select kantor_hari_ini(${k?.id}) as h`;
          const hariIni = hari?.h as Date;

          // ---- hari_kolektor -------------------------------------------------
          await tx`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi, kas_lapangan, uang_jalan)
                   values (${k?.id}, ${kol?.id}, '2026-10-02', 'masuk_kerja', 1000000, 50000)`;
          await tolak(
            tx,
            "uniq_hari_kolektor_kolektor_tanggal",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi)
               values (${k?.id}, ${kol?.id}, '2026-10-02', 'masuk_kerja')`,
          );
          await tolak(
            tx,
            "hari_kolektor_kolektor_fk",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi)
               values (${k?.id}, ${kasir?.id}, '2026-10-02', 'masuk_kerja')`,
          );
          // Tidak kerja: alasan wajib, tanpa uang lapangan & laporan.
          await tolak(
            tx,
            "hari_kolektor_absensi_check",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi)
               values (${k?.id}, ${kol?.id}, '2026-10-03', 'tidak_kerja')`,
          );
          await tolak(
            tx,
            "hari_kolektor_absensi_check",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi, alasan_tidak_kerja, kas_lapangan)
               values (${k?.id}, ${kol?.id}, '2026-10-03', 'tidak_kerja', 'sakit', 100000)`,
          );
          await tolak(
            tx,
            "hari_kolektor_absensi_check",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi, alasan_tidak_kerja)
               values (${k?.id}, ${kol?.id}, '2026-10-03', 'masuk_kerja', 'x')`,
          );
          await tolak(
            tx,
            "hari_kolektor_nominal_check",
            (sp) =>
              sp`insert into hari_kolektor (kantor_id, kolektor_id, tanggal, absensi, uang_jalan)
               values (${k?.id}, ${kol?.id}, '2026-10-03', 'masuk_kerja', -1)`,
          );

          // ---- libur_nasabah ↔ transaksi (satu peristiwa per hari) -----------
          await tx`insert into libur_nasabah (kantor_id, pencatat_id, pinjaman_id, tanggal)
                   values (${k?.id}, ${kol?.id}, ${p?.id}, '2026-10-02')`;
          await tolak(
            tx,
            "uniq_libur_nasabah_pinjaman_tanggal",
            (sp) =>
              sp`insert into libur_nasabah (kantor_id, pencatat_id, pinjaman_id, tanggal)
               values (${k?.id}, ${kol?.id}, ${p?.id}, '2026-10-02')`,
          );
          await tolak(
            tx,
            "transaksi_bentrok_libur",
            (sp) =>
              sp`insert into transaksi (kantor_id, pencatat_id, pinjaman_id, tanggal, jenis, setoran_murni, saldo_sesudah)
               values (${k?.id}, ${kol?.id}, ${p?.id}, '2026-10-02', 'angsuran', 50000, 1150000)`,
          );
          await tx`insert into transaksi (kantor_id, pencatat_id, pinjaman_id, tanggal, jenis, setoran_murni, saldo_sesudah)
                   values (${k?.id}, ${kol?.id}, ${p?.id}, '2026-10-03', 'angsuran', 50000, 1150000)`;
          await tolak(
            tx,
            "libur_nasabah_bentrok",
            (sp) =>
              sp`insert into libur_nasabah (kantor_id, pencatat_id, pinjaman_id, tanggal)
               values (${k?.id}, ${kol?.id}, ${p?.id}, '2026-10-03')`,
          );
          await tolak(
            tx,
            "libur_nasabah_pencatat_fk",
            (sp) =>
              sp`insert into libur_nasabah (kantor_id, pencatat_id, pinjaman_id, tanggal)
               values (${k?.id}, ${bos?.id}, ${p?.id}, '2026-10-04')`,
          );

          // ---- libur_kantor ----------------------------------------------------
          await tx`insert into libur_kantor (kantor_id, tanggal, alasan_libur, dibuat_oleh)
                   values (${k?.id}, ${hariIni}::date + 3, 'Idul Fitri', ${bos?.id})`;
          await tolak(
            tx,
            "libur_kantor_tidak_mundur",
            (sp) =>
              sp`insert into libur_kantor (kantor_id, tanggal, alasan_libur, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date - 1, 'x', ${bos?.id})`,
          );
          await tolak(
            tx,
            "libur_kantor_tidak_mundur",
            (sp) => sp`update libur_kantor set alasan_libur = 'Lebaran' where kantor_id = ${k?.id}`,
          );
          await tolak(
            tx,
            "libur_kantor_alasan_check",
            (sp) =>
              sp`insert into libur_kantor (kantor_id, tanggal, alasan_libur, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date + 4, '  ', ${bos?.id})`,
          );
          await tolak(
            tx,
            "uniq_libur_kantor_kantor_tanggal",
            (sp) =>
              sp`insert into libur_kantor (kantor_id, tanggal, alasan_libur, dibuat_oleh)
               values (${k?.id}, ${hariIni}::date + 3, 'lagi', ${bos?.id})`,
          );
          // Hari ini boleh dideklarasikan, tetapi tak bisa dibatalkan lagi.
          await tx`insert into libur_kantor (kantor_id, tanggal, alasan_libur, dibuat_oleh)
                   values (${k?.id}, ${hariIni}, 'Acara keluarga', ${bos?.id})`;
          await tolak(
            tx,
            "libur_kantor_tidak_mundur",
            (sp) =>
              sp`delete from libur_kantor where kantor_id = ${k?.id} and tanggal = ${hariIni}`,
          );
          // Tanggal yang belum tiba boleh dibatalkan.
          await tx`delete from libur_kantor where kantor_id = ${k?.id} and tanggal = ${hariIni}::date + 3`;

          // ---- kebijakan ---------------------------------------------------------
          await tx`insert into kebijakan (kantor_id, gulung_pinjaman_dikunci, alasan_kunci, diubah_oleh)
                   values (${k?.id}, true, 'Akhir bulan', ${bos?.id})`;
          await tolak(
            tx,
            "uniq_kebijakan_kantor",
            (sp) =>
              sp`insert into kebijakan (kantor_id, naik_pinjaman_dikunci, diubah_oleh) values (${k?.id}, true, ${bos?.id})`,
          );
          await tx`insert into kebijakan (kantor_id, kolektor_id, pinjaman_baru_dikunci, diubah_oleh)
                   values (${k?.id}, ${kol?.id}, true, ${bos?.id})`;
          await tolak(
            tx,
            "kebijakan_kolektor_fk",
            (sp) =>
              sp`insert into kebijakan (kantor_id, kolektor_id, naik_pinjaman_dikunci, diubah_oleh)
               values (${k?.id}, ${kasir?.id}, true, ${bos?.id})`,
          );
          await tolak(
            tx,
            "kebijakan_sasaran_check",
            (sp) =>
              sp`insert into kebijakan (kantor_id, kolektor_id, nasabah_id, naik_pinjaman_dikunci, diubah_oleh)
               values (${k?.id}, ${kol?.id}, ${n?.id}, true, ${bos?.id})`,
          );
          await tolak(
            tx,
            "kebijakan_lapis_nasabah_check",
            (sp) =>
              sp`insert into kebijakan (kantor_id, nasabah_id, pinjaman_baru_dikunci, diubah_oleh)
               values (${k?.id}, ${n?.id}, true, ${bos?.id})`,
          );
          await tolak(
            tx,
            "kebijakan_menyala_check",
            (sp) =>
              sp`insert into kebijakan (kantor_id, nasabah_id, diubah_oleh) values (${k?.id}, ${n?.id}, ${bos?.id})`,
          );
          await tx`insert into kebijakan (kantor_id, nasabah_id, gulung_pinjaman_dikunci, diubah_oleh)
                   values (${k?.id}, ${n?.id}, true, ${bos?.id})`;

          throw new Batalkan();
        })
        .catch((e) => {
          if (!(e instanceof Batalkan)) throw e;
        });
    } finally {
      await sql.end();
    }
  }, 60_000);
});
