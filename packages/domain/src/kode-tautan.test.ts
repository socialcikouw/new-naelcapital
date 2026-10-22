import { describe, expect, test } from "bun:test";
import { AWALAN_QR, bakukanKode, isiQr, tampilanKode } from "./kode-tautan";

describe("kode tautan", () => {
  test("tampilan & isi QR", () => {
    expect(tampilanKode("K7QM28XD")).toBe("K7QM-28XD");
    expect(isiQr("K7QM28XD")).toBe(`${AWALAN_QR}K7QM28XD`);
  });

  test("bakukan ketikan bos & isi QR", () => {
    expect(bakukanKode("k7qm-28xd")).toBe("K7QM28XD");
    expect(bakukanKode(" K7QM 28XD ")).toBe("K7QM28XD");
    expect(bakukanKode(`${AWALAN_QR}K7QM28XD`)).toBe("K7QM28XD");
  });

  test("yang bukan kode ditolak", () => {
    expect(bakukanKode("K7QM28X")).toBeNull();
    expect(bakukanKode("K7QM28X0")).toBeNull(); // 0 tak ada di abjad
    expect(bakukanKode("K7QM28XI")).toBeNull(); // I tak ada di abjad
    expect(bakukanKode("https://contoh.com/K7QM28XD")).toBeNull();
  });
});
