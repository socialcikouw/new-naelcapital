import type { ReactNode } from "react";
import { PesanGalat } from "@/komponen/formulir";
import { Button } from "@/komponen/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/komponen/ui/dialog";

/**
 * DIALOG FORMULIR — judul, isian, galat server, tombol batal & kirim.
 * Dipakai semua aksi tulis layar bos (sunting, batal, catat …).
 */
export function DialogFormulir({
  judul,
  keterangan,
  buka,
  ubahBuka,
  kirim,
  memuat,
  galat,
  labelKirim = "Simpan",
  bahaya,
  bisaKirim = true,
  lebar,
  children,
}: {
  judul: string;
  keterangan?: ReactNode;
  buka: boolean;
  ubahBuka: (buka: boolean) => void;
  kirim: () => void;
  memuat: boolean;
  galat?: string | null | undefined;
  labelKirim?: string;
  /** Tombol kirim merah — pembatalan, nonaktifkan, pemutihan. */
  bahaya?: boolean;
  bisaKirim?: boolean;
  lebar?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog open={buka} onOpenChange={ubahBuka}>
      <DialogContent className={lebar ? "sm:max-w-2xl" : undefined}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!memuat && bisaKirim) kirim();
          }}
        >
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            {keterangan ? <DialogDescription>{keterangan}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <PesanGalat pesan={galat} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              type="submit"
              variant={bahaya ? "destructive" : "default"}
              disabled={memuat || !bisaKirim}
            >
              {memuat ? "Memproses…" : labelKirim}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
