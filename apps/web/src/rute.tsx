import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Kerangka } from "./komponen/kerangka";
import { LayarAktivitas } from "./layar/aktivitas";
import { LayarBeranda } from "./layar/beranda";
import { LayarDaftar } from "./layar/daftar";
import { LayarMasuk } from "./layar/masuk";
import { LayarTautkan } from "./layar/tautkan";
import { tanggalSah, teksSah } from "./lib/kantor";
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

/** Kerangka semua layar bos (menu + isi); id rute anak diawali `/bos`. */
const bos = createRoute({
  getParentRoute: () => akar,
  id: "bos",
  beforeLoad: wajibMasuk,
  component: Kerangka,
});

/** Saringan pencarian — semua kunci opsional supaya tautan tanpa `search` tetap sah. */
const saringTanggal = (s: Record<string, unknown>): { tanggal?: string } => ({
  tanggal: tanggalSah(s.tanggal),
});

const beranda = createRoute({
  getParentRoute: () => bos,
  path: "/",
  validateSearch: saringTanggal,
  component: LayarBeranda,
});
const aktivitas = createRoute({
  getParentRoute: () => bos,
  path: "/aktivitas",
  validateSearch: (s: Record<string, unknown>): { tanggal?: string; pelaku?: string } => ({
    ...saringTanggal(s),
    pelaku: teksSah(s.pelaku),
  }),
  component: LayarAktivitas,
});
const tautkan = createRoute({
  getParentRoute: () => bos,
  path: "/tautkan",
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
  routeTree: akar.addChildren([bos.addChildren([beranda, aktivitas, tautkan]), masuk, daftar]),
});

// Sesi dicabut (refresh ditolak / keluar di tab lain) → muat ulang aturan rute.
sesi.dengar(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
