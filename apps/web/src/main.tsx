import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const akar = document.getElementById("root");
if (!akar) throw new Error("Elemen #root tidak ditemukan");

createRoot(akar).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
