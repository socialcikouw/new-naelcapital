import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/skema/index.ts",
  out: "./src/db/migrasi",
  casing: "snake_case",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: drizzle-kit hanya dijalankan dengan .env terisi
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
