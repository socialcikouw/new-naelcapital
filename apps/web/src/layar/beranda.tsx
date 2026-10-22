import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Tombol } from "../komponen/ui";
import { api } from "../lib/api";
import { sesi, useSesi } from "../lib/sesi";

/** Beranda bos (sementara): kantor, dan pintu ke penautan HP karyawan. */
export function LayarBeranda() {
  const s = useSesi();
  const navigasi = useNavigate();
  const [keluarBerjalan, setKeluarBerjalan] = useState(false);
  if (!s) return null;

  const keluar = async () => {
    setKeluarBerjalan(true);
    await api.auth.keluar.$post().catch(() => null);
    sesi.hapus();
    void navigasi({ to: "/masuk" });
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{s.pengguna.kantor.nama}</h1>
          <p className="text-slate-600">
            Halo, {s.pengguna.nama} · zona {s.pengguna.kantor.zonaWaktu}
          </p>
        </div>
        <div className="w-28">
          <Tombol jenis="kedua" memuat={keluarBerjalan} onClick={() => void keluar()}>
            Keluar
          </Tombol>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">HP karyawan</h2>
        <p className="text-slate-600">
          Kasir, pengawas, dan kolektor masuk di aplikasi HP lewat QR. Minta mereka membuka layar
          "Tautkan HP ini", lalu pindai QR-nya di sini.
        </p>
        <Link
          to="/tautkan"
          className="inline-block rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800"
        >
          Tautkan HP karyawan
        </Link>
      </section>
    </main>
  );
}
