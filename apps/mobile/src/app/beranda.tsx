import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Judul, Keterangan, Layar, Tombol } from "../komponen/ui";
import { api } from "../lib/api";
import { sesi, useSesi } from "../lib/sesi";

const NAMA_PERAN = {
  bos: "Bos",
  kasir: "Kasir",
  pengawas: "Pengawas",
  kolektor: "Kolektor",
} as const;

/** Beranda sementara kasir / pengawas / kolektor: siapa yang masuk, dan keluar. */
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
      <Judul>Halo, {pengguna.nama}</Judul>
      <View className="gap-1 rounded-2xl bg-slate-50 p-4">
        <Text className="text-base font-semibold text-slate-900">{pengguna.kantor.nama}</Text>
        <Text className="text-sm text-slate-600">
          {NAMA_PERAN[pengguna.peran]} · zona {pengguna.kantor.zonaWaktu}
        </Text>
      </View>

      <Keterangan>Layar kerja menyusul.</Keterangan>

      <View className="flex-1" />
      <Tombol judul="Keluar" jenis="kedua" memuat={keluarBerjalan} onPress={() => void keluar()} />
    </Layar>
  );
}
