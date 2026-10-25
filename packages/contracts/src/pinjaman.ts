import { z } from "zod";
import { pinjamanSchema } from "./lapangan";

/**
 * PINJAMAN — kartu & rincian untuk bos, pengawas, dan kolektor (pegangannya),
 * sunting nomor urut (bos), garis waktu status. Docs: schema-pinjaman.md,
 * schema-riwayat-status-pinjaman.md; posisi tagih: aturan-usaha B5.
 */

const orang = z.object({ id: z.uuid(), nama: z.string() });
export const statusPinjamanSchema = pinjamanSchema.shape.status;

/** `GET /pinjaman` — bawaan pinjaman aktif (berjalan & macet). */
export const saringPinjamanSchema = z.object({
  status: z.enum(["aktif", "selesai", "semua"]).default("aktif"),
  nasabahId: z.uuid().optional(),
  /** Pemegang (bos & pengawas). */
  kolektorId: z.uuid().optional(),
});

/** B5 — tertinggal & tunggakan hari ini (hari ini belum dihitung lewat). */
export const posisiTagihSchema = z.object({
  tertinggal: z.number(),
  tunggakan: z.number(),
});

/** Rem gulung yang berlaku untuk nasabah ini (gabungan kantor, pemegang, nasabah). */
export const kunciGulungSchema = z.object({
  gulung: z.boolean(),
  naik: z.boolean(),
  alasan: z.string().nullable(),
});

export const kartuPinjamanSchema = pinjamanSchema.extend({
  /** Pemegang nasabah saat ini. */
  kolektor: orang,
  tanggalSelesai: z.string().nullable(),
  /** `null` bila pinjaman tidak aktif. */
  tagih: posisiTagihSchema.nullable(),
  kunciGulung: kunciGulungSchema.nullable(),
});
export type KartuPinjaman = z.infer<typeof kartuPinjamanSchema>;

/**
 * Aturan macet (aturan-usaha F) dengan jendela 30 hari yang berakhir hari ini
 * — yang akan dinilai sapuan malam ini bila tak ada setoran lagi.
 */
export const aturanMacetSchema = z.object({
  jendelaAwal: z.string(),
  jendelaAkhir: z.string(),
  setoranJendela: z.number(),
  /** Harian & mingguan: setoran minimal dalam jendela. */
  ambang: z.number().nullable(),
  /** Harian: hari tagih dalam jendela sejak mulai ditagih (dinilai bila ≥ 15). */
  hariTagih: z.number().nullable(),
  /** Tempoan: macet bila lewat tanggal ini (jatuh tempo + 7). */
  batasTempoan: z.string().nullable(),
  dievaluasi: z.boolean(),
  statusMalamIni: z.enum(["berjalan", "macet"]),
});

export const rincianPinjamanSchema = kartuPinjamanSchema.extend({
  pencair: orang,
  tanggalDisalin: z.string().nullable(),
  tanggalMacet: z.string().nullable(),
  pinjamanAsalId: z.uuid().nullable(),
  jenisGulung: z.enum(["tetap", "naik", "turun"]).nullable(),
  saldoLama: z.number(),
  saldoAwal: z.number(),
  dropBaru: z.number(),
  dropGulung: z.number(),
  pokokBerkurang: z.number(),
  fotoSerahTerimaId: z.uuid().nullable(),
  pemutihan: z
    .object({
      at: z.string(),
      alasan: z.enum(["macet_lama", "meninggal", "lainnya"]),
      keterangan: z.string().nullable(),
    })
    .nullable(),
  batal: z.object({ at: z.string(), alasan: z.string() }).nullable(),
  /** `null` bila pinjaman tidak aktif. */
  aturanMacet: aturanMacetSchema.nullable(),
});
export type RincianPinjaman = z.infer<typeof rincianPinjamanSchema>;

/** `PATCH /pinjaman/:id` — hanya nomor urut (identitas lewat `PATCH /nasabah/:id`). */
export const ubahPinjamanSchema = z.object({ pinjamanKe: z.number().int().positive() });

/** `GET /pinjaman/:id/riwayat-status` — satu perpindahan status. */
export const riwayatStatusSchema = z.object({
  id: z.uuid(),
  /** `null` = baris kelahiran pinjaman. */
  statusSebelum: statusPinjamanSchema.nullable(),
  statusSesudah: statusPinjamanSchema,
  tanggal: z.string(),
  dibuatAt: z.string(),
});
