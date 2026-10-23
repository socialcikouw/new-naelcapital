import { fileURLToPath } from "node:url";
import { createRoute } from "@hono/zod-openapi";
import { sehatSchema } from "@naelcapital/contracts";
import { Scalar } from "@scalar/hono-api-reference";
import { BATAS_BAWAAN, type BatasPercobaan } from "./batas";
import type { Db } from "./db/klien";
import { tanganiGalat } from "./galat";
import { buatLayananAuth } from "./modul/auth/layanan";
import { ruteAuth } from "./modul/auth/rute";
import { buatLayananFoto } from "./modul/foto/layanan";
import { ruteFoto } from "./modul/foto/rute";
import { buatLayananLapangan } from "./modul/lapangan/layanan";
import { ruteLapangan } from "./modul/lapangan/rute";
import { buatLayananSetoranSore } from "./modul/setoran-sore/layanan";
import { ruteSetoranSore } from "./modul/setoran-sore/rute";
import { buatLayananTautan } from "./modul/tautan/layanan";
import { ruteTautan } from "./modul/tautan/rute";
import { type Penyimpanan, penyimpananDisk } from "./penyimpanan";
import { buatRouter } from "./router";

const sehat = createRoute({
  method: "get",
  path: "/sehat",
  tags: ["sistem"],
  summary: "Server hidup dan menjawab",
  responses: {
    200: {
      description: "Server sehat",
      content: { "application/json": { schema: sehatSchema } },
    },
  },
});

export interface AppDeps {
  db: Db;
  jwtRahasia: string;
  sesiRahasia: string;
  kodeRegistrasi?: string | undefined;
  /** Jam — diganti di uji. */
  sekarang?: () => Date;
  /** Di belakang Nginx: alamat klien dibaca dari header proxy. */
  percayaProxy?: boolean;
  /** Batas percobaan masuk — bawaan `BATAS_BAWAAN`. */
  batas?: BatasPercobaan;
  /** Penyimpanan berkas foto — bawaan disk `apps/api/.berkas/`. */
  penyimpanan?: Penyimpanan;
}

/**
 * Aplikasi Hono tanpa server — diuji lewat `app.request(...)`, dijalankan
 * `server.ts`. Modul rute dipasang di sini; tipenya (`App`) dipakai klien
 * RPC `hc` di aplikasi.
 */
export function buatApp(deps: AppDeps) {
  const auth = buatLayananAuth(deps);
  const tautan = buatLayananTautan({ db: deps.db, auth, sekarang: deps.sekarang });
  const lapangan = buatLayananLapangan({ db: deps.db, sekarang: deps.sekarang });
  const setoranSore = buatLayananSetoranSore({ db: deps.db, sekarang: deps.sekarang });
  const foto = buatLayananFoto({
    db: deps.db,
    penyimpanan:
      deps.penyimpanan ?? penyimpananDisk(fileURLToPath(new URL("../.berkas", import.meta.url))),
    sekarang: deps.sekarang,
  });
  const opsi = { batas: deps.batas ?? BATAS_BAWAAN, percayaProxy: deps.percayaProxy ?? false };

  const app = buatRouter()
    .openapi(sehat, (c) => c.json({ status: "ok" as const, waktu: new Date().toISOString() }, 200))
    .route("/", ruteAuth(auth, opsi))
    .route("/", ruteTautan(tautan, auth, opsi))
    .route("/", ruteLapangan(lapangan, auth))
    .route("/", ruteFoto(foto, auth))
    .route("/", ruteSetoranSore(setoranSore, auth));

  app.onError(tanganiGalat);
  app.openAPIRegistry.registerComponent("securitySchemes", "bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Nael Capital API", version: "0.0.0" },
  });
  app.get("/dokumentasi", Scalar({ url: "/openapi.json" }));

  return app;
}

export type App = ReturnType<typeof buatApp>;
