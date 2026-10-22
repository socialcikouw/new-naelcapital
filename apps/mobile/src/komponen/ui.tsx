import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
