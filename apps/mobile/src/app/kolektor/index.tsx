import type { KartuTagih } from "@naelcapital/contracts";
import { kunciWilayah } from "@naelcapital/domain";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import {
  Ikon,
  Isian,
  IsianUang,
  Kartu,
  Keterangan,
  KotakAngka,
  Lencana,
  Memuat,
  PesanGalat,
  Pilihan,
  Spanduk,
  Tombol,
  WARNA,
} from "../../komponen/ui";
import { api } from "../../lib/api";
import { NAMA_JENIS, rupiah, tanggalPanjang } from "../../lib/format";
import { bacaGerbang, tulis, useHariIni, useTagihan, useTulis } from "../../lib/lapangan";
import { sesi, useSesi } from "../../lib/sesi";

/**
 * KERJA HARIAN KOLEKTOR — absen pagi, lalu daftar tagih pegangan per kampung.
 * Kartu yang sudah dicatat hari ini (setoran / libur) ditandai (C3).
 */
export default function KerjaHarian() {
  const s = useSesi();
  const hariIni = useHariIni();
  const tagihan = useTagihan();
  const [cari, setCari] = useState("");

  const bagian = useMemo(() => {
    const kunci = kunciWilayah(cari);
    const cocok = (tagihan.data ?? []).filter(
      (p) =>
        !kunci ||
        kunciWilayah(p.nasabah.nama).includes(kunci) ||
        kunciWilayah(p.nasabah.kampung).includes(kunci),
    );
    const perKampung = new Map<string, KartuTagih[]>();
    for (const p of cocok)
      perKampung.set(p.nasabah.kampung, [...(perKampung.get(p.nasabah.kampung) ?? []), p]);
    return [...perKampung].map(([title, data]) => ({ title, data }));
  }, [tagihan.data, cari]);

  const segarkan = () => {
    void hariIni.refetch();
    void tagihan.refetch();
  };

  if (hariIni.isPending) return <Memuat teks="Memuat kerja hari ini…" />;
  if (hariIni.isError) {
    return (
      <View className="flex-1 gap-4 bg-slate-50 px-5 py-6">
        <PesanGalat pesan={hariIni.error.message} />
        <Tombol judul="Coba lagi" ikon="refresh" onPress={segarkan} />
      </View>
    );
  }

  const keadaan = hariIni.data;
  const gerbang = bacaGerbang(keadaan);
  const semua = tagihan.data ?? [];
  const dicatat = semua.filter((p) => p.hariIni);
  const storting = dicatat.reduce(
    (n, p) => n + (p.hariIni?.jenis === "angsuran" ? p.hariIni.storting : 0),
    0,
  );

  return (
    <SectionList
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 40 }}
      sections={bagian}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={hariIni.isRefetching || tagihan.isRefetching}
          onRefresh={segarkan}
        />
      }
      ListHeaderComponent={
        <View className="gap-4 px-5 pt-2 pb-3">
          <View className="gap-0.5">
            <Text className="text-sm font-medium text-emerald-700">
              {tanggalPanjang(keadaan.kalender.tanggal)}
            </Text>
            <Text className="text-2xl font-bold tracking-tight text-slate-900">
              Halo, {s?.pengguna.nama}
            </Text>
            <Text className="text-sm text-slate-500">{s?.pengguna.kantor.nama}</Text>
          </View>

          {gerbang.judul ? <Spanduk judul={gerbang.judul} isi={gerbang.isi} /> : null}
          {gerbang.perluAbsen ? <FormulirAbsen /> : null}

          {keadaan.hari?.absensi === "masuk_kerja" ? (
            <View className="flex-row gap-3">
              <KotakAngka
                label="Dicatat"
                ikon="checkmark-done"
                nilai={`${dicatat.length} / ${semua.length}`}
              />
              <KotakAngka label="Setoran" ikon="cash-outline" nilai={rupiah(storting)} />
            </View>
          ) : null}

          {gerbang.buka ? (
            <Tombol
              judul="Akad baru"
              ikon="add-circle-outline"
              onPress={() => router.push("/kolektor/akad")}
            />
          ) : null}

          <Isian
            ikon="search"
            value={cari}
            onChangeText={setCari}
            placeholder="Cari nama atau kampung"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {tagihan.isError ? <PesanGalat pesan={tagihan.error.message} /> : null}
          {tagihan.isPending ? <ActivityIndicator color={WARNA.utama} /> : null}
          {tagihan.data && semua.length === 0 ? (
            <View className="items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-8">
              <Ikon nama="people-outline" ukuran={28} warna={WARNA.redup} />
              <Keterangan>Belum ada pinjaman aktif di pegangan Anda.</Keterangan>
            </View>
          ) : null}
          {tagihan.data && semua.length > 0 && bagian.length === 0 ? (
            <Keterangan>Tidak ada yang cocok dengan pencarian ini.</Keterangan>
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center gap-2 px-5 pt-4 pb-2">
          <Ikon nama="location-outline" ukuran={14} warna={WARNA.redup} />
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {section.title} · {section.data.length}
          </Text>
        </View>
      )}
      renderItem={({ item }) => <BarisTagih p={item} tanggal={keadaan.kalender.tanggal} />}
      ListFooterComponent={<KakiKerja laporanBisa={gerbang.buka} />}
    />
  );
}

function BarisTagih({ p, tanggal }: { p: KartuTagih; tanggal: string }) {
  const lencana =
    p.hariIni?.jenis === "angsuran" ? (
      <Lencana teks={`Setor ${rupiah(p.hariIni.storting)}`} warna="hijau" />
    ) : p.hariIni?.jenis === "libur" ? (
      <Lencana teks="Libur" warna="kuning" />
    ) : p.tanggalAkad === tanggal ? (
      <Lencana teks="Akad hari ini" />
    ) : null;
  const kemajuan =
    p.jenis === "tempoan"
      ? `jatuh tempo ${p.jatuhTempo ?? "-"}`
      : `angsuran ${p.angsuranKe}/${p.tenor}`;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/kolektor/pinjaman/[id]", params: { id: p.id } })}
      className={`mx-5 mb-2 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-100 ${p.hariIni ? "opacity-70" : ""}`}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${p.hariIni ? "bg-emerald-100" : "bg-slate-100"}`}
      >
        {p.hariIni ? (
          <Ikon nama="checkmark" ukuran={18} warna={WARNA.utama} />
        ) : (
          <Text className="text-sm font-bold text-slate-600">
            {p.nasabah.nama.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-base font-semibold text-slate-900">{p.nasabah.nama}</Text>
          {p.status === "macet" ? <Lencana teks="Macet" warna="merah" /> : null}
        </View>
        <Text className="text-sm text-slate-600">
          {NAMA_JENIS[p.jenis]} ke-{p.pinjamanKe} · {kemajuan}
        </Text>
        {lencana}
      </View>
      <View className="items-end">
        <Text className="text-base font-bold text-slate-900">{rupiah(p.angsuran)}</Text>
        <Text className="text-xs text-slate-500">saldo {rupiah(p.saldo)}</Text>
      </View>
      <Ikon nama="chevron-forward" ukuran={18} warna="#94a3b8" />
    </Pressable>
  );
}

function FormulirAbsen() {
  const [absensi, setAbsensi] = useState<"masuk_kerja" | "tidak_kerja">("masuk_kerja");
  const [kasLapangan, setKasLapangan] = useState(0);
  const [uangJalan, setUangJalan] = useState(0);
  const [alasan, setAlasan] = useState("");
  const absen = useTulis(tulis.absen);

  const simpan = () =>
    absen.mutate(
      absensi === "masuk_kerja"
        ? { absensi, kasLapangan, uangJalan }
        : { absensi, alasan: alasan.trim() },
    );

  return (
    <Kartu>
      <Text className="text-lg font-bold text-slate-900">Absen pagi</Text>
      <Pilihan
        segmen
        pilihan={[
          { nilai: "masuk_kerja", teks: "Masuk kerja" },
          { nilai: "tidak_kerja", teks: "Tidak kerja" },
        ]}
        nilai={absensi}
        onPilih={setAbsensi}
      />
      {absensi === "masuk_kerja" ? (
        <>
          <IsianUang
            label="Kas lapangan (modal dari bos)"
            nilai={kasLapangan}
            onUbah={setKasLapangan}
          />
          <IsianUang label="Uang jalan" nilai={uangJalan} onUbah={setUangJalan} />
        </>
      ) : (
        <Isian
          label="Alasan"
          value={alasan}
          onChangeText={setAlasan}
          placeholder="Sakit, urusan keluarga, …"
          maxLength={100}
        />
      )}
      <PesanGalat pesan={absen.error?.message} />
      <Tombol
        judul="Simpan absen"
        ikon="checkmark-circle-outline"
        memuat={absen.isPending}
        nonaktif={absensi === "tidak_kerja" && !alasan.trim()}
        onPress={simpan}
      />
    </Kartu>
  );
}

function KakiKerja({ laporanBisa }: { laporanBisa: boolean }) {
  const laporan = useTulis(tulis.laporan);
  const [keluarBerjalan, setKeluarBerjalan] = useState(false);

  const bukaLaporan = () =>
    Alert.alert(
      "Buka laporan?",
      "Sesudah laporan dibuka, setoran, akad, gulung, dan libur hari ini tidak bisa dicatat lagi.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Buka laporan", style: "destructive", onPress: () => laporan.mutate() },
      ],
    );

  const keluar = async () => {
    setKeluarBerjalan(true);
    await api.auth.keluar.$post().catch(() => null);
    await sesi.hapus();
    router.replace("/tautkan");
  };

  return (
    <View className="gap-3 px-5 pt-6">
      {laporanBisa ? (
        <>
          <PesanGalat pesan={laporan.error?.message} />
          <Tombol
            judul="Buka laporan hari ini"
            jenis="kedua"
            ikon="document-text-outline"
            memuat={laporan.isPending}
            onPress={bukaLaporan}
          />
        </>
      ) : null}
      <Tombol
        judul="Keluar dari HP ini"
        jenis="bahaya"
        ikon="log-out-outline"
        memuat={keluarBerjalan}
        onPress={() =>
          Alert.alert("Keluar?", "HP ini perlu ditautkan ulang oleh bos untuk masuk lagi.", [
            { text: "Batal", style: "cancel" },
            { text: "Keluar", style: "destructive", onPress: () => void keluar() },
          ])
        }
      />
    </View>
  );
}
