import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Isian, Judul, Keterangan, Layar, PesanGalat, Tombol } from "../komponen/ui";
import { api, panggil } from "../lib/api";

const PERAN = [
  { nilai: "kolektor", label: "Kolektor" },
  { nilai: "kasir", label: "Kasir" },
  { nilai: "pengawas", label: "Pengawas" },
] as const;
type PeranTertaut = (typeof PERAN)[number]["nilai"];

/**
 * Bos menyetujui kode yang dipindai: membuat akun baru untuk HP itu.
 * (Menautkan ke akun yang sudah ada menyusul bersama daftar pengguna.)
 */
export default function Setujui() {
  const { kode } = useLocalSearchParams<{ kode: string }>();
  const [peran, setPeran] = useState<PeranTertaut>("kolektor");
  const [nama, setNama] = useState("");
  const [nomorHp, setNomorHp] = useState("");
  const [resort, setResort] = useState("");

  const setujui = useMutation({
    mutationFn: async () => {
      const res = await panggil(() =>
        api.auth.tautan.setujui.$post({
          json: {
            kode,
            akun: {
              peran,
              nama: nama.trim(),
              ...(nomorHp.trim() ? { nomorHp: nomorHp.trim() } : {}),
              ...(peran === "kolektor" && resort.trim() ? { resort: resort.trim() } : {}),
            },
          },
        }),
      );
      if (res.status !== 200) throw new Error("Jawaban tak terduga");
      return res.json();
    },
  });

  if (setujui.data) {
    return (
      <Layar>
        <Judul>Disetujui</Judul>
        <Keterangan>
          HP {setujui.data.perangkat.nama ?? "karyawan"} akan masuk otomatis sebagai{" "}
          {setujui.data.pengguna.nama} dalam beberapa detik.
        </Keterangan>
        <Tombol judul="Selesai" onPress={() => router.replace("/beranda")} />
      </Layar>
    );
  }

  return (
    <Layar>
      <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
        <Judul>Akun untuk HP ini</Judul>
        <Keterangan>Kode {kode}</Keterangan>

        <View className="flex-row gap-2">
          {PERAN.map((p) => (
            <Pressable
              key={p.nilai}
              onPress={() => setPeran(p.nilai)}
              className={`flex-1 items-center rounded-xl border py-3 ${peran === p.nilai ? "border-emerald-700 bg-emerald-50" : "border-slate-300"}`}
            >
              <Text
                className={peran === p.nilai ? "font-semibold text-emerald-800" : "text-slate-700"}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Isian label="Nama" value={nama} onChangeText={setNama} placeholder="Nama karyawan" />
        <Isian
          label="Nomor HP (opsional)"
          keyboardType="phone-pad"
          value={nomorHp}
          onChangeText={setNomorHp}
          placeholder="0812…"
        />
        {peran === "kolektor" ? (
          <Isian
            label="Resort (opsional)"
            value={resort}
            onChangeText={setResort}
            placeholder="Resort 1"
          />
        ) : null}

        <PesanGalat pesan={setujui.error?.message} />
        <Tombol
          judul="Setujui"
          memuat={setujui.isPending}
          nonaktif={nama.trim() === ""}
          onPress={() => setujui.mutate()}
        />
        <Tombol judul="Batal" jenis="kedua" onPress={() => router.back()} />
      </ScrollView>
    </Layar>
  );
}
