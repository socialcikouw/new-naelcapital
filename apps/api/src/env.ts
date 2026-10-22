import { z } from "zod";

const rahasia = (nama: string) =>
  z.string().min(32, `${nama} minimal 32 karakter acak (mis. \`openssl rand -base64 48\`)`);

/**
 * Variabel lingkungan, diperiksa sekali saat server menyala — `.env` yang
 * kurang atau salah membuat server menolak menyala, bukan gagal di tengah
 * jalan. Bun memuat `.env` sendiri.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Postgres: Supabase saat pengembangan, Postgres VPS di produksi. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Kunci tanda tangan token akses (JWT HS256). */
  JWT_RAHASIA: rahasia("JWT_RAHASIA"),
  /** Kunci HMAC token segar per perangkat — beda dengan JWT_RAHASIA. */
  SESI_RAHASIA: rahasia("SESI_RAHASIA"),
  /**
   * Kode untuk membuka kantor baru (`POST /auth/register`). Kosong =
   * registrasi ditutup: tanpa ini siapa pun yang tahu alamat API bisa membuat
   * "kantor" sendiri di server ini.
   */
  KODE_REGISTRASI: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
});

export type Env = z.infer<typeof envSchema>;

export function bacaEnv(sumber: Record<string, string | undefined> = process.env): Env {
  const hasil = envSchema.safeParse(sumber);
  if (!hasil.success) {
    throw new Error(`Variabel lingkungan tidak sah:\n${z.prettifyError(hasil.error)}`);
  }
  return hasil.data;
}
