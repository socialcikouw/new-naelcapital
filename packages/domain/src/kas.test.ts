import { describe, expect, test } from "bun:test";
import { batasTransfer, tekorDanLebih, tunaiSeharusnya } from "./kas";

describe("kas harian kolektor (aturan-usaha I)", () => {
  test("contoh I2: tunai seharusnya 1.250.000, diterima 1.200.000 → tekor 50.000", () => {
    const seharusnya = tunaiSeharusnya({
      kasLapangan: 1_000_000,
      storting: 1_250_000,
      tabunganMasuk: 50_000,
      potonganAdmin: 50_000,
      droping: 1_000_000,
      transfer: 70_000,
      biaya: 30_000,
    });
    expect(seharusnya).toBe(1_250_000);
    expect(tekorDanLebih(1_200_000 - seharusnya)).toEqual({ tekor: 50_000, lebihSetor: 0 });
  });

  test("gulung contoh E7: uang yang keluar dari tangan kolektor = pencairan bersih", () => {
    // Saldo lama 600.000 ditutup penerus (storting gulung); penerus pokok 1,5 jt,
    // admin 75 rb, tabungan 75 rb, droping 500 rb + 1 jt.
    const seharusnya = tunaiSeharusnya({
      kasLapangan: 1_000_000,
      storting: 600_000,
      tabunganMasuk: 75_000,
      potonganAdmin: 75_000,
      droping: 1_500_000,
      transfer: 0,
      biaya: 0,
    });
    expect(seharusnya).toBe(1_000_000 - 750_000);
  });

  test("boleh negatif bila droping melebihi uang masuk", () => {
    const seharusnya = tunaiSeharusnya({
      kasLapangan: 0,
      storting: 100_000,
      tabunganMasuk: 50_000,
      potonganAdmin: 50_000,
      droping: 1_000_000,
      transfer: 0,
      biaya: 0,
    });
    expect(seharusnya).toBe(-800_000);
  });

  test("lebih setor tercatat apa adanya", () => {
    expect(tekorDanLebih(20_000)).toEqual({ tekor: 0, lebihSetor: 20_000 });
    expect(tekorDanLebih(0)).toEqual({ tekor: 0, lebihSetor: 0 });
  });

  test("I3: batas transfer per jenis setoran", () => {
    expect(
      batasTransfer({ jenis: "angsuran", setoranMurni: 50_000, setoranPelunasan: 10_000 }),
    ).toBe(60_000);
    // Bagian yang ditutup tabungan bukan uang nasabah.
    expect(
      batasTransfer({ jenis: "pelunasan", setoranMurni: 100_000, setoranPelunasan: 500_000 }),
    ).toBe(100_000);
    expect(batasTransfer({ jenis: "gulung", setoranMurni: 0, setoranPelunasan: 600_000 })).toBe(0);
  });
});
