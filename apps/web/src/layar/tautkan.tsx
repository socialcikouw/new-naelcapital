import { bakukanKode, tampilanKode } from "@naelcapital/domain";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import QrScanner from "qr-scanner";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Isian, KartuTengah, PesanGalat, Pilihan, Tombol } from "../komponen/ui";
import { api, panggil } from "../lib/api";

type PeranTertaut = "kolektor" | "kasir" | "pengawas";

/** Pemindai QR lewat kamera laptop/HP; berhenti sendiri begitu terbaca. */
function Pemindai({ onKode }: { onKode: (kode: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!video.current) return;
    const pemindai = new QrScanner(
      video.current,
      (hasil) => {
        const kode = bakukanKode(hasil.data);
        if (kode) {
          pemindai.stop();
          onKode(kode);
        }
      },
      { highlightScanRegion: true, returnDetailedScanResult: true },
    );
    pemindai.start().catch(() => setGalat("Kamera tidak bisa dibuka — ketik kodenya saja"));
    return () => pemindai.destroy();
  }, [onKode]);

  return (
    <div className="space-y-2">
      {/* biome-ignore lint/a11y/useMediaCaption: pratinjau kamera, tanpa suara */}
      <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" />
      <PesanGalat pesan={galat} />
    </div>
  );
}

/**
 * Bos menyetujui HP karyawan: kode dari pemindai atau ketikan, lalu akun baru
 * kasir / pengawas / kolektor. (Menautkan ke akun lama menyusul bersama daftar
 * pengguna.)
 */
export function LayarTautkan() {
  const [kode, setKode] = useState<string | null>(null);
  const [ketikan, setKetikan] = useState("");
  const [kamera, setKamera] = useState(false);
  const [galatKode, setGalatKode] = useState<string | null>(null);
  const [akun, setAkun] = useState({
    peran: "kolektor" as PeranTertaut,
    nama: "",
    nomorHp: "",
    resort: "",
  });

  const setujui = useMutation({
    mutationFn: async () => {
      if (!kode) throw new Error("Kode belum diisi");
      const res = await panggil(() =>
        api.auth.tautan.setujui.$post({
          json: {
            kode,
            akun: {
              peran: akun.peran,
              nama: akun.nama.trim(),
              ...(akun.nomorHp.trim() ? { nomorHp: akun.nomorHp.trim() } : {}),
              ...(akun.peran === "kolektor" && akun.resort.trim()
                ? { resort: akun.resort.trim() }
                : {}),
            },
          },
        }),
      );
      if (res.status !== 200) throw new Error("Jawaban tak terduga");
      return res.json();
    },
  });

  const pakaiKetikan = (e: FormEvent) => {
    e.preventDefault();
    const baku = bakukanKode(ketikan);
    if (!baku) {
      setGalatKode("Itu bukan kode penautan Nael Capital");
      return;
    }
    setKode(baku);
  };

  const ulang = () => {
    setKode(null);
    setKetikan("");
    setKamera(false);
    setAkun({ peran: "kolektor", nama: "", nomorHp: "", resort: "" });
    setujui.reset();
  };

  if (setujui.data) {
    return (
      <KartuTengah judul="Disetujui">
        <p className="text-slate-700">
          HP {setujui.data.perangkat.nama ?? "karyawan"} akan masuk otomatis sebagai{" "}
          <strong>{setujui.data.pengguna.nama}</strong> dalam beberapa detik.
        </p>
        <Tombol onClick={ulang}>Tautkan HP lain</Tombol>
        <Link to="/" className="block text-center text-sm text-slate-600 hover:underline">
          Kembali ke beranda
        </Link>
      </KartuTengah>
    );
  }

  if (!kode) {
    return (
      <KartuTengah judul="Tautkan HP karyawan">
        <p className="text-slate-600">
          Di HP karyawan, buka aplikasi Nael Capital — layar "Tautkan HP ini" menampilkan QR dan
          kode.
        </p>
        {kamera ? (
          <Pemindai onKode={setKode} />
        ) : (
          <Tombol onClick={() => setKamera(true)}>Pindai QR dengan kamera</Tombol>
        )}
        <form className="space-y-3" onSubmit={pakaiKetikan}>
          <Isian
            label="Atau ketik kodenya"
            placeholder="K7QM-28XD"
            autoComplete="off"
            value={ketikan}
            onChange={(e) => {
              setKetikan(e.target.value);
              setGalatKode(null);
            }}
          />
          <PesanGalat pesan={galatKode} />
          <Tombol type="submit" jenis="kedua" disabled={ketikan.trim() === ""}>
            Lanjut
          </Tombol>
        </form>
        <Link to="/" className="block text-center text-sm text-slate-600 hover:underline">
          Batal
        </Link>
      </KartuTengah>
    );
  }

  return (
    <KartuTengah judul={`Akun untuk HP ${tampilanKode(kode)}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setujui.mutate();
        }}
      >
        <Pilihan
          label="Peran"
          value={akun.peran}
          onChange={(e) => setAkun({ ...akun, peran: e.target.value as PeranTertaut })}
        >
          <option value="kolektor">Kolektor</option>
          <option value="kasir">Kasir</option>
          <option value="pengawas">Pengawas</option>
        </Pilihan>
        <Isian
          label="Nama"
          value={akun.nama}
          onChange={(e) => setAkun({ ...akun, nama: e.target.value })}
          required
        />
        <Isian
          label="Nomor HP (opsional)"
          type="tel"
          value={akun.nomorHp}
          onChange={(e) => setAkun({ ...akun, nomorHp: e.target.value })}
          placeholder="0812…"
        />
        {akun.peran === "kolektor" ? (
          <Isian
            label="Resort (opsional)"
            value={akun.resort}
            onChange={(e) => setAkun({ ...akun, resort: e.target.value })}
          />
        ) : null}
        <PesanGalat pesan={setujui.error?.message} />
        <Tombol type="submit" memuat={setujui.isPending}>
          Setujui
        </Tombol>
        <Tombol jenis="kedua" onClick={ulang}>
          Ganti kode
        </Tombol>
      </form>
    </KartuTengah>
  );
}
