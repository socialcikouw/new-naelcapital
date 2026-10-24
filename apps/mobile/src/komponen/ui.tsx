import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, type ReactNode, useState } from "react";
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

/**
 * KOMPONEN DASAR HP — satu gaya untuk semua layar: latar abu muda, kartu
 * putih, hijau Nael untuk aksi utama. Sentuhan minimal 44 pt (pedoman iOS),
 * isian menyala hijau saat aktif, keyboard tidak menutupi isian.
 */

export const WARNA = {
  utama: "#047857",
  teks: "#0f172a",
  redup: "#64748b",
  garis: "#cbd5e1",
  latar: "#f8fafc",
} as const;

export type NamaIkon = ComponentProps<typeof Ionicons>["name"];

export function Ikon(props: { nama: NamaIkon; ukuran?: number; warna?: string }) {
  return <Ionicons name={props.nama} size={props.ukuran ?? 20} color={props.warna ?? WARNA.teks} />;
}

/** Kerangka layar tanpa header: aman dari poni & bilah navigasi. */
export function Layar({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 gap-5 px-5 pt-4 pb-6">{children}</View>
    </SafeAreaView>
  );
}

/** Isi layar bergulir (layar ber-header Stack); keyboard tidak menutupi isian. */
export function Gulir({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-4 px-5 pt-4 pb-12"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

/** Pemuat penuh layar. */
export function Memuat({ teks }: { teks?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-slate-50">
      <ActivityIndicator color={WARNA.utama} />
      {teks ? <Text className="text-sm text-slate-500">{teks}</Text> : null}
    </View>
  );
}

/** Tanda merek: kotak hijau ber-"N" + nama aplikasi. */
export function Merek({ besar }: { besar?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`items-center justify-center rounded-2xl bg-emerald-700 ${besar ? "h-14 w-14" : "h-10 w-10"}`}
      >
        <Text className={`font-extrabold text-white ${besar ? "text-2xl" : "text-lg"}`}>N</Text>
      </View>
      <View>
        <Text className={`font-bold text-slate-900 ${besar ? "text-xl" : "text-base"}`}>
          Nael Capital
        </Text>
        <Text className="text-xs text-slate-500">Simpan pinjam harian</Text>
      </View>
    </View>
  );
}

export function Judul({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold tracking-tight text-slate-900">{children}</Text>;
}

export function Keterangan({ children }: { children: ReactNode }) {
  return <Text className="text-base leading-6 text-slate-600">{children}</Text>;
}

const GAYA_TOMBOL = {
  utama: { kotak: "bg-emerald-700", teks: "text-white", ikon: "#ffffff" },
  kedua: { kotak: "border border-slate-300 bg-white", teks: "text-slate-800", ikon: WARNA.teks },
  bahaya: { kotak: "border border-red-200 bg-red-50", teks: "text-red-700", ikon: "#b91c1c" },
} as const;

export function Tombol(props: {
  judul: string;
  onPress: () => void;
  memuat?: boolean;
  jenis?: keyof typeof GAYA_TOMBOL;
  nonaktif?: boolean;
  ikon?: NamaIkon;
}) {
  const gaya = GAYA_TOMBOL[props.jenis ?? "utama"];
  const mati = props.nonaktif || props.memuat;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={mati}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!mati, busy: !!props.memuat }}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-80 ${gaya.kotak} ${mati ? "opacity-50" : ""}`}
    >
      {props.memuat ? (
        <ActivityIndicator color={gaya.ikon} />
      ) : (
        <>
          {props.ikon ? <Ikon nama={props.ikon} warna={gaya.ikon} /> : null}
          <Text className={`text-base font-semibold ${gaya.teks}`}>{props.judul}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Tautan teks kecil (mis. "Ganti nasabah"). */
export function TombolTeks(props: { judul: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} hitSlop={10} className="self-start py-1 active:opacity-60">
      <Text className="text-sm font-semibold text-emerald-700">{props.judul}</Text>
    </Pressable>
  );
}

function Label({ teks }: { teks?: string | undefined }) {
  return teks ? <Text className="text-sm font-medium text-slate-700">{teks}</Text> : null;
}

/** Bingkai isian: menyala hijau saat aktif, merah saat galat. */
function bingkai(fokus: boolean, galat: unknown) {
  return galat ? "border-red-500" : fokus ? "border-emerald-600" : "border-slate-300";
}

export function Isian(
  props: TextInputProps & { label?: string; galat?: string | undefined; ikon?: NamaIkon },
) {
  const { label, galat, ikon, onFocus, onBlur, ...input } = props;
  const [fokus, setFokus] = useState(false);
  return (
    <View className="gap-1.5">
      <Label teks={label} />
      <View
        className={`min-h-[52px] flex-row items-center gap-2 rounded-2xl border-2 bg-white px-4 ${bingkai(fokus, galat)}`}
      >
        {ikon ? <Ikon nama={ikon} warna={WARNA.redup} /> : null}
        <TextInput
          className="flex-1 py-3 text-base text-slate-900"
          placeholderTextColor="#94a3b8"
          onFocus={(e) => {
            setFokus(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFokus(false);
            onBlur?.(e);
          }}
          {...input}
        />
      </View>
      {galat ? <Text className="text-sm text-red-600">{galat}</Text> : null}
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
  const [fokus, setFokus] = useState(false);
  return (
    <View className="gap-1.5">
      <Label teks={props.label} />
      <View
        className={`min-h-[56px] flex-row items-center rounded-2xl border-2 bg-white px-4 ${bingkai(fokus, props.galat)}`}
      >
        <Text className="text-lg font-semibold text-slate-400">Rp</Text>
        <TextInput
          className="flex-1 py-3 pl-2 text-xl font-bold text-slate-900"
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          value={tulisUang(props.nilai)}
          onChangeText={(t) => props.onUbah(bacaUang(t))}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          autoFocus={props.autoFocus ?? false}
        />
      </View>
      {props.galat ? <Text className="text-sm text-red-600">{props.galat}</Text> : null}
    </View>
  );
}

export function PesanGalat({ pesan }: { pesan: string | null | undefined }) {
  if (!pesan) return null;
  return (
    <View className="flex-row items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <Ikon nama="alert-circle" ukuran={18} warna="#b91c1c" />
      <Text className="flex-1 text-sm leading-5 text-red-700">{pesan}</Text>
    </View>
  );
}

export function Kartu({ children }: { children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200">
      {children}
    </View>
  );
}

/** Satu baris label — nilai (angka rata kanan). */
export function Baris(props: { label: string; nilai: string; tebal?: boolean; warna?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="shrink text-sm text-slate-600">{props.label}</Text>
      <Text
        className={`text-right ${props.tebal ? "text-lg font-bold" : "text-base font-medium"} ${props.warna ?? "text-slate-900"}`}
      >
        {props.nilai}
      </Text>
    </View>
  );
}

/** Angka ringkas berlabel — deret ringkasan di atas layar. */
export function KotakAngka(props: { label: string; nilai: string; ikon?: NamaIkon }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-1.5">
        {props.ikon ? <Ikon nama={props.ikon} ukuran={14} warna={WARNA.redup} /> : null}
        <Text className="text-xs font-medium text-slate-500">{props.label}</Text>
      </View>
      <Text className="text-lg font-bold text-slate-900">{props.nilai}</Text>
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
      className={`self-start overflow-hidden rounded-full px-2.5 py-1 text-xs font-semibold ${WARNA_LENCANA[props.warna ?? "abu"]}`}
    >
      {props.teks}
    </Text>
  );
}

const GAYA_SPANDUK: Record<
  "kuning" | "merah" | "hijau",
  { kotak: string; ikon: NamaIkon; warna: string }
> = {
  kuning: { kotak: "border-amber-200 bg-amber-50", ikon: "warning", warna: "#b45309" },
  merah: { kotak: "border-red-200 bg-red-50", ikon: "alert-circle", warna: "#b91c1c" },
  hijau: {
    kotak: "border-emerald-200 bg-emerald-50",
    ikon: "checkmark-circle",
    warna: WARNA.utama,
  },
};

/** Pengumuman di atas layar (gerbang tertutup, peringatan uang). */
export function Spanduk(props: {
  judul: string;
  isi?: string | undefined;
  warna?: keyof typeof GAYA_SPANDUK;
}) {
  const gaya = GAYA_SPANDUK[props.warna ?? "kuning"];
  return (
    <View className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${gaya.kotak}`}>
      <Ikon nama={gaya.ikon} warna={gaya.warna} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-slate-900">{props.judul}</Text>
        {props.isi ? <Text className="text-sm leading-5 text-slate-700">{props.isi}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Pilihan tunggal. `segmen` = kontrol bersegmen selebar layar (mis. aksi
 * Setor/Lunas/Libur); bawaan = deretan tombol kecil yang boleh membungkus.
 */
export function Pilihan<T extends string | number>(props: {
  label?: string;
  pilihan: readonly { nilai: T; teks: string }[];
  nilai: T | null;
  onPilih: (nilai: T) => void;
  segmen?: boolean;
}) {
  if (props.segmen) {
    return (
      <View className="gap-1.5">
        <Label teks={props.label} />
        <View className="flex-row rounded-2xl bg-slate-200 p-1">
          {props.pilihan.map((p) => {
            const aktif = p.nilai === props.nilai;
            return (
              <Pressable
                key={String(p.nilai)}
                onPress={() => props.onPilih(p.nilai)}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif }}
                className={`min-h-11 flex-1 items-center justify-center rounded-xl ${aktif ? "bg-white shadow-sm shadow-slate-300" : ""}`}
              >
                <Text
                  className={`text-sm font-semibold ${aktif ? "text-emerald-800" : "text-slate-600"}`}
                >
                  {p.teks}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <View className="gap-1.5">
      <Label teks={props.label} />
      <View className="flex-row flex-wrap gap-2">
        {props.pilihan.map((p) => {
          const aktif = p.nilai === props.nilai;
          return (
            <Pressable
              key={String(p.nilai)}
              onPress={() => props.onPilih(p.nilai)}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              className={`min-h-11 justify-center rounded-full border px-4 active:opacity-80 ${aktif ? "border-emerald-700 bg-emerald-700" : "border-slate-300 bg-white"}`}
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
