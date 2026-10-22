import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bacaUang, tulisUang } from "../lib/format";

/** Kerangka layar: aman dari poni & bilah navigasi, berlatar putih. */
export function Layar({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 gap-4 px-5 py-6">{children}</View>
    </SafeAreaView>
  );
}

export function Judul({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold text-slate-900">{children}</Text>;
}

export function Keterangan({ children }: { children: ReactNode }) {
  return <Text className="text-base text-slate-600">{children}</Text>;
}

export function Tombol(props: {
  judul: string;
  onPress: () => void;
  memuat?: boolean;
  jenis?: "utama" | "kedua";
  nonaktif?: boolean;
}) {
  const utama = (props.jenis ?? "utama") === "utama";
  const mati = props.nonaktif || props.memuat;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={mati}
      className={`items-center rounded-xl px-4 py-4 ${utama ? "bg-emerald-700" : "border border-slate-300 bg-white"} ${mati ? "opacity-50" : ""}`}
    >
      {props.memuat ? (
        <ActivityIndicator color={utama ? "white" : "#334155"} />
      ) : (
        <Text className={`text-base font-semibold ${utama ? "text-white" : "text-slate-800"}`}>
          {props.judul}
        </Text>
      )}
    </Pressable>
  );
}

export function Isian(props: TextInputProps & { label: string; galat?: string | undefined }) {
  const { label, galat, ...input } = props;
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        className={`rounded-xl border px-4 py-3 text-base text-slate-900 ${galat ? "border-red-500" : "border-slate-300"}`}
        placeholderTextColor="#94a3b8"
        {...input}
      />
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
    </View>
  );
}

export function PesanGalat({ pesan }: { pesan: string | null | undefined }) {
  if (!pesan) return null;
  return (
    <View className="rounded-xl bg-red-50 px-4 py-3">
      <Text className="text-sm text-red-700">{pesan}</Text>
    </View>
  );
}

/** Isi layar bergulir (layar ber-header Stack: header sudah menjaga poni). */
export function Gulir({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-4 px-5 py-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Kartu({ children }: { children: ReactNode }) {
  return <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4">{children}</View>;
}

/** Satu baris label — nilai (angka rata kanan). */
export function Baris(props: { label: string; nilai: string; tebal?: boolean; warna?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-slate-600">{props.label}</Text>
      <Text
        className={`text-base ${props.tebal ? "font-bold" : "font-medium"} ${props.warna ?? "text-slate-900"}`}
      >
        {props.nilai}
      </Text>
    </View>
  );
}

const WARNA_LENCANA = {
  hijau: "bg-emerald-100 text-emerald-800",
  kuning: "bg-amber-100 text-amber-800",
  merah: "bg-red-100 text-red-800",
  abu: "bg-slate-100 text-slate-700",
} as const;

export function Lencana(props: { teks: string; warna?: keyof typeof WARNA_LENCANA }) {
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold ${WARNA_LENCANA[props.warna ?? "abu"]}`}
    >
      {props.teks}
    </Text>
  );
}

/** Pengumuman di atas layar (gerbang tertutup, peringatan uang). */
export function Spanduk(props: {
  judul: string;
  isi?: string;
  warna?: "kuning" | "merah" | "hijau";
}) {
  const warna = {
    kuning: "bg-amber-50 border-amber-200",
    merah: "bg-red-50 border-red-200",
    hijau: "bg-emerald-50 border-emerald-200",
  }[props.warna ?? "kuning"];
  return (
    <View className={`gap-1 rounded-xl border px-4 py-3 ${warna}`}>
      <Text className="text-base font-semibold text-slate-900">{props.judul}</Text>
      {props.isi ? <Text className="text-sm text-slate-700">{props.isi}</Text> : null}
    </View>
  );
}

/** Pilihan tunggal berbentuk tombol-tombol kecil. */
export function Pilihan<T extends string | number>(props: {
  label?: string;
  pilihan: readonly { nilai: T; teks: string }[];
  nilai: T | null;
  onPilih: (nilai: T) => void;
}) {
  return (
    <View className="gap-1">
      {props.label ? (
        <Text className="text-sm font-medium text-slate-700">{props.label}</Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {props.pilihan.map((p) => {
          const aktif = p.nilai === props.nilai;
          return (
            <Pressable
              key={String(p.nilai)}
              onPress={() => props.onPilih(p.nilai)}
              className={`rounded-full border px-4 py-2 ${aktif ? "border-emerald-700 bg-emerald-700" : "border-slate-300 bg-white"}`}
            >
              <Text className={`text-sm font-semibold ${aktif ? "text-white" : "text-slate-800"}`}>
                {p.teks}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Isian rupiah: papan angka, pemisah ribuan saat diketik. */
export function IsianUang(props: {
  label: string;
  nilai: number;
  onUbah: (n: number) => void;
  galat?: string | null | undefined;
  autoFocus?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-slate-700">{props.label}</Text>
      <View
        className={`flex-row items-center rounded-xl border px-4 ${props.galat ? "border-red-500" : "border-slate-300"}`}
      >
        <Text className="text-lg text-slate-500">Rp </Text>
        <TextInput
          className="flex-1 py-3 text-lg font-semibold text-slate-900"
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          value={tulisUang(props.nilai)}
          onChangeText={(t) => props.onUbah(bacaUang(t))}
          autoFocus={props.autoFocus ?? false}
        />
      </View>
      {props.galat ? <Text className="text-sm text-red-600">{props.galat}</Text> : null}
    </View>
  );
}
