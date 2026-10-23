/**
 * KALENDER KANTOR — tanggal pembukuan & jam kerja menurut zona kantor.
 * Zona Indonesia ber-offset tetap (tanpa jam musim panas), jadi cukup
 * aritmetika jam — tanpa pustaka tanggal. Tanggal selalu teks `YYYY-MM-DD`.
 */
export type ZonaWaktu = "WIB" | "WITA" | "WIT";

const OFFSET_JAM: Record<ZonaWaktu, number> = { WIB: 7, WITA: 8, WIT: 9 };
const SEHARI_MS = 24 * 60 * 60 * 1000;

export interface WaktuKantor {
  /** Tanggal pembukuan kantor. */
  tanggal: string;
  /** Menit sejak tengah malam waktu kantor. */
  menit: number;
  /** 0 = Minggu … 6 = Sabtu. */
  hariPekan: number;
}

/** Saat `sekarang` menurut jam dinding kantor. */
export function waktuKantor(sekarang: Date, zona: ZonaWaktu): WaktuKantor {
  const lokal = new Date(sekarang.getTime() + OFFSET_JAM[zona] * 60 * 60 * 1000);
  return {
    tanggal: lokal.toISOString().slice(0, 10),
    menit: lokal.getUTCHours() * 60 + lokal.getUTCMinutes(),
    hariPekan: lokal.getUTCDay(),
  };
}

/** `"07:00"` / `"07:00:00"` / `"24:00:00"` → menit sejak tengah malam. */
export function menitDariJam(jam: string): number {
  const [h = "0", m = "0"] = jam.split(":");
  return Number(h) * 60 + Number(m);
}

/** Jam buka (inklusif) – jam tutup (eksklusif); `24:00` = tengah malam. */
export function dalamJamKerja(menit: number, jamBuka: string, jamTutup: string): boolean {
  return menit >= menitDariJam(jamBuka) && menit < menitDariJam(jamTutup);
}

/** Bit hari dalam bitmask pekan kerja (bit 0 = Minggu … bit 6 = Sabtu). */
export function hariKerjaPekan(bitmask: number, hariPekan: number): boolean {
  return (bitmask & (1 << hariPekan)) !== 0;
}

const keMs = (tanggal: string) => Date.parse(`${tanggal}T00:00:00Z`);

/** Tanggal + n hari. */
export function geserTanggal(tanggal: string, hari: number): string {
  return new Date(keMs(tanggal) + hari * SEHARI_MS).toISOString().slice(0, 10);
}

/** Jumlah hari dari `dari` ke `sampai` (negatif bila mundur). */
export function selisihHari(dari: string, sampai: string): number {
  return Math.round((keMs(sampai) - keMs(dari)) / SEHARI_MS);
}

/** Hari dalam pekan dari tanggal (0 = Minggu). */
export function hariPekanDari(tanggal: string): number {
  return new Date(keMs(tanggal)).getUTCDay();
}

/** B3. Hari tagih mingguan: hari akad + 7k, k ≥ 1. */
export function hariTagihMingguan(tanggalAkad: string, tanggal: string): boolean {
  const selisih = selisihHari(tanggalAkad, tanggal);
  return selisih > 0 && selisih % 7 === 0;
}

/** Pola pekan kerja bertanggal (tabel `pekan_kerja`). */
export interface PolaPekan {
  berlakuMulai: string;
  /** Bitmask hari kerja (bit 0 = Minggu … bit 6 = Sabtu). */
  hariKerja: number;
}

/**
 * B2. Hari tagih harian: hari kerja menurut pola pekan yang berlaku pada
 * tanggal itu (pola terbaru dengan `berlakuMulai` ≤ tanggal) dan bukan libur
 * kantor. Tanggal sebelum pola pertama bukan hari tagih.
 */
export function hariTagihKantor(
  tanggal: string,
  pola: readonly PolaPekan[],
  liburKantor: ReadonlySet<string>,
): boolean {
  if (liburKantor.has(tanggal)) return false;
  let berlaku: PolaPekan | undefined;
  for (const p of pola) {
    if (p.berlakuMulai <= tanggal && (!berlaku || p.berlakuMulai > berlaku.berlakuMulai)) {
      berlaku = p;
    }
  }
  return berlaku ? hariKerjaPekan(berlaku.hariKerja, hariPekanDari(tanggal)) : false;
}

/**
 * Tutup hari: hari yang perlu ditutup kantor pada saat `sekarang` — kemarin
 * menurut zona kantor — atau null bila sudah ditutup. Hari yang terlewat
 * (server mati beberapa malam) tidak disusul: potret dihitung dari keadaan
 * sekarang, jadi hanya kemarin yang jujur diberi label.
 */
export function hariPerluDitutup(
  sekarang: Date,
  zona: ZonaWaktu,
  tanggalTutupTerakhir: string | null,
): string | null {
  const kemarin = geserTanggal(waktuKantor(sekarang, zona).tanggal, -1);
  return tanggalTutupTerakhir === null || tanggalTutupTerakhir < kemarin ? kemarin : null;
}
