import type { HariKas } from "@naelcapital/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowLeftRight, HandCoins, Plus, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DialogBatal } from "@/komponen/dialog-batal";
import { DialogFormulir } from "@/komponen/dialog-formulir";
import { Isian, Medan, PilihanAsli } from "@/komponen/formulir";
import { GalatMuat, KepalaHalaman, Memuat, PilihTanggal } from "@/komponen/halaman";
import { IsianRupiah } from "@/komponen/isian-rupiah";
import { type Kolom, pembantuKolom, TabelData } from "@/komponen/tabel-data";
import { Badge } from "@/komponen/ui/badge";
import { Button } from "@/komponen/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/komponen/ui/tabs";
import { ambil, api } from "@/lib/api";
import { tanggal as formatTanggal, jam, rupiah } from "@/lib/format";
import { useHariIni, useKantor } from "@/lib/kantor";
import { cn } from "@/lib/utils";

const rute = getRouteApi("/bos/harian");

const KUNCI_HARIAN = [["harian"]];

/** Satu tombol ikon kecil di sel tabel. */
function TombolSel({
  label,
  bahaya,
  onClick,
  children,
}: {
  label: string;
  bahaya?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      title={label}
      aria-label={label}
      className={cn(bahaya && "text-red-700 hover:text-red-800")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

// ---- setoran sore -------------------------------------------------------------------

/** Hitung buta: bos/kasir mengetik uang yang dihitung, baru sesudahnya melihat rincian. */
function DialogTerimaKas({ hari, tutup }: { hari: HariKas; tutup: () => void }) {
  const klien = useQueryClient();
  const [tunai, setTunai] = useState<number | null>(null);
  const m = useMutation({
    mutationFn: () =>
      ambil(() =>
        api["hari-kolektor"][":kolektorId"]["terima-kas"].$post({
          param: { kolektorId: hari.kolektor.id },
          json: { tunaiDiterima: tunai ?? 0 },
        }),
      ),
    onSuccess: () => {
      for (const k of [["harian"], ["ringkasan"], ["aktivitas"]]) {
        void klien.invalidateQueries({ queryKey: k });
      }
    },
  });
  const st = m.data?.serahTerima;
  if (m.data && st) {
    return (
      <DialogFormulir
        judul={`Kas ${hari.kolektor.nama} diterima`}
        buka
        ubahBuka={(b) => !b && tutup()}
        kirim={tutup}
        memuat={false}
        labelKirim="Selesai"
      >
        <RincianKas hari={m.data} />
      </DialogFormulir>
    );
  }
  return (
    <DialogFormulir
      judul={`Terima kas ${hari.kolektor.nama}`}
      keterangan="Hitung uang fisiknya lebih dulu, lalu ketik jumlahnya. Angka seharusnya baru tampil sesudah disimpan."
      buka
      ubahBuka={(b) => !b && tutup()}
      kirim={() => m.mutate()}
      memuat={m.isPending}
      galat={m.error?.message}
      labelKirim="Simpan uang diterima"
      bisaKirim={tunai !== null}
    >
      <IsianRupiah label="Uang diterima" nilai={tunai} ubah={setTunai} autoFocus />
    </DialogFormulir>
  );
}

function RincianKas({ hari }: { hari: HariKas }) {
  const r = hari.rincian;
  const st = hari.serahTerima;
  if (!r || !st) return null;
  const baris: [string, number][] = [
    ["Kas lapangan (dibawa pagi)", r.kasLapangan],
    ["+ Storting", r.storting],
    ["+ Tabungan masuk akad", r.tabunganMasuk],
    ["+ Potongan admin", r.potonganAdmin],
    ["− Droping", -r.droping],
    ["− Transfer setoran", -r.transfer],
    ["− Biaya tak terduga", -r.biaya],
  ];
  return (
    <div className="space-y-1 text-sm">
      {baris.map(([l, n]) => (
        <div key={l} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{l}</span>
          <span className="tabular-nums">{rupiah(n)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t pt-1 font-medium">
        <span>Tunai seharusnya</span>
        <span className="tabular-nums">{rupiah(st.tunaiSeharusnya)}</span>
      </div>
      <div className="flex justify-between gap-4 font-medium">
        <span>Tunai diterima</span>
        <span className="tabular-nums">{rupiah(st.tunaiDiterima)}</span>
      </div>
      <div
        className={cn(
          "flex justify-between gap-4 font-semibold",
          st.selisihSetor < 0 && "text-red-700",
          st.selisihSetor > 0 && "text-emerald-700",
        )}
      >
        <span>{st.selisihSetor < 0 ? "Tekor" : st.selisihSetor > 0 ? "Lebih setor" : "Pas"}</span>
        <span className="tabular-nums">{rupiah(st.selisihSetor)}</span>
      </div>
    </div>
  );
}

function SetoranSore({ tanggal, hariIni }: { tanggal: string; hariIni: string }) {
  const kantor = useKantor();
  const [terima, setTerima] = useState<HariKas | null>(null);
  const [batal, setBatal] = useState<HariKas | null>(null);
  const [rinci, setRinci] = useState<HariKas | null>(null);
  const q = useQuery({
    queryKey: ["harian", "hari-kolektor", tanggal],
    queryFn: () => ambil(() => api["hari-kolektor"].$get({ query: { tanggal } })),
  });
  const hariIniSaja = tanggal === hariIni;

  const kolom = useMemo(() => {
    const k = pembantuKolom<HariKas>();
    return [
      k.accessor((h) => h.kolektor.nama, {
        id: "kolektor",
        header: "Kolektor",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      k.accessor("absensi", {
        header: "Hari ini",
        cell: (c) => {
          const h = c.row.original;
          if (h.absensi === "tidak_kerja")
            return (
              <span className="text-muted-foreground">
                Tidak kerja{h.alasanTidakKerja ? ` · ${h.alasanTidakKerja}` : ""}
              </span>
            );
          if (h.serahTerima) return <Badge variant="success">Kas diterima</Badge>;
          if (h.laporanDibukaAt)
            return (
              <Badge variant="warning">Laporan {jam(h.laporanDibukaAt, kantor.zonaWaktu)}</Badge>
            );
          return <Badge variant="secondary">Di lapangan</Badge>;
        },
      }),
      k.accessor("kasLapangan", {
        header: "Kas lapangan",
        meta: { kanan: true },
        cell: (c) => rupiah(c.getValue()),
      }),
      k.accessor("uangJalan", {
        header: "Uang jalan",
        meta: { kanan: true },
        cell: (c) => rupiah(c.getValue()),
      }),
      k.accessor((h) => h.serahTerima?.tunaiSeharusnya ?? null, {
        id: "seharusnya",
        header: "Seharusnya",
        meta: { kanan: true },
        cell: (c) => {
          const n = c.getValue();
          return n === null ? "—" : rupiah(n);
        },
      }),
      k.accessor((h) => h.serahTerima?.tunaiDiterima ?? null, {
        id: "diterima",
        header: "Diterima",
        meta: { kanan: true },
        cell: (c) => {
          const n = c.getValue();
          return n === null ? "—" : rupiah(n);
        },
      }),
      k.accessor((h) => h.serahTerima?.selisihSetor ?? null, {
        id: "selisih",
        header: "Selisih",
        meta: { kanan: true },
        cell: (c) => {
          const n = c.getValue();
          if (n === null || n === 0) return "—";
          return <span className={n < 0 ? "text-red-700" : "text-emerald-700"}>{rupiah(n)}</span>;
        },
      }),
      k.display({
        id: "aksi",
        header: "",
        cell: (c) => {
          const h = c.row.original;
          if (!hariIniSaja || h.absensi !== "masuk_kerja") return null;
          return (
            <div className="flex justify-end gap-1">
              {h.serahTerima ? (
                <TombolSel label="Batal terima kas" bahaya onClick={() => setBatal(h)}>
                  <Undo2 />
                </TombolSel>
              ) : h.laporanDibukaAt ? (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTerima(h);
                  }}
                >
                  <HandCoins />
                  Terima kas
                </Button>
              ) : null}
            </div>
          );
        },
      }),
    ] as Kolom<HariKas>[];
  }, [hariIniSaja, kantor.zonaWaktu]);

  if (q.isPending) return <Memuat />;
  if (q.isError) return <GalatMuat galat={q.error} ulangi={() => void q.refetch()} />;
  return (
    <>
      <TabelData
        kolom={kolom}
        data={q.data}
        idBaris={(h) => h.id}
        pilihBaris={(h) => h.serahTerima && setRinci(h)}
        kosong="Belum ada kolektor yang absen pada tanggal ini"
      />
      <p className="text-xs text-muted-foreground">
        Ketuk baris yang kasnya sudah diterima untuk melihat rincian tunai seharusnya.
      </p>
      {terima ? <DialogTerimaKas hari={terima} tutup={() => setTerima(null)} /> : null}
      {rinci ? (
        <DialogFormulir
          judul={`Rincian kas ${rinci.kolektor.nama}`}
          buka
          ubahBuka={(b) => !b && setRinci(null)}
          kirim={() => setRinci(null)}
          memuat={false}
          labelKirim="Tutup"
        >
          <RincianKas hari={rinci} />
        </DialogFormulir>
      ) : null}
      {batal?.serahTerima ? (
        <DialogBatal
          judul={`Batal terima kas ${batal.kolektor.nama}?`}
          keterangan="Kas dianggap belum diterima; kasir menghitung ulang."
          segarkan={KUNCI_HARIAN}
          tutup={() => setBatal(null)}
          kirim={(alasan) =>
            ambil(() =>
              api["serah-terima-kas"][":id"].batal.$post({
                param: { id: batal.serahTerima?.id ?? "" },
                json: { alasan },
              }),
            )
          }
        />
      ) : null}
    </>
  );
}

// ---- setoran nasabah ----------------------------------------------------------------

const ambilTransaksi = (tanggal: string, kolektorId?: string) =>
  ambil(() => api.transaksi.$get({ query: { tanggal, ...(kolektorId ? { kolektorId } : {}) } }));
type Transaksi = Awaited<ReturnType<typeof ambilTransaksi>>[number];

const LABEL_JENIS = { angsuran: "Angsuran", pelunasan: "Pelunasan", gulung: "Gulung" } as const;

function DialogTransfer({ t, tutup }: { t: Transaksi; tutup: () => void }) {
  const klien = useQueryClient();
  const [nominal, setNominal] = useState<number | null>(t.batasTransfer);
  const m = useMutation({
    mutationFn: () =>
      ambil(() =>
        api["transfer-setoran"].$post({ json: { transaksiId: t.id, nominal: nominal ?? 0 } }),
      ),
    onSuccess: () => {
      for (const k of [["harian"], ["ringkasan"], ["aktivitas"]]) {
        void klien.invalidateQueries({ queryKey: k });
      }
      tutup();
    },
  });
  return (
    <DialogFormulir
      judul={`Transfer setoran ${t.nasabah.nama}`}
      keterangan={`Setoran ini dibayar lewat transfer, bukan tunai. Paling banyak ${rupiah(t.batasTransfer)}.`}
      buka
      ubahBuka={(b) => !b && tutup()}
      kirim={() => m.mutate()}
      memuat={m.isPending}
      galat={m.error?.message}
      labelKirim="Catat transfer"
      bisaKirim={!!nominal && nominal <= t.batasTransfer}
    >
      <IsianRupiah label="Nominal transfer" nilai={nominal} ubah={setNominal} />
    </DialogFormulir>
  );
}

function SetoranNasabah({
  tanggal,
  hariIni,
  kolektor,
}: {
  tanggal: string;
  hariIni: string;
  kolektor: { id: string; nama: string }[];
}) {
  const [kolektorId, setKolektorId] = useState("");
  const [transfer, setTransfer] = useState<Transaksi | null>(null);
  const [batal, setBatal] = useState<Transaksi | null>(null);
  const q = useQuery({
    queryKey: ["harian", "transaksi", tanggal, kolektorId],
    queryFn: () => ambilTransaksi(tanggal, kolektorId || undefined),
  });
  const hariIniSaja = tanggal === hariIni;

  const kolom = useMemo(() => {
    const k = pembantuKolom<Transaksi>();
    const uang = (id: keyof Transaksi & string, header: string) =>
      k.accessor((t) => t[id] as number, {
        id,
        header,
        meta: { kanan: true },
        cell: (c) => (c.getValue() ? rupiah(c.getValue()) : "—"),
        footer: (c) =>
          rupiah(c.table.getRowModel().rows.reduce((s, r) => s + (r.original[id] as number), 0)),
      });
    return [
      k.accessor((t) => t.nasabah.nama, {
        id: "nasabah",
        header: "Nasabah",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
        footer: (c) => `${c.table.getRowModel().rows.length} setoran`,
      }),
      k.accessor("jenis", { header: "Jenis", cell: (c) => LABEL_JENIS[c.getValue()] }),
      uang("setoranMurni", "Murni"),
      uang("setoranPelunasan", "Pelunasan"),
      uang("tabunganKeluar", "Tabungan keluar"),
      uang("storting", "Storting"),
      k.accessor((t) => t.transfer?.nominal ?? 0, {
        id: "transfer",
        header: "Transfer",
        meta: { kanan: true },
        cell: (c) => (c.getValue() ? rupiah(c.getValue()) : "—"),
      }),
      k.display({
        id: "aksi",
        header: "",
        cell: (c) => {
          const t = c.row.original;
          if (!hariIniSaja) return null;
          return (
            <div className="flex justify-end gap-1">
              {t.batasTransfer > 0 && !t.transfer ? (
                <TombolSel label="Catat transfer" onClick={() => setTransfer(t)}>
                  <ArrowLeftRight />
                </TombolSel>
              ) : null}
              <TombolSel label="Batalkan setoran" bahaya onClick={() => setBatal(t)}>
                <Undo2 />
              </TombolSel>
            </div>
          );
        },
      }),
    ] as Kolom<Transaksi>[];
  }, [hariIniSaja]);

  return (
    <>
      <PilihanAsli
        className="w-56"
        aria-label="Saring kolektor"
        value={kolektorId}
        onChange={(e) => setKolektorId(e.target.value)}
      >
        <option value="">Semua kolektor</option>
        {kolektor.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nama}
          </option>
        ))}
      </PilihanAsli>
      {q.isPending ? (
        <Memuat />
      ) : q.isError ? (
        <GalatMuat galat={q.error} ulangi={() => void q.refetch()} />
      ) : (
        <TabelData kolom={kolom} data={q.data} idBaris={(t) => t.id} kosong="Belum ada setoran" />
      )}
      {transfer ? <DialogTransfer t={transfer} tutup={() => setTransfer(null)} /> : null}
      {batal ? (
        <DialogBatal
          judul={`Batalkan setoran ${batal.nasabah.nama}?`}
          keterangan={`${LABEL_JENIS[batal.jenis]} ${rupiah(batal.storting)}. Pinjaman kembali seperti sebelum setoran; gulung ikut membatalkan pinjaman penerusnya; transfer yang menempel ikut batal. Hanya sebelum kas kolektornya diterima.`}
          segarkan={KUNCI_HARIAN.concat([["nasabah"]])}
          tutup={() => setBatal(null)}
          kirim={(alasan) =>
            ambil(() =>
              api.transaksi[":id"].batal.$post({ param: { id: batal.id }, json: { alasan } }),
            )
          }
        />
      ) : null}
    </>
  );
}

// ---- transfer -----------------------------------------------------------------------

const ambilTransfer = (tanggal: string) =>
  ambil(() => api["transfer-setoran"].$get({ query: { tanggal } }));
type Transfer = Awaited<ReturnType<typeof ambilTransfer>>["transfer"][number];

function DaftarTransfer({ tanggal, hariIni }: { tanggal: string; hariIni: string }) {
  const kantor = useKantor();
  const [batal, setBatal] = useState<Transfer | null>(null);
  const q = useQuery({
    queryKey: ["harian", "transfer", tanggal],
    queryFn: () => ambilTransfer(tanggal),
  });
  const kolom = useMemo(() => {
    const k = pembantuKolom<Transfer>();
    return [
      k.accessor((t) => t.nasabah.nama, {
        id: "nasabah",
        header: "Nasabah",
        cell: (c) => (
          <span className={cn("font-medium", c.row.original.dibatalkanAt && "line-through")}>
            {c.getValue()}
          </span>
        ),
      }),
      k.accessor("jenis", { header: "Jenis", cell: (c) => LABEL_JENIS[c.getValue()] }),
      k.accessor("dibuatAt", {
        header: "Dicatat",
        cell: (c) => jam(c.getValue(), kantor.zonaWaktu),
      }),
      k.accessor("nominal", {
        header: "Nominal",
        meta: { kanan: true },
        cell: (c) => rupiah(c.getValue()),
      }),
      k.display({
        id: "aksi",
        header: "",
        cell: (c) => {
          const t = c.row.original;
          if (t.dibatalkanAt)
            return <span className="text-xs text-muted-foreground">Batal: {t.alasanBatal}</span>;
          if (tanggal !== hariIni) return null;
          return (
            <div className="flex justify-end">
              <TombolSel label="Batalkan transfer" bahaya onClick={() => setBatal(t)}>
                <Undo2 />
              </TombolSel>
            </div>
          );
        },
      }),
    ] as Kolom<Transfer>[];
  }, [tanggal, hariIni, kantor.zonaWaktu]);

  if (q.isPending) return <Memuat />;
  if (q.isError) return <GalatMuat galat={q.error} ulangi={() => void q.refetch()} />;
  return (
    <>
      <TabelData
        kolom={kolom}
        data={q.data.transfer}
        idBaris={(t) => t.id}
        kosong="Belum ada transfer. Catat dari tab Setoran nasabah."
      />
      <p className="text-sm">
        Total transfer berlaku:{" "}
        <span className="font-semibold tabular-nums">{rupiah(q.data.total)}</span>
      </p>
      {batal ? (
        <DialogBatal
          judul={`Batalkan transfer ${batal.nasabah.nama}?`}
          segarkan={KUNCI_HARIAN}
          tutup={() => setBatal(null)}
          kirim={(alasan) =>
            ambil(() =>
              api["transfer-setoran"][":id"].batal.$post({
                param: { id: batal.id },
                json: { alasan },
              }),
            )
          }
        />
      ) : null}
    </>
  );
}

// ---- biaya tak terduga --------------------------------------------------------------

const ambilBiaya = (tanggal: string) =>
  ambil(() =>
    api["biaya-tak-terduga"].$get({
      query: { tanggalMulai: tanggal, tanggalSelesai: tanggal, termasukBatal: "ya" },
    }),
  );
type Biaya = Awaited<ReturnType<typeof ambilBiaya>>["biaya"][number];

function DialogBiaya({
  kolektor,
  tutup,
}: {
  kolektor: { id: string; nama: string }[];
  tutup: () => void;
}) {
  const klien = useQueryClient();
  const [isi, setIsi] = useState({ kolektorId: kolektor[0]?.id ?? "", keterangan: "" });
  const [nominal, setNominal] = useState<number | null>(null);
  const m = useMutation({
    mutationFn: () =>
      ambil(() =>
        api["biaya-tak-terduga"].$post({
          json: { ...isi, keterangan: isi.keterangan.trim(), nominal: nominal ?? 0 },
        }),
      ),
    onSuccess: () => {
      for (const k of [["harian"], ["ringkasan"], ["aktivitas"]]) {
        void klien.invalidateQueries({ queryKey: k });
      }
      tutup();
    },
  });
  return (
    <DialogFormulir
      judul="Catat biaya tak terduga"
      keterangan="Uang kolektor yang terpakai di lapangan hari ini (mis. ban bocor) — mengurangi tunai seharusnya."
      buka
      ubahBuka={(b) => !b && tutup()}
      kirim={() => m.mutate()}
      memuat={m.isPending}
      galat={m.error?.message}
      labelKirim="Catat"
      bisaKirim={!!nominal && isi.kolektorId !== "" && isi.keterangan.trim() !== ""}
    >
      <Medan label="Kolektor">
        <PilihanAsli
          value={isi.kolektorId}
          onChange={(e) => setIsi({ ...isi, kolektorId: e.target.value })}
        >
          {kolektor.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </PilihanAsli>
      </Medan>
      <IsianRupiah label="Nominal" nilai={nominal} ubah={setNominal} />
      <Isian
        label="Keterangan"
        value={isi.keterangan}
        maxLength={100}
        onChange={(e) => setIsi({ ...isi, keterangan: e.target.value })}
      />
    </DialogFormulir>
  );
}

function DaftarBiaya({
  tanggal,
  hariIni,
  kolektor,
}: {
  tanggal: string;
  hariIni: string;
  kolektor: { id: string; nama: string }[];
}) {
  const [catat, setCatat] = useState(false);
  const [batal, setBatal] = useState<Biaya | null>(null);
  const q = useQuery({
    queryKey: ["harian", "biaya", tanggal],
    queryFn: () => ambilBiaya(tanggal),
  });
  const kolom = useMemo(() => {
    const k = pembantuKolom<Biaya>();
    return [
      k.accessor((b) => b.kolektor.nama, {
        id: "kolektor",
        header: "Kolektor",
        cell: (c) => (
          <span className={cn("font-medium", c.row.original.dibatalkanAt && "line-through")}>
            {c.getValue()}
          </span>
        ),
      }),
      k.accessor("keterangan", { header: "Keterangan" }),
      k.accessor("nominal", {
        header: "Nominal",
        meta: { kanan: true },
        cell: (c) => rupiah(c.getValue()),
      }),
      k.display({
        id: "aksi",
        header: "",
        cell: (c) => {
          const b = c.row.original;
          if (b.dibatalkanAt)
            return <span className="text-xs text-muted-foreground">Batal: {b.alasanBatal}</span>;
          if (tanggal !== hariIni) return null;
          return (
            <div className="flex justify-end">
              <TombolSel label="Batalkan biaya" bahaya onClick={() => setBatal(b)}>
                <Undo2 />
              </TombolSel>
            </div>
          );
        },
      }),
    ] as Kolom<Biaya>[];
  }, [tanggal, hariIni]);

  return (
    <>
      {tanggal === hariIni ? (
        <Button className="w-fit" onClick={() => setCatat(true)} disabled={kolektor.length === 0}>
          <Plus />
          Catat biaya
        </Button>
      ) : null}
      {q.isPending ? (
        <Memuat />
      ) : q.isError ? (
        <GalatMuat galat={q.error} ulangi={() => void q.refetch()} />
      ) : (
        <>
          <TabelData
            kolom={kolom}
            data={q.data.biaya}
            idBaris={(b) => b.id}
            kosong="Tidak ada biaya tak terduga"
          />
          <p className="text-sm">
            Total berlaku:{" "}
            <span className="font-semibold tabular-nums">{rupiah(q.data.total)}</span>
          </p>
        </>
      )}
      {catat ? <DialogBiaya kolektor={kolektor} tutup={() => setCatat(false)} /> : null}
      {batal ? (
        <DialogBatal
          judul={`Batalkan biaya ${batal.kolektor.nama}?`}
          segarkan={KUNCI_HARIAN}
          tutup={() => setBatal(null)}
          kirim={(alasan) =>
            ambil(() =>
              api["biaya-tak-terduga"][":id"].batal.$post({
                param: { id: batal.id },
                json: { alasan },
              }),
            )
          }
        />
      ) : null}
    </>
  );
}

// ---- layar --------------------------------------------------------------------------

type Tab = "sore" | "setoran" | "transfer" | "biaya";

/** Pekerjaan harian kantor: setoran sore, setoran nasabah, transfer, biaya tak terduga. */
export function LayarHarian() {
  const hariIni = useHariIni();
  const { tanggal, tab } = rute.useSearch();
  const navigasi = rute.useNavigate();
  const t = tanggal ?? hariIni;
  const kolektorQ = useQuery({
    queryKey: ["pengguna", "kolektor"],
    queryFn: () => ambil(() => api.pengguna.$get({ query: { peran: "kolektor" } })),
  });
  const kolektor = useMemo(
    () => (kolektorQ.data ?? []).map((o) => ({ id: o.id, nama: o.nama })),
    [kolektorQ.data],
  );

  return (
    <>
      <KepalaHalaman
        judul="Harian"
        keterangan={`${t === hariIni ? "Hari ini · " : ""}${formatTanggal(t)}. Pembatalan hanya bisa di hari yang sama.`}
        aksi={
          <PilihTanggal
            nilai={t}
            paling={hariIni}
            ubah={(baru) =>
              void navigasi({
                search: (s) => ({ ...s, tanggal: baru === hariIni ? undefined : baru }),
              })
            }
          />
        }
      />
      <Tabs
        value={tab ?? "sore"}
        onValueChange={(v) =>
          void navigasi({
            search: (s) => ({ ...s, tab: v === "sore" ? undefined : (v as Exclude<Tab, "sore">) }),
          })
        }
      >
        <TabsList>
          <TabsTrigger value="sore">Setoran sore</TabsTrigger>
          <TabsTrigger value="setoran">Setoran nasabah</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
          <TabsTrigger value="biaya">Biaya tak terduga</TabsTrigger>
        </TabsList>
        <TabsContent value="sore" className="space-y-3">
          <SetoranSore tanggal={t} hariIni={hariIni} />
        </TabsContent>
        <TabsContent value="setoran" className="space-y-3">
          <SetoranNasabah tanggal={t} hariIni={hariIni} kolektor={kolektor} />
        </TabsContent>
        <TabsContent value="transfer" className="space-y-3">
          <DaftarTransfer tanggal={t} hariIni={hariIni} />
        </TabsContent>
        <TabsContent value="biaya" className="flex flex-col gap-3">
          <DaftarBiaya tanggal={t} hariIni={hariIni} kolektor={kolektor} />
        </TabsContent>
      </Tabs>
    </>
  );
}
