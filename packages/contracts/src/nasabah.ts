import { z } from "zod";
import { nomorHpSchema } from "./auth";
import { kampungSchema } from "./lapangan";

/**
 * KELOLA NASABAH — daftar & cari, sunting identitas (bos), pindah pemegang
 * (bos), titik rumah (bos / kolektor pemegang). Docs: schema-nasabah.md.
 */

const orang = z.object({ id: z.uuid(), nama: z.string() });

/** `GET /nasabah` — kolektor: pegangannya; kasir: nama & kampung saja. */
export const saringNasabahSchema = z.object({
  cari: z.string().trim().min(1).max(50).optional(),
  kolektorId: z.uuid().optional(),
  /** `ya` = boleh meminjam lagi: tanpa pinjaman aktif & tak diblokir. */
  bebas: z.enum(["ya"]).optional(),
});

export const lokasiRumahSchema = z.object({
  latitude: z.number().min(-11).max(6),
  longitude: z.number().min(95).max(141),
  akurasiMeter: z.number().int().positive().max(32_767),
});
export type LokasiRumahInput = z.infer<typeof lokasiRumahSchema>;

/**
 * Satu nasabah. Kolom yang tak boleh dilihat peran pembaca bernilai null:
 * kasir hanya nama & kampung; NIK tersamar selain untuk bos.
 */
export const nasabahSchema = z.object({
  id: z.uuid(),
  nama: z.string(),
  kampung: orang,
  kolektor: orang.nullable(),
  nomorHp: z.string().nullable(),
  nik: z.string().nullable(),
  saldoTabungan: z.number().nullable(),
  diblokir: z.boolean().nullable(),
  pinjamanAktif: z
    .object({ id: z.uuid(), status: z.enum(["berjalan", "macet"]), saldo: z.number() })
    .nullable(),
  lokasi: lokasiRumahSchema.nullable(),
});
export type NasabahJawaban = z.infer<typeof nasabahSchema>;

/** `PATCH /nasabah/:id` — identitas; `null` menghapus nomor HP / NIK. */
export const ubahNasabahSchema = z
  .object({
    nama: z.string().trim().min(1).max(50).optional(),
    kampung: kampungSchema.optional(),
    nomorHp: nomorHpSchema.nullable().optional(),
    nik: z
      .string()
      .regex(/^[0-9]{16}$/, "NIK 16 digit")
      .nullable()
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Isi paling sedikit satu kolom");
export type UbahNasabahInput = z.infer<typeof ubahNasabahSchema>;

/** `POST /nasabah/:id/pindah` — pindah pemegang. */
export const pindahPemegangSchema = z.object({ kolektorId: z.uuid() });
