import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { g, Ikon, Kartu, Layar, Lencana, Merek, Spanduk, Tombol, WARNA } from "../komponen/ui";
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
        <View style={g.baris3}>
          <View style={g.avatar}>
            <Text style={g.avatarHuruf}>{pengguna.nama.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={[g.isi, g.tumpuk1]}>
            <Text style={g.subjudul}>Halo, {pengguna.nama}</Text>
            <Lencana teks={NAMA_PERAN[pengguna.peran]} warna="hijau" />
          </View>
        </View>
        <View style={g.baris2}>
          <Ikon nama="business-outline" ukuran={16} warna={WARNA.redup} />
          <Text style={g.teksKecil}>
            {pengguna.kantor.nama} · {pengguna.kantor.zonaWaktu}
          </Text>
        </View>
      </Kartu>

      <Spanduk
        judul="Layar kerja sedang disiapkan"
        isi={`Fitur untuk ${NAMA_PERAN[pengguna.peran].toLowerCase()} menyusul. HP ini sudah tertaut dan siap dipakai.`}
      />

      <View style={g.isi} />
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
