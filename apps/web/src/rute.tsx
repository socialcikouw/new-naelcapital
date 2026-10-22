import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { LayarBeranda } from "./layar/beranda";
import { LayarDaftar } from "./layar/daftar";
import { LayarMasuk } from "./layar/masuk";
import { LayarTautkan } from "./layar/tautkan";
import { sesi } from "./lib/sesi";

const akar = createRootRoute({ component: () => <Outlet /> });

/** Layar bos: tanpa sesi → masuk. */
const wajibMasuk = () => {
  if (!sesi.ambil()) throw redirect({ to: "/masuk" });
};
/** Layar masuk/daftar: sudah masuk → beranda. */
const sudahMasuk = () => {
  if (sesi.ambil()) throw redirect({ to: "/" });
};

const beranda = createRoute({
  getParentRoute: () => akar,
  path: "/",
  beforeLoad: wajibMasuk,
  component: LayarBeranda,
});
const tautkan = createRoute({
  getParentRoute: () => akar,
  path: "/tautkan",
  beforeLoad: wajibMasuk,
  component: LayarTautkan,
});
const masuk = createRoute({
  getParentRoute: () => akar,
  path: "/masuk",
  beforeLoad: sudahMasuk,
  component: LayarMasuk,
});
const daftar = createRoute({
  getParentRoute: () => akar,
  path: "/daftar",
  beforeLoad: sudahMasuk,
  component: LayarDaftar,
});

export const router = createRouter({
  routeTree: akar.addChildren([beranda, tautkan, masuk, daftar]),
});

// Sesi dicabut (refresh ditolak / keluar di tab lain) → muat ulang aturan rute.
sesi.dengar(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
