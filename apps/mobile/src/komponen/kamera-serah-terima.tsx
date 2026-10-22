import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { unggahFotoSerahTerima } from "../lib/foto";
import { Keterangan, PesanGalat, Tombol } from "./ui";

interface Potret {
  uri: string;
  width: number;
  height: number;
}

/**
 * KAMERA SERAH TERIMA (A7) — nasabah memegang uang pencairan. Hanya dari
 * kamera (bukan galeri), diperiksa dulu, lalu dikompres & diunggah. Foto
 * berlaku 1 jam: potret sesaat sebelum menyimpan akad / gulung.
 */
export function KameraSerahTerima(props: {
  terbuka: boolean;
  onTutup: () => void;
  onSelesai: (fotoId: string, pratinjauUri: string) => void;
}) {
  const [izin, mintaIzin] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [potret, setPotret] = useState<Potret | null>(null);
  const [siap, setSiap] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const tutup = () => {
    setPotret(null);
    setGalat(null);
    props.onTutup();
  };

  const jepret = async () => {
    if (!kamera.current) return;
    setGalat(null);
    try {
      const f = await kamera.current.takePictureAsync({ quality: 0.8 });
      setPotret({ uri: f.uri, width: f.width, height: f.height });
    } catch (e) {
      setGalat((e as Error).message);
    }
  };

  const pakai = async () => {
    if (!potret) return;
    setMengunggah(true);
    setGalat(null);
    try {
      const id = await unggahFotoSerahTerima(potret.uri, potret);
      props.onSelesai(id, potret.uri);
      setPotret(null);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMengunggah(false);
    }
  };

  return (
    <Modal visible={props.terbuka} animationType="slide" onRequestClose={tutup}>
      <SafeAreaView className="flex-1 bg-black">
        {!izin ? null : !izin.granted ? (
          <View className="flex-1 justify-center gap-4 bg-white px-5">
            <Keterangan>
              Kamera dibutuhkan untuk memotret nasabah memegang uang pencairan.
            </Keterangan>
            {izin.canAskAgain ? (
              <Tombol judul="Izinkan kamera" onPress={() => void mintaIzin()} />
            ) : (
              <Keterangan>Izin kamera ditolak — buka Pengaturan HP untuk mengizinkan.</Keterangan>
            )}
            <Tombol judul="Batal" jenis="kedua" onPress={tutup} />
          </View>
        ) : potret ? (
          <View className="flex-1">
            <Image source={{ uri: potret.uri }} className="flex-1" resizeMode="contain" />
            <View className="gap-3 bg-white px-5 py-4">
              <PesanGalat pesan={galat} />
              <Tombol judul="Pakai foto ini" memuat={mengunggah} onPress={() => void pakai()} />
              <Tombol
                judul="Potret ulang"
                jenis="kedua"
                nonaktif={mengunggah}
                onPress={() => setPotret(null)}
              />
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <CameraView
              ref={kamera}
              style={{ flex: 1 }}
              facing="back"
              animateShutter
              onCameraReady={() => setSiap(true)}
            />
            <View className="gap-3 bg-black px-5 py-4">
              <Text className="text-center text-sm text-white">
                Nasabah memegang uang pencairan, wajah terlihat jelas.
              </Text>
              <PesanGalat pesan={galat} />
              <View className="flex-row items-center justify-between">
                <Pressable onPress={tutup} className="w-20 py-3">
                  <Text className="text-base text-white">Batal</Text>
                </Pressable>
                <Pressable
                  onPress={() => void jepret()}
                  disabled={!siap}
                  className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white ${siap ? "" : "opacity-40"}`}
                >
                  <View className="h-16 w-16 rounded-full bg-white" />
                </Pressable>
                <View className="w-20" />
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export interface FotoSerahTerima {
  id: string;
  uri: string;
  diambilAt: number;
}

/** Foto masih boleh dipakai — sisakan 5 menit dari batas 1 jam server (A7). */
export function fotoMasihBerlaku(f: FotoSerahTerima | null): f is FotoSerahTerima {
  return !!f && Date.now() - f.diambilAt < 55 * 60 * 1000;
}

/** Isian foto di formulir akad / gulung: tombol potret + pratinjau kecil. */
export function IsianFotoSerahTerima(props: {
  nilai: FotoSerahTerima | null;
  onUbah: (f: FotoSerahTerima | null) => void;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const berlaku = fotoMasihBerlaku(props.nilai);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-slate-700">Foto serah terima</Text>
      {props.nilai && berlaku ? (
        <View className="flex-row items-center gap-3">
          <Image source={{ uri: props.nilai.uri }} className="h-20 w-16 rounded-lg bg-slate-100" />
          <View className="flex-1 gap-1">
            <Text className="text-sm text-slate-700">
              Diambil{" "}
              {new Date(props.nilai.diambilAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · berlaku 1 jam
            </Text>
            <Pressable onPress={() => setTerbuka(true)}>
              <Text className="text-sm font-semibold text-emerald-700">Potret ulang</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {props.nilai ? (
            <Text className="text-sm text-red-600">
              Foto sudah lebih dari 1 jam — potret ulang.
            </Text>
          ) : null}
          <Tombol judul="Potret serah terima" jenis="kedua" onPress={() => setTerbuka(true)} />
        </>
      )}
      <KameraSerahTerima
        terbuka={terbuka}
        onTutup={() => setTerbuka(false)}
        onSelesai={(id, uri) => {
          props.onUbah({ id, uri, diambilAt: Date.now() });
          setTerbuka(false);
        }}
      />
    </View>
  );
}
