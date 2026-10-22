import { buatApp } from "./app";
import { buatDb } from "./db/klien";
import { bacaEnv } from "./env";

const env = bacaEnv();
const { db } = buatDb(env.DATABASE_URL);
const app = buatApp({
  db,
  jwtRahasia: env.JWT_RAHASIA,
  sesiRahasia: env.SESI_RAHASIA,
  kodeRegistrasi: env.KODE_REGISTRASI,
});

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`Nael Capital API di http://localhost:${server.port}`);
if (!env.KODE_REGISTRASI) console.log("Registrasi kantor baru DITUTUP (KODE_REGISTRASI kosong)");
