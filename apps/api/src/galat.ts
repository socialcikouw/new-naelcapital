import type { Galat } from "@naelcapital/contracts";
import { GalatAturan } from "@naelcapital/domain";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError } from "zod";

/**
 * Galat yang SENGAJA dijawab ke klien: status HTTP + `kode` stabil + pesan
 * bahasa Indonesia. Layanan melempar ini; `tanganiGalat` menerjemahkannya.
 * Galat lain = bug → 500 tanpa membocorkan isinya.
 */
export class GalatApp extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan);
  }
}

export const tidakSah = (kode: string, pesan: string) => new GalatApp(401, kode, pesan);
export const dilarang = (kode: string, pesan: string) => new GalatApp(403, kode, pesan);
export const bentrok = (kode: string, pesan: string) => new GalatApp(409, kode, pesan);
export const tidakDitemukan = (kode: string, pesan: string) => new GalatApp(404, kode, pesan);
/** Pelanggaran aturan usaha yang diperiksa server (bukan bentuk data). */
export const melanggar = (kode: string, pesan: string) => new GalatApp(422, kode, pesan);

/**
 * Constraint database yang bisa terlanggar oleh permintaan bersamaan atau
 * kirim ganda — jaring pengaman di balik pemeriksaan service. Dijawab sebagai
 * bentrok yang bisa dibaca, bukan 500.
 */
const CONSTRAINT_BENTROK: Record<string, [kode: string, pesan: string]> = {
  uniq_transaksi_pinjaman_tanggal: [
    "PERISTIWA_SUDAH_ADA",
    "Pinjaman ini sudah punya catatan hari ini",
  ],
  uniq_libur_nasabah_pinjaman_tanggal: [
    "PERISTIWA_SUDAH_ADA",
    "Pinjaman ini sudah punya catatan hari ini",
  ],
  transaksi_bentrok_libur: ["PERISTIWA_SUDAH_ADA", "Pinjaman ini ditandai libur hari ini"],
  libur_nasabah_bentrok: ["PERISTIWA_SUDAH_ADA", "Pinjaman ini sudah punya setoran hari ini"],
  uniq_pinjaman_aktif_nasabah: ["PINJAMAN_MASIH_AKTIF", "Nasabah ini masih punya pinjaman aktif"],
  uniq_pinjaman_foto: ["FOTO_SUDAH_DIPAKAI", "Foto ini sudah dipakai akad lain"],
  uniq_hari_kolektor_kolektor_tanggal: ["SUDAH_ABSEN", "Anda sudah mengisi absensi hari ini"],
  uniq_nasabah_kantor_nik: ["NIK_SUDAH_TERDAFTAR", "NIK ini sudah terdaftar"],
};

/** `app.onError` — satu tempat penerjemah galat → jawaban HTTP. */
export function tanganiGalat(err: Error, c: Context) {
  if (err instanceof GalatApp) {
    return c.json<Galat>({ kode: err.kode, pesan: err.message }, err.status);
  }
  if (err instanceof GalatAturan) {
    return c.json<Galat>({ kode: err.kode, pesan: err.message }, 422);
  }
  const bentrokDb = CONSTRAINT_BENTROK[galatPostgres(err)?.constraint_name ?? ""];
  if (bentrokDb) return c.json<Galat>({ kode: bentrokDb[0], pesan: bentrokDb[1] }, 409);
  console.error(err);
  return c.json<Galat>({ kode: "GALAT_SERVER", pesan: "Terjadi kesalahan di server" }, 500);
}

/** Galat validasi Zod → 400 dengan rincian per field. */
export function jawabanValidasi(error: ZodError): Galat {
  return {
    kode: "VALIDASI",
    pesan: "Data yang dikirim tidak sah",
    rincian: error.issues.map((i) => ({ jalur: i.path.join("."), pesan: i.message })),
  };
}

/** Galat Postgres di balik bungkus Drizzle (`DrizzleQueryError.cause`). */
export function galatPostgres(e: unknown): { code?: string; constraint_name?: string } | null {
  let saat: unknown = e;
  for (let i = 0; i < 4 && saat; i++) {
    if (typeof saat === "object" && saat !== null && "code" in saat && "severity" in saat) {
      return saat as { code?: string; constraint_name?: string };
    }
    saat = (saat as { cause?: unknown }).cause;
  }
  return null;
}
