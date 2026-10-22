/**
 * Nama kampung (wilayah). WAJIB kembar dengan database:
 *   - `rapikanNamaWilayah` = bentuk yang dijaga `wilayah_nama_check`;
 *   - `kunciWilayah`       = kolom turunan `wilayah.kunci`
 *     (`lower(btrim(regexp_replace(nama, '\s+', ' ', 'g')))`).
 * Kunci yang sama = kampung yang sama ("Pule" = " pule ").
 */

/** Spasi dirapikan: ujung dibuang, spasi beruntun menjadi satu. */
export function rapikanNamaWilayah(nama: string): string {
  return nama.replace(/\s+/g, " ").trim();
}

/** Pembanding "kampung yang sama". */
export function kunciWilayah(nama: string): string {
  return rapikanNamaWilayah(nama).toLowerCase();
}
