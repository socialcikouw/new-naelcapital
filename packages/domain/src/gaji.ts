import { wajib } from "./galat";

/**
 * GAJI KOLEKTOR — docs/aturan-usaha.md bagian J. Tarif dalam basis poin atas
 * storting (500 = 5%), bertanggal dua lapis (kantor & khusus kolektor).
 */

/** Satu baris `tarif_gaji`. `kolektorId` null = tarif kantor; `tarifBp` null = ikut kantor. */
export interface BarisTarif {
  kolektorId: string | null;
  tarifBp: number | null;
  berlakuMulai: string;
}

const terbaru = (baris: readonly BarisTarif[], tanggal: string) => {
  let pilih: BarisTarif | undefined;
  for (const b of baris) {
    if (b.berlakuMulai <= tanggal && (!pilih || b.berlakuMulai > pilih.berlakuMulai)) pilih = b;
  }
  return pilih;
};

/**
 * J2. Tarif yang berlaku untuk seorang kolektor pada satu hari: tarif khusus
 * kolektor terbaru (berlaku mulai ≤ hari itu) bila berpersen; baris khusus
 * tanpa persen berarti kembali ikut kantor — maka tarif kantor terbaru.
 */
export function tarifBerlaku(
  tarif: readonly BarisTarif[],
  kolektorId: string,
  tanggal: string,
): number {
  const khusus = terbaru(
    tarif.filter((t) => t.kolektorId === kolektorId),
    tanggal,
  );
  if (khusus && khusus.tarifBp !== null) return khusus.tarifBp;
  const kantor = terbaru(
    tarif.filter((t) => t.kolektorId === null),
    tanggal,
  );
  wajib(
    kantor !== undefined && kantor.tarifBp !== null,
    "TARIF_BELUM_ADA",
    `Belum ada tarif gaji kantor yang berlaku pada ${tanggal}`,
  );
  return kantor.tarifBp;
}

/**
 * J1/J5. Gaji kotor = Σ (storting hari itu × tarif hari itu) ÷ 10.000,
 * dibulatkan sekali per periode. Storting negatif ikut mengurangi (J5).
 */
export function gajiKotor(hari: readonly { storting: number; tarifBp: number }[]): number {
  const total = hari.reduce((s, h) => s + h.storting * h.tarifBp, 0);
  return Math.round(total / 10_000);
}

/** J3–J4. Gaji bersih; tekor melebihi gaji ditolak, gaji kotor minus ditolak. */
export function gajiBersih(kotor: number, potonganTekor: number): number {
  wajib(kotor >= 0, "GAJI_KOTOR_MINUS", "Gaji kotor periode ini minus — periksa storting");
  wajib(
    potonganTekor <= kotor,
    "TEKOR_MELEBIHI_GAJI",
    "Tekor melebihi gaji — selesaikan selisihnya lebih dulu",
  );
  return kotor - potonganTekor;
}
