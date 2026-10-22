import { bakukanKode, tampilanKode } from "@naelcapital/domain";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Isian, Judul, Keterangan, Layar, PesanGalat, Tombol } from "../komponen/ui";

/** Bos memindai QR di HP karyawan — atau mengetik kodenya bila kamera bermasalah. */
export default function Pindai() {
  const [izin, mintaIzin] = useCameraPermissions();
  const [ketikan, setKetikan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const sudahTerbaca = useRef(false);

  const lanjut = (masukan: string) => {
    const kode = bakukanKode(masukan);
    if (!kode) {
      setGalat("Itu bukan QR atau kode penautan Nael Capital");
      return false;
    }
    router.replace({ pathname: "/setujui", params: { kode: tampilanKode(kode) } });
    return true;
  };

  return (
    <Layar>
      <Judul>Pindai QR</Judul>

      {izin?.granted ? (
        <View className="h-72 overflow-hidden rounded-2xl bg-black">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              // Kamera membaca QR yang sama berkali-kali per detik.
              if (sudahTerbaca.current) return;
              if (lanjut(data)) sudahTerbaca.current = true;
            }}
          />
        </View>
      ) : (
        <View className="gap-2">
          <Keterangan>Izinkan kamera untuk memindai QR di HP karyawan.</Keterangan>
          <Tombol judul="Izinkan kamera" onPress={() => void mintaIzin()} />
        </View>
      )}

      <Isian
        label="Atau ketik kodenya"
        placeholder="K7QM-28XD"
        autoCapitalize="characters"
        autoCorrect={false}
        value={ketikan}
        onChangeText={(t) => {
          setKetikan(t);
          setGalat(null);
        }}
      />
      <PesanGalat pesan={galat} />
      <Tombol judul="Lanjut" nonaktif={ketikan.trim() === ""} onPress={() => lanjut(ketikan)} />
      <Tombol judul="Batal" jenis="kedua" onPress={() => router.back()} />
    </Layar>
  );
}
