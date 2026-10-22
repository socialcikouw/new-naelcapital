import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@naelcapital/contracts";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { z } from "zod";
import { Isian, Judul, Keterangan, Layar, PesanGalat, Tombol } from "../komponen/ui";
import { api, panggil } from "../lib/api";
import { infoPerangkat } from "../lib/perangkat";
import { sesi } from "../lib/sesi";

const formSchema = loginSchema.omit({ perangkat: true });
type Masukan = z.input<typeof formSchema>;
type Keluaran = z.output<typeof formSchema>;

/** Bos masuk dengan nomor HP + kata sandi; peran lain menautkan HP lewat QR. */
export default function Masuk() {
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(formSchema),
    defaultValues: { nomorHp: "", sandi: "" },
  });

  const masuk = useMutation({
    mutationFn: async (isi: Keluaran) => {
      const res = await panggil(() =>
        api.auth.login.$post({ json: { ...isi, perangkat: infoPerangkat() } }),
      );
      if (res.status !== 200) throw new Error("Jawaban tak terduga");
      return res.json();
    },
    onSuccess: async (hasil) => {
      await sesi.simpan(hasil);
      router.replace("/beranda");
    },
  });

  return (
    <Layar>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
          <Judul>Nael Capital</Judul>
          <Keterangan>Masuk sebagai bos dengan nomor HP dan kata sandi.</Keterangan>

          <Controller
            control={form.control}
            name="nomorHp"
            render={({ field, fieldState }) => (
              <Isian
                label="Nomor HP"
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="0812…"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                galat={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="sandi"
            render={({ field, fieldState }) => (
              <Isian
                label="Kata sandi"
                secureTextEntry
                autoComplete="password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                galat={fieldState.error?.message}
              />
            )}
          />

          <PesanGalat pesan={masuk.error?.message} />
          <Tombol
            judul="Masuk"
            memuat={masuk.isPending}
            onPress={form.handleSubmit((isi) => masuk.mutate(isi))}
          />

          <View className="mt-6 gap-2 border-t border-slate-200 pt-6">
            <Keterangan>
              Kasir, pengawas, atau kolektor? Tautkan HP ini dengan QR dari bos.
            </Keterangan>
            <Tombol judul="Tautkan HP ini" jenis="kedua" onPress={() => router.push("/tautkan")} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Layar>
  );
}
