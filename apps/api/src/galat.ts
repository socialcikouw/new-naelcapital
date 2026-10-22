import type { Galat } from "@naelcapital/contracts";
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

/** `app.onError` — satu tempat penerjemah galat → jawaban HTTP. */
export function tanganiGalat(err: Error, c: Context) {
  if (err instanceof GalatApp) {
    return c.json<Galat>({ kode: err.kode, pesan: err.message }, err.status);
  }
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
