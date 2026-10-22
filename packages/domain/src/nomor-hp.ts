/**
 * Nomor HP Indonesia dalam bentuk baku E.164 (`+628…`) — satu bentuk per
 * nomor, supaya tombol WA/telepon dan pencarian tepat. Yang diketik orang
 * (`0812-3456-7890`, `62812…`, `+62 812…`) dibakukan di sini, di server
 * maupun di formulir aplikasi.
 */

/** Pola E.164 yang diterima database (`pengguna_nomor_hp_check`, `nasabah_nomor_hp_check`). */
export const POLA_E164 = /^\+[0-9]{8,15}$/;

/** Bakukan nomor yang diketik menjadi E.164; `null` bila bukan nomor yang sah. */
export function bakukanNomorHp(teks: string): string | null {
  const ringkas = teks.trim().replace(/[\s\-().]/g, "");
  let baku: string;
  if (ringkas.startsWith("+")) baku = ringkas;
  else if (ringkas.startsWith("62")) baku = `+${ringkas}`;
  else if (ringkas.startsWith("0")) baku = `+62${ringkas.slice(1)}`;
  else return null;
  return POLA_E164.test(baku) ? baku : null;
}
