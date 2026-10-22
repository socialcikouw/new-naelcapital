import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Judul, Keterangan, Layar } from "../komponen/ui";
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
        <Judul>Alamat API belum diatur</Judul>
        <Keterangan>
          Isi EXPO_PUBLIC_API_URL di apps/mobile/.env dengan alamat server (IP laptop di jaringan
          yang sama), lalu jalankan ulang Metro.
        </Keterangan>
      </Layar>
    );
  }
  if (s === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={s ? "/beranda" : "/tautkan"} />;
}
