import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ikon, Judul, Keterangan, Merek, PesanGalat, Tombol, WARNA } from "../komponen/ui";
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

const LANGKAH = [
  "Bos membuka web Nael Capital → menu Tautkan HP.",
  "Bos memindai QR di bawah, atau mengetik kodenya.",
  "HP ini masuk sendiri begitu disetujui.",
];

function Langkah() {
  return (
    <View className="gap-3">
      {LANGKAH.map((teks, i) => (
        <View key={teks} className="flex-row items-start gap-3">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
            <Text className="text-sm font-bold text-emerald-800">{i + 1}</Text>
          </View>
          <Text className="flex-1 pt-0.5 text-base leading-6 text-slate-700">{teks}</Text>
        </View>
      ))}
    </View>
  );
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
  const [sinyalPutus, setSinyalPutus] = useState(false);
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
    const hitung = () => {
      const sisa = Math.max(0, Math.round((Date.parse(tautan.kedaluwarsaAt) - Date.now()) / 1000));
      setSisaDetik(sisa);
      if (sisa === 0) setStatus("kedaluwarsa");
    };
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
        setSinyalPutus(false);
        const hasil = await res.json();
        if (hasil.status === "tertaut") {
          berhenti = true;
          await sesi.simpan({
            tokenAkses: hasil.tokenAkses,
            tokenSegar: hasil.tokenSegar,
            pengguna: hasil.pengguna,
          });
          router.replace(hasil.pengguna.peran === "kolektor" ? "/kolektor" : "/beranda");
        } else if (hasil.status === "kedaluwarsa") {
          setStatus("kedaluwarsa");
        }
      } catch {
        // Sinyal putus sesaat: coba lagi di putaran berikutnya.
        setSinyalPutus(true);
      }
    };
    const j = setInterval(() => void tanya(), JEDA_TANYA_MS);
    return () => {
      berhenti = true;
      clearInterval(j);
    };
  }, [tautan, status]);

  const menit = Math.floor(sisaDetik / 60);
  const detik = String(sisaDetik % 60).padStart(2, "0");

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="gap-6 px-5 pt-4 pb-10">
        <Merek />
        <View className="gap-2">
          <Judul>Tautkan HP ini</Judul>
          <Keterangan>
            HP kasir, pengawas, dan kolektor masuk tanpa kata sandi — cukup disetujui bos.
          </Keterangan>
        </View>
        <Langkah />

        <View className="items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200">
          {status === "menunggu" && tautan ? (
            <>
              <View className="rounded-2xl bg-white p-3">
                <QRCode value={tautan.qr} size={208} />
              </View>
              <View className="items-center gap-1">
                <Text className="text-xs font-medium tracking-wider text-slate-500">
                  ATAU KETIK KODE
                </Text>
                <Text
                  selectable
                  className="font-mono text-3xl font-bold tracking-[4px] text-slate-900"
                >
                  {tautan.kode}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 rounded-full bg-emerald-50 px-4 py-2">
                <ActivityIndicator size="small" color={WARNA.utama} />
                <Text className="text-sm font-medium text-emerald-800">
                  Menunggu persetujuan bos · {menit}:{detik}
                </Text>
              </View>
              {sinyalPutus ? (
                <View className="flex-row items-center gap-2">
                  <Ikon nama="cloud-offline-outline" ukuran={16} warna="#b45309" />
                  <Text className="text-sm text-amber-700">Sinyal terputus — terus mencoba…</Text>
                </View>
              ) : null}
            </>
          ) : status === "memuat" ? (
            <View className="h-64 items-center justify-center gap-3">
              <ActivityIndicator color={WARNA.utama} />
              <Text className="text-sm text-slate-500">Meminta kode…</Text>
            </View>
          ) : (
            <View className="w-full items-center gap-4 py-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Ikon nama="time-outline" ukuran={28} warna={WARNA.redup} />
              </View>
              <View className="items-center gap-1">
                <Text className="text-lg font-bold text-slate-900">
                  {galat ? "Kode tidak bisa diminta" : "Kode sudah tidak berlaku"}
                </Text>
                <Text className="text-center text-sm text-slate-600">
                  Minta kode baru, lalu tunjukkan ke bos.
                </Text>
              </View>
              <View className="w-full">
                <Tombol judul="Minta kode baru" ikon="refresh" onPress={() => void minta()} />
              </View>
            </View>
          )}
        </View>

        <PesanGalat pesan={galat} />
      </ScrollView>
    </SafeAreaView>
  );
}
