import { Redirect, Stack } from "expo-router";
import { WARNA } from "../../komponen/ui";
import { useSesi } from "../../lib/sesi";

/** Layar-layar kolektor — hanya untuk sesi berperan kolektor. */
export default function TataLetakKolektor() {
  const s = useSesi();
  if (s === undefined) return null;
  if (s === null) return <Redirect href="/tautkan" />;
  if (s.pengguna.peran !== "kolektor") return <Redirect href="/beranda" />;

  return (
    <Stack
      screenOptions={{
        headerTintColor: WARNA.utama,
        headerTitleStyle: { color: WARNA.teks, fontWeight: "700" },
        headerStyle: { backgroundColor: WARNA.latar },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: WARNA.latar },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Kerja Harian" }} />
      <Stack.Screen name="pinjaman/[id]" options={{ title: "Pinjaman" }} />
      <Stack.Screen name="gulung/[id]" options={{ title: "Gulung" }} />
      <Stack.Screen name="akad" options={{ title: "Akad Baru" }} />
    </Stack>
  );
}
