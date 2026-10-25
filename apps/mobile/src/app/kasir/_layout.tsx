import { Redirect, Stack } from "expo-router";
import { OPSI_STACK } from "../../komponen/ui";
import { layarAwal } from "../../lib/peran";
import { useSesi } from "../../lib/sesi";

/** Layar-layar kasir — hanya untuk sesi berperan kasir. */
export default function TataLetakKasir() {
  const s = useSesi();
  if (s === undefined) return null;
  if (s === null) return <Redirect href="/tautkan" />;
  if (s.pengguna.peran !== "kasir") return <Redirect href={layarAwal(s.pengguna.peran)} />;

  return (
    <Stack screenOptions={OPSI_STACK}>
      <Stack.Screen name="index" options={{ title: "Setoran Sore" }} />
      <Stack.Screen name="[kolektorId]" options={{ title: "Kolektor" }} />
    </Stack>
  );
}
