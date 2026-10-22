import { wajib } from "./galat";

/**
 * AKAD PINJAMAN — docs/aturan-usaha.md bagian A. Hasil `syaratAkad`
 * DIBEKUKAN di baris pinjaman pada hari akad (A6): mengubah rumus di sini
 * hanya berlaku untuk akad berikutnya.
 */
export type JenisPinjaman = "harian" | "mingguan" | "tempoan";

/** A2. Harian & mingguan = jumlah kali bayar; tempoan = jangka HARI. */
export const TENOR_PINJAMAN: Record<JenisPinjaman, readonly number[]> = {
  harian: [24],
  mingguan: [6, 8, 10],
  tempoan: [7, 10, 14],
};

/** A1. */
export const KELIPATAN_POKOK = 100_000;

export interface SyaratAkad {
  jenis: JenisPinjaman;
  tenor: number;
  pokok: number;
  potonganAdmin: number;
  tabunganMasuk: number;
  /** Tunai sebelum dikurangi saldo pinjaman lama (gulung). */
  pencairan: number;
  totalKembali: number;
  angsuran: number;
}

export function tenorBerlaku(jenis: JenisPinjaman, tenor: number): boolean {
  return TENOR_PINJAMAN[jenis].includes(tenor);
}

/** A1–A5. */
export function syaratAkad(jenis: JenisPinjaman, pokok: number, tenor: number): SyaratAkad {
  wajib(
    Number.isInteger(pokok) && pokok > 0 && pokok % KELIPATAN_POKOK === 0,
    "POKOK_TIDAK_SAH",
    "Pokok harus kelipatan Rp 100.000",
  );
  wajib(
    tenorBerlaku(jenis, tenor),
    "TENOR_TIDAK_BERLAKU",
    `Tenor ${tenor} tidak berlaku untuk pinjaman ${jenis}`,
  );

  if (jenis === "tempoan") {
    const totalKembali = (pokok * 5) / 4;
    return {
      jenis,
      tenor,
      pokok,
      potonganAdmin: 0,
      tabunganMasuk: 0,
      pencairan: pokok,
      totalKembali,
      angsuran: totalKembali,
    };
  }
  const potongan = pokok / 20;
  const totalKembali = (pokok * 6) / 5;
  return {
    jenis,
    tenor,
    pokok,
    potonganAdmin: potongan,
    tabunganMasuk: potongan,
    pencairan: pokok - 2 * potongan,
    totalKembali,
    angsuran: totalKembali / tenor,
  };
}

/** Jumlah angsuran yang sudah lunas — sama dengan kolom turunan `pinjaman.angsuran_ke`. */
export function angsuranKe(p: { totalKembali: number; saldo: number; angsuran: number }): number {
  return Math.floor((p.totalKembali - p.saldo) / p.angsuran);
}
