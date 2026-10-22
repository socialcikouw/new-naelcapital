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
  test("kantor, pengguna, pekan_kerja menolak data salah", async () => {
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

          throw new Batalkan();
        })
        .catch((e) => {
          if (!(e instanceof Batalkan)) throw e;
        });
    } finally {
      await sql.end();
    }
  }, 30_000);
});
