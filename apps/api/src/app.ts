import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sehatSchema } from "@naelcapital/contracts";
import { Scalar } from "@scalar/hono-api-reference";

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

/**
 * Aplikasi Hono tanpa server — diuji lewat `app.request(...)`, dijalankan
 * `server.ts`. Modul rute (kantor, pengguna, pinjaman, …) dipasang di sini.
 */
export function buatApp() {
  const app = new OpenAPIHono();

  app.openapi(sehat, (c) =>
    c.json({ status: "ok" as const, waktu: new Date().toISOString() }, 200),
  );

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Nael Capital API", version: "0.0.0" },
  });
  app.get("/dokumentasi", Scalar({ url: "/openapi.json" }));

  return app;
}

export type App = ReturnType<typeof buatApp>;
