import { createMiddleware } from "hono/factory";
import { tidakSah } from "../../galat";
import type { Lingkungan } from "../../router";
import type { LayananAuth } from "./layanan";

/**
 * Rute yang butuh pengguna masuk: token akses di `Authorization: Bearer …`.
 * Token akses berumur pendek (15 menit) — pencabutan perangkat berlaku paling
 * lambat sekian, karena token segarnya sudah ditolak.
 */
export function wajibMasuk(auth: Pick<LayananAuth, "periksaTokenAkses">) {
  return createMiddleware<Lingkungan>(async (c, next) => {
    const kepala = c.req.header("Authorization") ?? "";
    const [jenis, token] = kepala.split(" ");
    if (jenis !== "Bearer" || !token) {
      throw tidakSah("BELUM_MASUK", "Silakan masuk terlebih dahulu");
    }
    try {
      c.set("aktor", await auth.periksaTokenAkses(token));
    } catch {
      throw tidakSah("TOKEN_AKSES_TIDAK_SAH", "Token akses tidak berlaku");
    }
    await next();
  });
}
