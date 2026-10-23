import { z } from "zod";

/**
 * PENGATURAN KANTOR (web bos; dibaca semua peran) — profil kantor, pekan
 * kerja bertanggal, rem (kebijakan), libur kantor, tarif gaji bertanggal.
 * Docs: schema-kantor.md, schema-pekan-kerja.md, schema-kebijakan.md,
 * schema-libur-kantor.md, schema-tarif-gaji.md.
 */

const tanggal = z.iso.date();
const orang = z.object({ id: z.uuid(), nama: z.string() });
const jam = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$/, "Jam HH:MM");
/** Hari dalam pekan: 0 = Minggu … 6 = Sabtu. */
const hariKerja = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Paling sedikit satu hari kerja")
  .refine((h) => new Set(h).size === h.length, "Hari tidak boleh kembar");

// ---- kantor & pekan kerja ------------------------------------------------------

export const kantorSchema = z.object({
  id: z.uuid(),
  nama: z.string(),
  zonaWaktu: z.enum(["WIB", "WITA", "WIT"]),
  /** Pola yang berlaku hari ini. */
  hariKerja: z.array(z.number()),
  jamBuka: z.string(),
  jamTutup: z.string(),
});

/** `PATCH /kantor` — buka < tutup; "24:00" boleh untuk tutup. */
export const ubahKantorSchema = z
  .object({
    nama: z.string().trim().min(1).max(100).optional(),
    zonaWaktu: z.enum(["WIB", "WITA", "WIT"]).optional(),
    jamBuka: jam.optional(),
    jamTutup: jam.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Isi paling sedikit satu kolom");
export type UbahKantorInput = z.infer<typeof ubahKantorSchema>;

/** `PUT /kantor/pekan-kerja` — bawaan berlaku hari ini; tidak boleh mundur. */
export const pekanKerjaInputSchema = z.object({ hariKerja, berlakuMulai: tanggal.optional() });
export type PekanKerjaInput = z.infer<typeof pekanKerjaInputSchema>;

export const pekanKerjaSchema = z.object({
  berlakuMulai: z.string(),
  hariKerja: z.array(z.number()),
  dibuatOleh: orang,
});

// ---- kebijakan (rem bos) -------------------------------------------------------

/** `PUT /kebijakan/kantor` & `/kebijakan/kolektor/:id` — semua mati = rem dilepas. */
export const remInputSchema = z.object({
  pinjamanBaruDikunci: z.boolean(),
  naikPinjamanDikunci: z.boolean(),
  gulungPinjamanDikunci: z.boolean(),
  alasanKunci: z.string().trim().min(1).max(100).nullish(),
});
export type RemInput = z.infer<typeof remInputSchema>;

/** `PUT /kebijakan/nasabah/:id` — tanpa saklar pinjaman baru (urusan blokir). */
export const remNasabahInputSchema = remInputSchema.omit({ pinjamanBaruDikunci: true });
export type RemNasabahInput = z.infer<typeof remNasabahInputSchema>;

/** Rem yang berlaku bagi pembaca (kolektor: gabungan kantor + dirinya). */
export const remBerlakuSchema = z.object({
  pinjamanBaruDikunci: z.boolean(),
  naikPinjamanDikunci: z.boolean(),
  gulungPinjamanDikunci: z.boolean(),
  alasanKunci: z.string().nullable(),
});

/** Satu rem yang menyala, dengan lapis & sasarannya. */
export const remAktifSchema = z.object({
  lapis: z.enum(["kantor", "kolektor", "nasabah"]),
  sasaran: orang.nullable(),
  pinjamanBaruDikunci: z.boolean(),
  naikPinjamanDikunci: z.boolean(),
  gulungPinjamanDikunci: z.boolean(),
  alasanKunci: z.string().nullable(),
  diubahOleh: orang,
});

// ---- libur kantor --------------------------------------------------------------

export const saringLiburKantorSchema = z.object({
  tanggalMulai: tanggal.optional(),
  tanggalSelesai: tanggal.optional(),
});

/** `POST /libur-kantor` — rentang dipecah per tanggal; yang sudah ada dilewati. */
export const liburKantorInputSchema = z.object({
  tanggalMulai: tanggal,
  tanggalSelesai: tanggal.optional(),
  alasan: z.string().trim().min(1).max(100),
});
export type LiburKantorInput = z.infer<typeof liburKantorInputSchema>;

export const liburKantorSchema = z.object({ tanggal: z.string(), alasan: z.string() });

export const hasilLiburKantorSchema = z.object({
  ditambah: z.array(z.string()),
  dilewati: z.array(z.string()),
});

// ---- tarif gaji ----------------------------------------------------------------

/**
 * `PUT /tarif-gaji` — tanpa `kolektorId` = tarif kantor (wajib berpersen);
 * dengan `kolektorId`, `tarifBp: null` = kembali ikut tarif kantor.
 */
export const tarifInputSchema = z.object({
  kolektorId: z.uuid().optional(),
  tarifBp: z.number().int().min(0).max(10_000).nullable(),
  berlakuMulai: tanggal.optional(),
});
export type TarifInput = z.infer<typeof tarifInputSchema>;

export const tarifSchema = z.object({
  id: z.uuid(),
  kolektor: orang.nullable(),
  tarifBp: z.number().nullable(),
  berlakuMulai: z.string(),
});

export const saringTarifBerlakuSchema = z.object({ kolektorId: z.uuid().optional() });

export const tarifBerlakuSchema = z.object({
  tarifBp: z.number(),
  sumber: z.enum(["kolektor", "kantor"]),
});
