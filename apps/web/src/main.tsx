import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./rute";

const akar = document.getElementById("root");
if (!akar) throw new Error("Elemen #root tidak ditemukan");

const klienKueri = new QueryClient();

createRoot(akar).render(
  <StrictMode>
    <QueryClientProvider client={klienKueri}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
