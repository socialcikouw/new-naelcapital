import { describe, expect, test } from "bun:test";
import {
  dalamJamKerja,
  geserTanggal,
  hariKerjaPekan,
  hariPekanDari,
  hariTagihMingguan,
  menitDariJam,
  selisihHari,
  waktuKantor,
} from "./kalender";

describe("kalender kantor", () => {
  test("tanggal pembukuan mengikuti zona kantor", () => {
    // 22 Okt 2026 17:30 UTC = 23 Okt 00:30 WIB = 23 Okt 01:30 WITA.
    const t = new Date("2026-10-22T17:30:00Z");
    expect(waktuKantor(t, "WIB")).toEqual({ tanggal: "2026-10-23", menit: 30, hariPekan: 5 });
    expect(waktuKantor(t, "WITA").menit).toBe(90);
    // 16:59 UTC masih 22 Okt 23:59 WIB.
    expect(waktuKantor(new Date("2026-10-22T16:59:00Z"), "WIB").tanggal).toBe("2026-10-22");
  });

  test("jam kerja: buka inklusif, tutup eksklusif, 24:00 = tengah malam", () => {
    expect(menitDariJam("07:00:00")).toBe(420);
    expect(menitDariJam("24:00:00")).toBe(1440);
    expect(dalamJamKerja(419, "07:00", "24:00")).toBe(false);
    expect(dalamJamKerja(420, "07:00", "24:00")).toBe(true);
    expect(dalamJamKerja(1439, "07:00", "24:00")).toBe(true);
    expect(dalamJamKerja(1020, "07:00", "17:00")).toBe(false);
  });

  test("pekan kerja bitmask: 126 = Senin–Sabtu", () => {
    expect(hariKerjaPekan(126, 0)).toBe(false);
    expect(hariKerjaPekan(126, 1)).toBe(true);
    expect(hariKerjaPekan(126, 6)).toBe(true);
    expect(hariKerjaPekan(62, 6)).toBe(false);
  });

  test("aritmetika tanggal", () => {
    expect(geserTanggal("2026-10-31", 1)).toBe("2026-11-01");
    expect(geserTanggal("2026-03-01", -1)).toBe("2026-02-28");
    expect(selisihHari("2026-10-01", "2026-10-15")).toBe(14);
    expect(hariPekanDari("2026-10-23")).toBe(5);
  });

  test("hari tagih mingguan: akad + 7k (B3)", () => {
    expect(hariTagihMingguan("2026-10-01", "2026-10-01")).toBe(false);
    expect(hariTagihMingguan("2026-10-01", "2026-10-08")).toBe(true);
    expect(hariTagihMingguan("2026-10-01", "2026-10-09")).toBe(false);
    expect(hariTagihMingguan("2026-10-01", "2026-10-29")).toBe(true);
  });
});
