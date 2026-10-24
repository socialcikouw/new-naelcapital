import { describe, expect, test } from "bun:test";
import { angsuranKe, syaratAkad, syaratMigrasi } from "./akad";
import { GalatAturan } from "./galat";
import { hitungGulung, type PinjamanAsal } from "./gulung";
import { hitungBayar, hitungLunas, storting } from "./setoran";

/** Contoh angka = docs/aturan-usaha.md, apa adanya. */

const kode = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    if (e instanceof GalatAturan) return e.kode;
    throw e;
  }
  return null;
};

describe("A. akad", () => {
  test("tabel contoh A5", () => {
    expect(syaratAkad("harian", 1_000_000, 24)).toMatchObject({
      potonganAdmin: 50_000,
      tabunganMasuk: 50_000,
      pencairan: 900_000,
      totalKembali: 1_200_000,
      angsuran: 50_000,
    });
    expect(syaratAkad("mingguan", 1_000_000, 8)).toMatchObject({
      pencairan: 900_000,
      angsuran: 150_000,
    });
    expect(syaratAkad("mingguan", 100_000, 10)).toMatchObject({
      potonganAdmin: 5_000,
      pencairan: 90_000,
      totalKembali: 120_000,
      angsuran: 12_000,
    });
    expect(syaratAkad("tempoan", 1_000_000, 14)).toMatchObject({
      potonganAdmin: 0,
      tabunganMasuk: 0,
      pencairan: 1_000_000,
      totalKembali: 1_250_000,
      angsuran: 1_250_000,
    });
  });

  test("A1 & A2 menolak pokok dan tenor tak sah", () => {
    expect(kode(() => syaratAkad("harian", 150_000, 24))).toBe("POKOK_TIDAK_SAH");
    expect(kode(() => syaratAkad("harian", 0, 24))).toBe("POKOK_TIDAK_SAH");
    expect(kode(() => syaratAkad("harian", 1_000_000, 20))).toBe("TENOR_TIDAK_BERLAKU");
    expect(kode(() => syaratAkad("tempoan", 1_000_000, 30))).toBe("TENOR_TIDAK_BERLAKU");
  });

  test("angsuran ke = angsuran yang sudah lunas", () => {
    expect(angsuranKe({ totalKembali: 1_200_000, saldo: 600_000, angsuran: 50_000 })).toBe(12);
    expect(angsuranKe({ totalKembali: 1_200_000, saldo: 625_000, angsuran: 50_000 })).toBe(11);
  });
});

describe("A10. salinan migrasi", () => {
  test("contoh A10: harian, 10 angsuran terbayar", () => {
    expect(syaratMigrasi("harian", 1_000_000, 24, 700_000, 50_000)).toMatchObject({
      totalKembali: 1_200_000,
      angsuran: 50_000,
      angsuranKe: 10,
      saldoAwal: 700_000,
      potonganAdmin: 0,
      pencairan: 0,
      tabunganMasuk: 50_000,
    });
  });

  test("saldo & tabungan di luar batas ditolak", () => {
    expect(kode(() => syaratMigrasi("harian", 1_000_000, 24, 0, 0))).toBe(
      "SALDO_MIGRASI_TIDAK_SAH",
    );
    expect(kode(() => syaratMigrasi("harian", 1_000_000, 24, 1_200_001, 0))).toBe(
      "SALDO_MIGRASI_TIDAK_SAH",
    );
    expect(kode(() => syaratMigrasi("tempoan", 1_000_000, 14, 1_250_000, -1))).toBe(
      "TABUNGAN_MIGRASI_TIDAK_SAH",
    );
    expect(kode(() => syaratMigrasi("harian", 1_050_000, 24, 100_000, 0))).toBe("POKOK_TIDAK_SAH");
  });
});

describe("C. setoran", () => {
  const harian = { jenis: "harian" as const, saldo: 600_000 };

  test("nominal per jenis (C1)", () => {
    expect(hitungBayar(harian, 50_000, 0).sisaSaldo).toBe(550_000);
    expect(kode(() => hitungBayar(harian, 52_000, 0))).toBe("NOMINAL_SETORAN_TIDAK_SESUAI");
    expect(kode(() => hitungBayar(harian, 0, 0))).toBe("SETORAN_NOL");
    expect(hitungBayar({ jenis: "mingguan", saldo: 120_000 }, 12_000, 0).sisaSaldo).toBe(108_000);
    expect(kode(() => hitungBayar({ jenis: "mingguan", saldo: 120_000 }, 12_500, 0))).toBe(
      "NOMINAL_SETORAN_TIDAK_SESUAI",
    );
    expect(kode(() => hitungBayar({ jenis: "tempoan", saldo: 1_250_000 }, 50_000, 0))).toBe(
      "TEMPOAN_TIDAK_BISA_DICICIL",
    );
  });

  test("setoran yang menghabiskan saldo wajib lewat lunas (C2)", () => {
    expect(kode(() => hitungBayar(harian, 600_000, 0))).toBe("SETORAN_HARUS_LEWAT_LUNAS");
    expect(kode(() => hitungBayar(harian, 550_000, 100_000))).toBe("SETORAN_HARUS_LEWAT_LUNAS");
  });
});

describe("D. pelunasan", () => {
  test("tabel contoh D1", () => {
    expect(hitungLunas(300_000, 100_000)).toEqual({
      setoranMurni: 200_000,
      setoranPelunasan: 100_000,
      tabunganKeluar: 100_000,
      storting: 200_000,
    });
    const lebih = hitungLunas(300_000, 500_000);
    expect(lebih).toEqual({
      setoranMurni: 0,
      setoranPelunasan: 300_000,
      tabunganKeluar: 500_000,
      storting: -200_000,
    });
    expect(storting(lebih)).toBe(lebih.storting);
  });
});

describe("E. gulung", () => {
  const terbuka = { gulungDikunci: false, naikDikunci: false };
  const asal: PinjamanAsal = {
    jenis: "harian",
    status: "berjalan",
    pokok: 1_000_000,
    saldo: 600_000,
    pinjamanKe: 4,
    angsuranKe: 12,
  };

  test("contoh E7: naik 1 jt → 1,5 jt di angsuran ke-12", () => {
    const r = hitungGulung(asal, 1_500_000, 24, terbuka);
    expect(r.jenisGulung).toBe("naik");
    expect(r.syarat.pencairan).toBe(1_350_000);
    expect(r.pencairan).toBe(750_000);
    expect(r).toMatchObject({
      saldoLama: 600_000,
      dropBaru: 500_000,
      dropGulung: 1_000_000,
      pokokBerkurang: 0,
    });
  });

  test("droping tetap & turun (E7)", () => {
    expect(hitungGulung(asal, 1_000_000, 24, terbuka)).toMatchObject({
      jenisGulung: "tetap",
      dropBaru: 0,
      dropGulung: 1_000_000,
    });
    expect(hitungGulung(asal, 800_000, 24, terbuka)).toMatchObject({
      jenisGulung: "turun",
      dropGulung: 800_000,
      pokokBerkurang: 200_000,
    });
  });

  test("rem bos diperiksa lebih dulu (E3)", () => {
    expect(
      kode(() => hitungGulung(asal, 1_000_000, 24, { gulungDikunci: true, naikDikunci: false })),
    ).toBe("GULUNG_PINJAMAN_DIKUNCI");
    expect(
      kode(() => hitungGulung(asal, 1_500_000, 24, { gulungDikunci: false, naikDikunci: true })),
    ).toBe("NAIK_PINJAMAN_DIKUNCI");
    // Rem naik tak menghalangi gulung tetap.
    expect(
      hitungGulung(asal, 1_000_000, 24, { gulungDikunci: false, naikDikunci: true }).jenisGulung,
    ).toBe("tetap");
  });

  test("tambahan harian (E4)", () => {
    expect(kode(() => hitungGulung({ ...asal, status: "macet" }, 1_000_000, 24, terbuka))).toBe(
      "GULUNG_PINJAMAN_MACET",
    );
    expect(
      kode(() => hitungGulung({ ...asal, pinjamanKe: 1, angsuranKe: 12 }, 1_500_000, 24, terbuka)),
    ).toBe("GULUNG_PERTAMA_TIDAK_BOLEH_NAIK");
    expect(
      kode(() => hitungGulung({ ...asal, pinjamanKe: 3, angsuranKe: 11 }, 1_000_000, 24, terbuka)),
    ).toBe("GULUNG_ANGSURAN_BELUM_CUKUP");
    expect(
      hitungGulung(
        { ...asal, pinjamanKe: 4, angsuranKe: 10, saldo: 700_000 },
        1_000_000,
        24,
        terbuka,
      ),
    ).toBeTruthy();
    expect(
      kode(() => hitungGulung({ ...asal, angsuranKe: 9, saldo: 750_000 }, 1_000_000, 24, terbuka)),
    ).toBe("GULUNG_ANGSURAN_BELUM_CUKUP");
  });

  test("mingguan boleh digulung saat macet & naik di pinjaman pertama (E5)", () => {
    const mingguan: PinjamanAsal = {
      jenis: "mingguan",
      status: "macet",
      pokok: 1_000_000,
      saldo: 900_000,
      pinjamanKe: 1,
      angsuranKe: 2,
    };
    expect(hitungGulung(mingguan, 2_000_000, 8, terbuka).pencairan).toBe(900_000);
  });

  test("pencairan bersih harus lebih dari nol (E6) & asal masih ditagih (E2)", () => {
    expect(kode(() => hitungGulung({ ...asal, saldo: 900_000 }, 1_000_000, 24, terbuka))).toBe(
      "GULUNG_PENCAIRAN_TIDAK_CUKUP",
    );
    expect(kode(() => hitungGulung({ ...asal, status: "lunas" }, 1_000_000, 24, terbuka))).toBe(
      "PINJAMAN_SUDAH_SELESAI",
    );
  });
});
