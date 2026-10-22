import type { JenisPinjaman } from "./akad";
import { wajib } from "./galat";

/** C1. Nominal setoran murni & setoran pelunasan masing-masing (nol boleh). */
export const NOMINAL_SETORAN = {
  harian: { minimal: 5_000, kelipatan: 5_000 },
  mingguan: { minimal: 5_000, kelipatan: 1_000 },
} as const;

const rupiah = (n: number) => n.toLocaleString("id-ID");

/**
 * SETORAN ANGSURAN — docs/aturan-usaha.md bagian C. Mengembalikan sisa
 * saldo (selalu > 0): setoran yang menghabiskan saldo wajib lewat lunas (C2).
 */
export function hitungBayar(
  pinjaman: { jenis: JenisPinjaman; saldo: number },
  setoranMurni: number,
  setoranPelunasan: number,
): { sisaSaldo: number } {
  const total = setoranMurni + setoranPelunasan;
  wajib(total > 0, "SETORAN_NOL", "Nominal setoran harus lebih dari 0");
  wajib(
    pinjaman.jenis !== "tempoan",
    "TEMPOAN_TIDAK_BISA_DICICIL",
    "Pinjaman tempoan dibayar sekali penuh — gunakan Lunas",
  );
  const aturan = NOMINAL_SETORAN[pinjaman.jenis];
  for (const nominal of [setoranMurni, setoranPelunasan]) {
    wajib(
      nominal === 0 || (nominal >= aturan.minimal && nominal % aturan.kelipatan === 0),
      "NOMINAL_SETORAN_TIDAK_SESUAI",
      `Setoran pinjaman ${pinjaman.jenis} minimal Rp ${rupiah(aturan.minimal)} dan kelipatan Rp ${rupiah(aturan.kelipatan)}`,
    );
  }
  wajib(
    total < pinjaman.saldo,
    "SETORAN_HARUS_LEWAT_LUNAS",
    "Setoran ini melunasi pinjaman — gunakan Lunas",
  );
  return { sisaSaldo: pinjaman.saldo - total };
}

/**
 * PELUNASAN — bagian D. Tabungan menutup saldo lebih dulu (paling banyak
 * sebesar saldo), sisanya dibayar nasabah, seluruh tabungan keluar. Storting
 * bisa negatif bila tabungan melebihi saldo (D2: kolektor mengembalikan
 * selisihnya tunai, setoran sore berkurang sebesar itu).
 */
export function hitungLunas(saldo: number, tabungan: number) {
  const setoranPelunasan = Math.min(tabungan, saldo);
  return {
    setoranMurni: saldo - setoranPelunasan,
    setoranPelunasan,
    tabunganKeluar: tabungan,
    storting: saldo - tabungan,
  };
}

/** Storting satu baris transaksi — sama dengan kolom turunan `transaksi.storting`. */
export function storting(t: {
  setoranMurni: number;
  setoranPelunasan: number;
  tabunganKeluar: number;
}) {
  return t.setoranMurni + t.setoranPelunasan - t.tabunganKeluar;
}
