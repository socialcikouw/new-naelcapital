import { timestamp } from "drizzle-orm/pg-core";

/** `timestamptz` — semua kolom `*_at` (konvensi #9). */
export const waktu = () => timestamp({ withTimezone: true, mode: "date" });

/**
 * `dibuat_at` + `diubah_at` standar (fungsi: setiap tabel butuh builder
 * kolomnya sendiri). `diubah_at` disentuh trigger `atur_diubah_at`.
 */
export const jejakWaktu = () => ({
  dibuatAt: waktu().notNull().defaultNow(),
  diubahAt: waktu().notNull().defaultNow(),
});
