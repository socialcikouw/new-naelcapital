/**
 * NIK tersamar — selain bos, NIK nasabah hanya terlihat 4 digit awal & akhir
 * (docs/skema/schema-nasabah.md). Juga dipakai di jejak riwayat perubahan.
 */
export function samarkanNik(nik: string): string {
  return nik.length <= 8
    ? "*".repeat(nik.length)
    : `${nik.slice(0, 4)}${"*".repeat(nik.length - 8)}${nik.slice(-4)}`;
}
