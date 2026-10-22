import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as skema from "./skema";

/**
 * Satu koneksi per proses. `prepare: false` wajib untuk pooler mode transaksi
 * (Supabase port 6543) dan tak merugikan Postgres VPS.
 */
export function buatDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { prepare: false, max: 10 });
  return { db: drizzle(sql, { schema: skema, casing: "snake_case" }), sql };
}

export type Db = ReturnType<typeof buatDb>["db"];
