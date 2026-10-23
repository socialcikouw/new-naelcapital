import { describe, expect, test } from "bun:test";
import { hitungKoreksi, syaratPenarikan } from "./tabungan";

const kode = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as { kode?: string }).kode;
  }
  return null;
};

describe("tabungan nasabah (aturan-usaha H)", () => {
  test("H3: contoh Lasminati — tabungan 600.000, ditarik 300.000", () => {
    expect(
      kode(() =>
        syaratPenarikan({ nominal: 300_000, saldoSebelum: 600_000, saldoSekarang: 600_000 }),
      ),
    ).toBeNull();
    expect(
      kode(() =>
        syaratPenarikan({ nominal: 600_001, saldoSebelum: 600_000, saldoSekarang: 600_000 }),
      ),
    ).toBe("TABUNGAN_TIDAK_CUKUP");
    // Ada gerakan tabungan di sela bos membaca & menyimpan.
    expect(
      kode(() =>
        syaratPenarikan({ nominal: 100_000, saldoSebelum: 600_000, saldoSekarang: 550_000 }),
      ),
    ).toBe("TABUNGAN_BERUBAH");
  });

  test("H4–H5: koreksi menyimpan selisih; tak minus; wajar ≤ 5 × pokok", () => {
    const dasar = { saldoSebelum: 600_000, saldoSekarang: 600_000, pokokTerakhir: 1_000_000 };
    expect(hitungKoreksi({ ...dasar, saldoBaru: 550_000 })).toBe(-50_000);
    expect(hitungKoreksi({ ...dasar, saldoBaru: 5_000_000 })).toBe(4_400_000);
    expect(kode(() => hitungKoreksi({ ...dasar, saldoBaru: 5_000_001 }))).toBe(
      "TABUNGAN_TIDAK_WAJAR",
    );
    expect(kode(() => hitungKoreksi({ ...dasar, saldoBaru: 600_000 }))).toBe("TIDAK_ADA_PERUBAHAN");
    expect(kode(() => hitungKoreksi({ ...dasar, saldoBaru: -1 }))).toBe("TABUNGAN_MINUS");
    // Tanpa pinjaman: hanya turun.
    expect(hitungKoreksi({ ...dasar, pokokTerakhir: null, saldoBaru: 0 })).toBe(-600_000);
    expect(kode(() => hitungKoreksi({ ...dasar, pokokTerakhir: null, saldoBaru: 600_001 }))).toBe(
      "TABUNGAN_TIDAK_WAJAR",
    );
  });
});
