import { StyleSheet, Text, View } from "react-native";
import { tanggalPanjang } from "../lib/format";
import { hariIniKantor } from "../lib/peran";
import { useSesi } from "../lib/sesi";
import { HURUF, TEBAL } from "./tema";
import { g, WARNA } from "./ui";

/** Kepala layar kerja kasir / pengawas: tanggal kantor, sapaan, nama kantor. */
export function KepalaPeran() {
  const s = useSesi();
  if (!s) return null;
  const { pengguna } = s;
  return (
    <View style={g.tumpuk05}>
      <Text style={gaya.tanggal}>{tanggalPanjang(hariIniKantor(pengguna.kantor.zonaWaktu))}</Text>
      <Text style={g.judul}>Halo, {pengguna.nama}</Text>
      <Text style={g.teksRedup}>{pengguna.kantor.nama}</Text>
    </View>
  );
}

const gaya = StyleSheet.create({
  tanggal: { ...HURUF.sm, fontWeight: TEBAL.sedang, color: WARNA.utama },
});
