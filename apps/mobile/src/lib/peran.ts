import type { Peran } from "@naelcapital/contracts";
import { waktuKantor, type ZonaWaktu } from "@naelcapital/domain";

/** Layar pertama tiap peran sesudah HP tertaut. */
export function layarAwal(peran: Peran) {
  if (peran === "kolektor") return "/kolektor" as const;
  if (peran === "kasir") return "/kasir" as const;
  if (peran === "pengawas") return "/pengawas" as const;
  return "/beranda" as const;
}

/** Tanggal pembukuan hari ini menurut zona kantor. */
export function hariIniKantor(zona: ZonaWaktu): string {
  return waktuKantor(new Date(), zona).tanggal;
}
