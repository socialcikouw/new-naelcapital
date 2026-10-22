import { describe, expect, test } from "bun:test";
import { kunciWilayah, rapikanNamaWilayah } from "./wilayah";

describe("wilayah", () => {
  test("nama dirapikan", () => {
    expect(rapikanNamaWilayah("  Pule   Barat ")).toBe("Pule Barat");
    expect(rapikanNamaWilayah("Pule\tBarat")).toBe("Pule Barat");
  });

  test("kunci: huruf kecil & spasi rapi — kampung yang sama", () => {
    expect(kunciWilayah(" Pule  Barat")).toBe("pule barat");
    expect(kunciWilayah("PULE BARAT")).toBe(kunciWilayah("pule barat"));
    // Aturan sengaja sederhana: "Pule 2" ≠ "Pule II".
    expect(kunciWilayah("Pule 2")).not.toBe(kunciWilayah("Pule II"));
  });
});
