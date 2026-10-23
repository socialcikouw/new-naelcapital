import { wajib } from "./galat";

/**
 * TABUNGAN NASABAH — docs/aturan-usaha.md bagian H. Saldo tabungan adalah
 * cache di `nasabah.saldo_tabungan`; penarikan & koreksi oleh bos memeriksa
 * angka yang dilihat bos masih sama dengan database.
 */

/** H5. Batas wajar tabungan: paling banyak 5 × pokok — pagar salah ketik. */
export const KALI_POKOK_TABUNGAN_WAJAR = 5;

function samaDenganLayar(saldoSebelum: number, saldoSekarang: number) {
  wajib(
    saldoSebelum === saldoSekarang,
    "TABUNGAN_BERUBAH",
    "Saldo tabungan berubah sejak dibuka — muat ulang lalu ulangi",
  );
}

/** H3. Penarikan: hanya bos, paling banyak sebesar tabungan. */
export function syaratPenarikan(p: {
  nominal: number;
  saldoSebelum: number;
  saldoSekarang: number;
}) {
  samaDenganLayar(p.saldoSebelum, p.saldoSekarang);
  wajib(p.nominal > 0, "NOMINAL_TIDAK_SAH", "Nominal penarikan harus lebih dari 0");
  wajib(p.nominal <= p.saldoSekarang, "TABUNGAN_TIDAK_CUKUP", "Penarikan melebihi saldo tabungan");
}

/**
 * H4–H5. Koreksi: membetulkan angka tanpa uang berpindah; saldo baru tak
 * minus dan wajar (≤ 5 × pokok pinjaman terakhir). Nasabah tanpa pinjaman
 * hanya bisa dikoreksi turun. Mengembalikan selisih yang dicatat.
 */
export function hitungKoreksi(k: {
  saldoBaru: number;
  saldoSebelum: number;
  saldoSekarang: number;
  pokokTerakhir: number | null;
}): number {
  samaDenganLayar(k.saldoSebelum, k.saldoSekarang);
  wajib(k.saldoBaru >= 0, "TABUNGAN_MINUS", "Saldo tabungan tidak boleh minus");
  const selisih = k.saldoBaru - k.saldoSebelum;
  wajib(selisih !== 0, "TIDAK_ADA_PERUBAHAN", "Saldo baru sama dengan saldo sekarang");
  if (selisih > 0) {
    const batas = (k.pokokTerakhir ?? 0) * KALI_POKOK_TABUNGAN_WAJAR;
    wajib(
      k.saldoBaru <= batas,
      "TABUNGAN_TIDAK_WAJAR",
      `Tabungan paling banyak ${KALI_POKOK_TABUNGAN_WAJAR} × pokok pinjaman terakhir`,
    );
  }
  return selisih;
}
