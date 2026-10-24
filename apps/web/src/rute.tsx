import { type Peran, peranSchema } from "@naelcapital/contracts";
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
import { LayarGaji } from "./layar/gaji";
import { LayarHarian } from "./layar/harian";
import { LayarKaryawan } from "./layar/karyawan";
import { LayarKas } from "./layar/kas";
import { LayarMasuk } from "./layar/masuk";
import { LayarNasabah } from "./layar/nasabah";
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
const karyawan = createRoute({
  getParentRoute: () => bos,
  path: "/karyawan",
  validateSearch: (s: Record<string, unknown>): { peran?: Peran; nonaktif?: "ya" } => ({
    peran: peranSchema.safeParse(s.peran).data,
    nonaktif: s.nonaktif === "ya" ? "ya" : undefined,
  }),
  component: LayarKaryawan,
});
const TAB_HARIAN = ["setoran", "transfer", "biaya"] as const;
const harian = createRoute({
  getParentRoute: () => bos,
  path: "/harian",
  validateSearch: (
    s: Record<string, unknown>,
  ): { tanggal?: string; tab?: (typeof TAB_HARIAN)[number] } => ({
    ...saringTanggal(s),
    tab: TAB_HARIAN.find((t) => t === s.tab),
  }),
  component: LayarHarian,
});
const kas = createRoute({
  getParentRoute: () => bos,
  path: "/kas",
  validateSearch: (
    s: Record<string, unknown>,
  ): { mulai?: string; selesai?: string; tab?: "cocok" } => ({
    mulai: tanggalSah(s.mulai),
    selesai: tanggalSah(s.selesai),
    tab: s.tab === "cocok" ? "cocok" : undefined,
  }),
  component: LayarKas,
});
const gaji = createRoute({
  getParentRoute: () => bos,
  path: "/gaji",
  validateSearch: (
    s: Record<string, unknown>,
  ): { kolektor?: string; mulai?: string; selesai?: string } => ({
    kolektor: teksSah(s.kolektor),
    mulai: tanggalSah(s.mulai),
    selesai: tanggalSah(s.selesai),
  }),
  component: LayarGaji,
});
const nasabah = createRoute({
  getParentRoute: () => bos,
  path: "/nasabah",
  validateSearch: (
    s: Record<string, unknown>,
  ): { cari?: string; kolektor?: string; pilih?: string } => ({
    cari: teksSah(s.cari),
    kolektor: teksSah(s.kolektor),
    pilih: teksSah(s.pilih),
  }),
  component: LayarNasabah,
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
  routeTree: akar.addChildren([
    bos.addChildren([beranda, aktivitas, harian, nasabah, kas, gaji, karyawan, tautkan]),
    masuk,
    daftar,
  ]),
});

// Sesi dicabut (refresh ditolak / keluar di tab lain) → muat ulang aturan rute.
sesi.dengar(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
