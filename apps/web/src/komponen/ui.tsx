import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

/** Kartu di tengah layar untuk layar masuk, daftar, dan formulir pendek. */
export function KartuTengah({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">{judul}</h1>
        {children}
      </div>
    </main>
  );
}

export function Isian({
  label,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        {...input}
      />
    </label>
  );
}

export function Pilihan({
  label,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        {...select}
      >
        {children}
      </select>
    </label>
  );
}

export function Tombol({
  jenis = "utama",
  memuat,
  children,
  ...tombol
}: ButtonHTMLAttributes<HTMLButtonElement> & { jenis?: "utama" | "kedua"; memuat?: boolean }) {
  const gaya =
    jenis === "utama"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";
  return (
    <button
      type="button"
      {...tombol}
      disabled={memuat || tombol.disabled}
      className={`w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50 ${gaya}`}
    >
      {memuat ? "Memproses…" : children}
    </button>
  );
}

export function PesanGalat({ pesan }: { pesan: string | null | undefined }) {
  if (!pesan) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pesan}</p>;
}
