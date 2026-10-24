import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gabung kelas Tailwind — kelas belakangan menang (pola shadcn/ui). */
export function cn(...kelas: ClassValue[]) {
  return twMerge(clsx(kelas));
}
