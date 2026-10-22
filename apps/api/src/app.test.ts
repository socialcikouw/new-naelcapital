import { describe, expect, test } from "bun:test";
import { sehatSchema } from "@naelcapital/contracts";
import { buatApp } from "./app";
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
  test("PORT bawaan 3000", () => {
    expect(bacaEnv({}).PORT).toBe(3000);
  });

  test("PORT tidak sah ditolak", () => {
    expect(() => bacaEnv({ PORT: "bukan-angka" })).toThrow("Variabel lingkungan tidak sah");
  });
});
