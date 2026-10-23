import { describe, expect, test } from "bun:test";
import { hitungPerforma } from "./performa";

describe("performa penagihan harian (aturan-usaha N)", () => {
  test("contoh N: patokan 2.000.000 − 100.000, murni 1.710.000 → 90%", () => {
    expect(hitungPerforma(1_710_000, 2_000_000, 100_000)).toEqual({
      patokan: 1_900_000,
      persentase: 90,
    });
  });

  test("N2: tanpa potret kemarin kosong; patokan ≤ 0 tanpa persentase", () => {
    expect(hitungPerforma(500_000, null, 0)).toEqual({ patokan: null, persentase: null });
    expect(hitungPerforma(500_000, 100_000, 100_000)).toEqual({ patokan: 0, persentase: null });
  });
});
