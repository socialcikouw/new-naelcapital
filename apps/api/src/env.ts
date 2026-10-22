import { z } from "zod";

/**
 * Variabel lingkungan, diperiksa sekali saat server menyala — `.env` yang
 * kurang atau salah membuat server menolak menyala, bukan gagal di tengah
 * jalan. Bun memuat `.env` sendiri.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Postgres: Supabase saat pengembangan, Postgres VPS di produksi. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;

export function bacaEnv(sumber: Record<string, string | undefined> = process.env): Env {
  const hasil = envSchema.safeParse(sumber);
  if (!hasil.success) {
    throw new Error(`Variabel lingkungan tidak sah:\n${z.prettifyError(hasil.error)}`);
  }
  return hasil.data;
}
