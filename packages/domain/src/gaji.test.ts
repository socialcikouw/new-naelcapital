import { describe, expect, test } from "bun:test";
import { gajiBersih, gajiKotor, tarifBerlaku } from "./gaji";
import { GalatAturan } from "./galat";

describe("gaji kolektor (aturan-usaha J)", () => {
  test("contoh J4: tarif 5%, storting 12.000.000, tekor 50.000 → bersih 550.000", () => {
    const kotor = gajiKotor([{ storting: 12_000_000, tarifBp: 500 }]);
    expect(kotor).toBe(600_000);
    expect(gajiBersih(kotor, 50_000)).toBe(550_000);
  });

  test("J1: dibulatkan sekali per periode, bukan per hari", () => {
    // 3 hari × 10.010 × 5% = 3 × 500,5 = 1.501,5 → 1.502 (per hari: 3 × 501 = 1.503).
    expect(gajiKotor(Array(3).fill({ storting: 10_010, tarifBp: 500 }))).toBe(1_502);
  });

  test("J5: storting negatif ikut mengurangi", () => {
    expect(
      gajiKotor([
        { storting: 1_000_000, tarifBp: 500 },
        { storting: -200_000, tarifBp: 500 },
      ]),
    ).toBe(40_000);
  });

  test("J4: tekor melebihi gaji & gaji minus ditolak", () => {
    expect(() => gajiBersih(100_000, 100_001)).toThrow(GalatAturan);
    expect(() => gajiBersih(-1, 0)).toThrow(GalatAturan);
    expect(gajiBersih(100_000, 100_000)).toBe(0);
  });

  test("J2: contoh dokumen tarif — Andi 6% Okt–Nov, kembali ikut kantor 5,5% Des", () => {
    const tarif = [
      { kolektorId: null, tarifBp: 500, berlakuMulai: "2026-01-01" },
      { kolektorId: "andi", tarifBp: 600, berlakuMulai: "2026-10-01" },
      { kolektorId: "andi", tarifBp: null, berlakuMulai: "2026-12-01" },
      { kolektorId: null, tarifBp: 550, berlakuMulai: "2026-12-01" },
    ];
    expect(tarifBerlaku(tarif, "andi", "2026-09-30")).toBe(500);
    expect(tarifBerlaku(tarif, "andi", "2026-11-15")).toBe(600);
    expect(tarifBerlaku(tarif, "andi", "2026-12-15")).toBe(550);
    expect(tarifBerlaku(tarif, "dedi", "2026-11-15")).toBe(500);
    expect(() => tarifBerlaku(tarif, "andi", "2025-12-31")).toThrow(GalatAturan);
  });
});
