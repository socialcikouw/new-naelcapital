import { buatApp } from "./app";
import { bacaEnv } from "./env";

const env = bacaEnv();
const app = buatApp();

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`Nael Capital API di http://localhost:${server.port}`);
