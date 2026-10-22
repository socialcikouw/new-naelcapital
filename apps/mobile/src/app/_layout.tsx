import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { sesi } from "../lib/sesi";

export default function TataLetakAkar() {
  const [klienKueri] = useState(() => new QueryClient());

  useEffect(() => {
    void sesi.muat();
  }, []);

  return (
    <QueryClientProvider client={klienKueri}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
