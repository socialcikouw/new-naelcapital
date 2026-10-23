/**
 * PERFORMA PENAGIHAN HARIAN — docs/aturan-usaha.md bagian N. Hanya pinjaman
 * harian. Patokan = angsuran berjalan akhir kemarin − angsuran yang mati hari
 * itu; persentase = setoran murni ÷ patokan × 100.
 */
export interface HasilPerforma {
  /** null = belum ada potret kemarin. */
  patokan: number | null;
  /** null = belum ada potret kemarin, atau patokan ≤ 0. */
  persentase: number | null;
}

export function hitungPerforma(
  setoranMurni: number,
  angsuranKemarin: number | null,
  angsuranMati: number,
): HasilPerforma {
  if (angsuranKemarin === null) return { patokan: null, persentase: null };
  const patokan = angsuranKemarin - angsuranMati;
  return { patokan, persentase: patokan > 0 ? (setoranMurni / patokan) * 100 : null };
}
