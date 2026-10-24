import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Ikon, Kartu, Layar, Lencana, Merek, Spanduk, Tombol, WARNA } from "../komponen/ui";
import { api } from "../lib/api";
import { sesi, useSesi } from "../lib/sesi";

const NAMA_PERAN = {
  bos: "Bos",
  kasir: "Kasir",
  pengawas: "Pengawas",
  kolektor: "Kolektor",
} as const;

/** Beranda sementara kasir / pengawas: siapa yang masuk, dan keluar. */
export default function Beranda() {
  const s = useSesi();
  const [keluarBerjalan, setKeluarBerjalan] = useState(false);

  if (s === undefined) return null;
  if (s === null) return <Redirect href="/tautkan" />;
  const { pengguna } = s;

  const keluar = async () => {
    setKeluarBerjalan(true);
    // Diputus di server bila terjangkau; sesi di HP tetap dihapus walau tidak.
    await api.auth.keluar.$post().catch(() => null);
    await sesi.hapus();
    router.replace("/tautkan");
  };

  return (
    <Layar>
      <Merek />
      <Kartu>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Text className="text-lg font-bold text-emerald-800">
              {pengguna.nama.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold text-slate-900">Halo, {pengguna.nama}</Text>
            <Lencana teks={NAMA_PERAN[pengguna.peran]} warna="hijau" />
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Ikon nama="business-outline" ukuran={16} warna={WARNA.redup} />
          <Text className="text-sm text-slate-600">
            {pengguna.kantor.nama} · {pengguna.kantor.zonaWaktu}
          </Text>
        </View>
      </Kartu>

      <Spanduk
        judul="Layar kerja sedang disiapkan"
        isi={`Fitur untuk ${NAMA_PERAN[pengguna.peran].toLowerCase()} menyusul. HP ini sudah tertaut dan siap dipakai.`}
      />

      <View className="flex-1" />
      <Tombol
        judul="Keluar dari HP ini"
        jenis="bahaya"
        ikon="log-out-outline"
        memuat={keluarBerjalan}
        onPress={() =>
          Alert.alert("Keluar?", "HP ini perlu ditautkan ulang oleh bos untuk masuk lagi.", [
            { text: "Batal", style: "cancel" },
            { text: "Keluar", style: "destructive", onPress: () => void keluar() },
          ])
        }
      />
    </Layar>
  );
}
