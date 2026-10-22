import { describe, expect, test } from "bun:test";
import { sehatSchema } from "@naelcapital/contracts";
import { buatApp } from "./app";
import { pastikanDatabasePengembangan } from "./db/penjaga";
import { bacaEnv } from "./env";

describe("app", () => {
  const app = buatApp();

  test("GET /sehat menjawab sesuai kontrak", async () => {
    const res = await app.request("/sehat");
    expect(res.status).toBe(200);
    expect(sehatSchema.safeParse(await res.json()).success).toBe(true);
  });

  test("dokumen OpenAPI memuat rute /sehat", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain("/sehat");
  });
});

describe("env", () => {
  const DATABASE_URL = "postgresql://u:p@db.contoh.supabase.com:6543/postgres";

  test("PORT bawaan 3000", () => {
    expect(bacaEnv({ DATABASE_URL }).PORT).toBe(3000);
  });

  test("PORT tidak sah ditolak", () => {
    expect(() => bacaEnv({ DATABASE_URL, PORT: "bukan-angka" })).toThrow(
      "Variabel lingkungan tidak sah",
    );
  });

  test("DATABASE_URL wajib dan harus postgres", () => {
    expect(() => bacaEnv({})).toThrow("Variabel lingkungan tidak sah");
    expect(() => bacaEnv({ DATABASE_URL: "mysql://u:p@h/db" })).toThrow(
      "Variabel lingkungan tidak sah",
    );
  });
});

describe("penjaga database pengembangan", () => {
  test("hanya Supabase yang diizinkan", () => {
    expect(() =>
      pastikanDatabasePengembangan("postgresql://u:p@x.pooler.supabase.com:6543/postgres"),
    ).not.toThrow();
    expect(() => pastikanDatabasePengembangan("postgresql://u:p@10.0.0.5:5432/nael")).toThrow(
      "bukan Supabase pengembangan",
    );
    expect(() => pastikanDatabasePengembangan(undefined)).toThrow("tidak sah");
  });
});
