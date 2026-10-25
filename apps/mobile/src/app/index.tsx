import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { RUANG } from "../komponen/tema";
import { g, Judul, Keterangan, Layar, Merek, Spanduk, WARNA } from "../komponen/ui";
import { ALAMAT_API } from "../lib/api";
import { useSesi } from "../lib/sesi";

/**
 * Pintu masuk: HP yang belum tertaut langsung ke layar penautan QR — aplikasi
 * HP khusus kasir, pengawas, kolektor; tidak ada login nomor HP + kata sandi.
 */
export default function Pintu() {
  const s = useSesi();

  if (!ALAMAT_API) {
    return (
      <Layar>
        <Merek />
        <Judul>Alamat server belum diatur</Judul>
        <Spanduk
          judul="Untuk pengembang"
          isi="Isi EXPO_PUBLIC_API_URL di apps/mobile/.env dengan alamat server (IP laptop di jaringan yang sama), lalu jalankan ulang Metro."
        />
        <Keterangan>Hubungi pengelola aplikasi bila pesan ini muncul di HP kerja.</Keterangan>
      </Layar>
    );
  }
  if (s === undefined) {
    return (
      <View style={[g.memuat, { gap: RUANG[6] }]}>
        <Merek besar />
        <ActivityIndicator color={WARNA.utama} />
      </View>
    );
  }
  if (!s) return <Redirect href="/tautkan" />;
  return <Redirect href={s.pengguna.peran === "kolektor" ? "/kolektor" : "/beranda"} />;
}
