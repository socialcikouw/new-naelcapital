import { describe, expect, test } from "bun:test";
import { hariTagihKantor } from "./kalender";
import { awalJendelaMacet, mulaiDitagih, nilaiMacet } from "./macet";

const harian = {
  jenis: "harian" as const,
  status: "berjalan" as const,
  angsuran: 50_000,
  tanggalMasuk: "2026-09-01",
  jatuhTempo: null,
  hariTagih: 25,
  setoranMurni: 0,
};

describe("macet (aturan-usaha F)", () => {
  test("jendela 30 hari termasuk hari yang dinilai", () => {
    expect(awalJendelaMacet("2026-10-30")).toBe("2026-10-01");
  });

  test("contoh F: ambang 250.000 — 200.000 macet, lalu 300.000 pulih", () => {
    expect(nilaiMacet({ ...harian, setoranMurni: 200_000 }, "2026-10-20")).toEqual({
      dievaluasi: true,
      status: "macet",
    });
    expect(nilaiMacet({ ...harian, status: "macet", setoranMurni: 300_000 }, "2026-10-21")).toEqual(
      { dievaluasi: true, status: "berjalan" },
    );
    // Tepat di ambang = tidak macet.
    expect(nilaiMacet({ ...harian, setoranMurni: 250_000 }, "2026-10-20").status).toBe("berjalan");
  });

  test("F1: harian baru dinilai bila jendela memuat ≥ 15 hari tagih", () => {
    expect(nilaiMacet({ ...harian, hariTagih: 14 }, "2026-10-20")).toEqual({
      dievaluasi: false,
      status: "berjalan",
    });
    expect(nilaiMacet({ ...harian, status: "macet", hariTagih: 14 }, "2026-10-20").status).toBe(
      "macet",
    );
    expect(nilaiMacet({ ...harian, hariTagih: 15 }, "2026-10-20").status).toBe("macet");
  });

  test("F2: mingguan < 1 × angsuran, baru dinilai sesudah satu jendela penuh", () => {
    const mingguan = { ...harian, jenis: "mingguan" as const, angsuran: 300_000 };
    // Masuk 21 Sep, ditutup 20 Okt: 30 hari tepat → dinilai.
    expect(
      nilaiMacet({ ...mingguan, tanggalMasuk: "2026-09-21", setoranMurni: 299_000 }, "2026-10-20"),
    ).toEqual({ dievaluasi: true, status: "macet" });
    expect(
      nilaiMacet({ ...mingguan, tanggalMasuk: "2026-09-22", setoranMurni: 0 }, "2026-10-20"),
    ).toEqual({ dievaluasi: false, status: "berjalan" });
  });

  test("F3/F4: tempoan macet lewat 7 hari dari jatuh tempo, tidak pulih lewat sapuan", () => {
    const tempoan = { ...harian, jenis: "tempoan" as const, jatuhTempo: "2026-10-10" };
    expect(nilaiMacet(tempoan, "2026-10-17").status).toBe("berjalan");
    expect(nilaiMacet(tempoan, "2026-10-18").status).toBe("macet");
    expect(
      nilaiMacet({ ...tempoan, status: "macet", setoranMurni: 9_999_999 }, "2026-10-18").status,
    ).toBe("macet");
  });

  test("B1: mulai ditagih", () => {
    expect(mulaiDitagih({ tanggalAkad: "2026-10-01", tanggalDisalin: null })).toBe("2026-10-02");
    expect(mulaiDitagih({ tanggalAkad: "2026-08-01", tanggalDisalin: "2026-10-05" })).toBe(
      "2026-10-05",
    );
  });
});

describe("hari tagih kantor (B2)", () => {
  // 126 = Senin–Sabtu; 2026-10-25 hari Minggu.
  const pola = [
    { berlakuMulai: "2026-10-01", hariKerja: 126 },
    { berlakuMulai: "2026-10-26", hariKerja: 127 },
  ];
  test("pekan kerja bertanggal, libur kantor, sebelum pola pertama", () => {
    const libur = new Set(["2026-10-20"]);
    expect(hariTagihKantor("2026-10-24", pola, libur)).toBe(true);
    expect(hariTagihKantor("2026-10-25", pola, libur)).toBe(false);
    expect(hariTagihKantor("2026-11-01", pola, libur)).toBe(true); // Minggu, pola baru
    expect(hariTagihKantor("2026-10-20", pola, libur)).toBe(false);
    expect(hariTagihKantor("2026-09-30", pola, libur)).toBe(false);
  });
});
