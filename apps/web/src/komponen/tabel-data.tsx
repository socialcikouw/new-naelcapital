import {
  type CellData,
  type ColumnDef,
  createColumnHelper,
  createSortedRowModel,
  type RowData,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  type TableFeatures,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/komponen/ui/table";
import { cn } from "@/lib/utils";

/**
 * TABEL DATA — TanStack Table v9 dengan pengurutan per kolom, di atas tabel
 * shadcn/ui. Penyaringan dilakukan pemanggil (atau server) sebelum `data`
 * diberikan. Kolom angka diberi `meta: { kanan: true }`.
 */

export const fiturTabel = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
});
export type FiturTabel = typeof fiturTabel;

declare module "@tanstack/table-core" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** Rata kanan — angka & rupiah. */
    kanan?: boolean;
  }
}

/** Pembantu kolom bertipe untuk satu bentuk baris. */
export const pembantuKolom = <T extends RowData>() => createColumnHelper<FiturTabel, T>();

export type Kolom<T extends RowData> = ColumnDef<FiturTabel, T, CellData>;

export function TabelData<T extends RowData>({
  kolom,
  data,
  kosong = "Belum ada data",
  pilihBaris,
  idBaris,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: nilai sel tiap kolom berbeda-beda
  kolom: ColumnDef<FiturTabel, T, any>[];
  data: T[];
  kosong?: ReactNode;
  pilihBaris?: (baris: T) => void;
  idBaris?: (baris: T) => string;
}) {
  const tabel = useTable({
    features: fiturTabel,
    columns: kolom,
    data,
    ...(idBaris ? { getRowId: (b: T) => idBaris(b) } : {}),
  });
  const adaKaki = kolom.some((k) => k.footer !== undefined);
  const baris = tabel.getRowModel().rows;

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {tabel.getHeaderGroups().map((grup) => (
            <TableRow key={grup.id} className="hover:bg-transparent">
              {grup.headers.map((h) => {
                const urut = h.column.getIsSorted();
                const bisaUrut = h.column.getCanSort();
                return (
                  <TableHead
                    key={h.id}
                    className={cn(h.column.columnDef.meta?.kanan && "text-right")}
                  >
                    {h.isPlaceholder ? null : bisaUrut ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground",
                          h.column.columnDef.meta?.kanan && "flex-row-reverse",
                        )}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        <tabel.FlexRender header={h} />
                        {urut === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : urut === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : null}
                      </button>
                    ) : (
                      <tabel.FlexRender header={h} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {baris.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={kolom.length} className="py-8 text-center text-muted-foreground">
                {kosong}
              </TableCell>
            </TableRow>
          ) : (
            baris.map((b) => (
              <TableRow
                key={b.id}
                className={cn(pilihBaris && "cursor-pointer")}
                onClick={pilihBaris ? () => pilihBaris(b.original) : undefined}
              >
                {b.getAllCells().map((sel) => (
                  <TableCell
                    key={sel.id}
                    className={cn(sel.column.columnDef.meta?.kanan && "text-right tabular-nums")}
                  >
                    <tabel.FlexRender cell={sel} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
        {adaKaki && baris.length > 0 ? (
          <TableFooter>
            {tabel.getFooterGroups().map((grup) => (
              <TableRow key={grup.id}>
                {grup.headers.map((h) => (
                  <TableCell
                    key={h.id}
                    className={cn(h.column.columnDef.meta?.kanan && "text-right tabular-nums")}
                  >
                    {h.isPlaceholder ? null : <tabel.FlexRender footer={h} />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
