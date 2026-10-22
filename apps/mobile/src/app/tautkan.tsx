import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Judul, Keterangan, Layar, PesanGalat, Tombol } from "../komponen/ui";
import { api, panggil } from "../lib/api";
import { infoPerangkat } from "../lib/perangkat";
import { sesi } from "../lib/sesi";

/** Jeda bertanya ke server selama menunggu bos memindai. */
const JEDA_TANYA_MS = 2000;

interface Tautan {
  id: string;
  kode: string;
  qr: string;
  klaim: string;
  kedaluwarsaAt: string;
}

/**
 * HP kasir / pengawas / kolektor: minta kode, tampilkan QR, lalu bertanya
 * berulang sampai bos menyetujui — sesi diambil dengan kunci klaim yang hanya
 * dipegang HP ini.
 */
export default function Tautkan() {
  const [tautan, setTautan] = useState<Tautan | null>(null);
  const [status, setStatus] = useState<"memuat" | "menunggu" | "kedaluwarsa">("memuat");
  const [galat, setGalat] = useState<string | null>(null);
  const [sisaDetik, setSisaDetik] = useState(0);
  const aktif = useRef(true);

  const minta = useCallback(async () => {
    setStatus("memuat");
    setGalat(null);
    try {
      const res = await panggil(() =>
        api.auth.tautan.$post({ json: { perangkat: infoPerangkat() } }),
      );
      if (res.status !== 201) throw new Error("Jawaban tak terduga");
      setTautan(await res.json());
      setStatus("menunggu");
    } catch (e) {
      setGalat((e as Error).message);
      setStatus("kedaluwarsa");
    }
  }, []);

  useEffect(() => {
    aktif.current = true;
    void minta();
    return () => {
      aktif.current = false;
    };
  }, [minta]);

  // Hitung mundur sampai kode kedaluwarsa.
  useEffect(() => {
    if (!tautan || status !== "menunggu") return;
    const hitung = () =>
      setSisaDetik(Math.max(0, Math.round((Date.parse(tautan.kedaluwarsaAt) - Date.now()) / 1000)));
    hitung();
    const j = setInterval(hitung, 1000);
    return () => clearInterval(j);
  }, [tautan, status]);

  // Bertanya berulang: menunggu → (disetujui bos) → tertaut.
  useEffect(() => {
    if (!tautan || status !== "menunggu") return;
    let berhenti = false;
    const tanya = async () => {
      try {
        const res = await panggil(() =>
          api.auth.tautan[":id"].klaim.$post({
            param: { id: tautan.id },
            json: { klaim: tautan.klaim },
          }),
        );
        if (res.status !== 200 || berhenti || !aktif.current) return;
        setGalat(null);
        const hasil = await res.json();
        if (hasil.status === "tertaut") {
          berhenti = true;
          await sesi.simpan({
            tokenAkses: hasil.tokenAkses,
            tokenSegar: hasil.tokenSegar,
            pengguna: hasil.pengguna,
          });
          router.replace("/beranda");
        } else if (hasil.status === "kedaluwarsa") {
          setStatus("kedaluwarsa");
        }
      } catch (e) {
        // Sinyal putus sesaat: coba lagi di putaran berikutnya.
        setGalat((e as Error).message);
      }
    };
    const j = setInterval(() => void tanya(), JEDA_TANYA_MS);
    return () => {
      berhenti = true;
      clearInterval(j);
    };
  }, [tautan, status]);

  return (
    <Layar>
      <Judul>Tautkan HP ini</Judul>
      <Keterangan>
        Minta bos memindai QR ini dari HP-nya, atau mengetik kodenya. HP ini masuk otomatis begitu
        disetujui.
      </Keterangan>

      {status === "menunggu" && tautan ? (
        <View className="items-center gap-4 rounded-2xl border border-slate-200 p-6">
          <QRCode value={tautan.qr} size={220} />
          <Text className="font-mono text-3xl font-bold tracking-widest text-slate-900">
            {tautan.kode}
          </Text>
          <Text className="text-sm text-slate-500">
            Berlaku {Math.floor(sisaDetik / 60)}:{String(sisaDetik % 60).padStart(2, "0")} lagi
          </Text>
        </View>
      ) : null}

      {status === "kedaluwarsa" ? (
        <View className="gap-3">
          <Keterangan>Kode sudah tidak berlaku.</Keterangan>
          <Tombol judul="Minta kode baru" onPress={() => void minta()} />
        </View>
      ) : null}

      <PesanGalat pesan={galat} />
      <Tombol judul="Kembali" jenis="kedua" onPress={() => router.back()} />
    </Layar>
  );
}
