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
  Isian,
  IsianUang,
  Kartu,
  Keterangan,
  Lencana,
  PesanGalat,
  Pilihan,
  Spanduk,
  Tombol,
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

  if (hariIni.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (hariIni.isError) {
    return (
      <View className="flex-1 gap-4 bg-white px-5 py-6">
        <PesanGalat pesan={hariIni.error.message} />
        <Tombol judul="Coba lagi" onPress={segarkan} />
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
      className="flex-1 bg-white"
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
        <View className="gap-4 px-5 pt-5 pb-2">
          <View className="gap-0.5">
            <Text className="text-lg font-bold text-slate-900">
              {tanggalPanjang(keadaan.kalender.tanggal)}
            </Text>
            <Text className="text-sm text-slate-600">
              {s?.pengguna.nama} · {s?.pengguna.kantor.nama}
            </Text>
          </View>

          {gerbang.judul ? <Spanduk judul={gerbang.judul} isi={gerbang.isi} /> : null}
          {gerbang.perluAbsen ? <FormulirAbsen /> : null}

          {keadaan.hari?.absensi === "masuk_kerja" ? (
            <Kartu>
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-600">Dicatat hari ini</Text>
                <Text className="text-sm font-semibold text-slate-900">
                  {dicatat.length} dari {semua.length}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-600">Setoran angsuran</Text>
                <Text className="text-sm font-semibold text-slate-900">{rupiah(storting)}</Text>
              </View>
            </Kartu>
          ) : null}

          {gerbang.buka ? (
            <Tombol judul="+ Akad baru" onPress={() => router.push("/kolektor/akad")} />
          ) : null}

          <Isian
            label="Cari nasabah atau kampung"
            value={cari}
            onChangeText={setCari}
            placeholder="Nama / kampung"
            autoCorrect={false}
          />
          {tagihan.isError ? <PesanGalat pesan={tagihan.error.message} /> : null}
          {tagihan.isPending ? <ActivityIndicator /> : null}
          {tagihan.data && semua.length === 0 ? (
            <Keterangan>Belum ada pinjaman aktif di pegangan Anda.</Keterangan>
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text className="bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {section.title} · {section.data.length}
        </Text>
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
      className={`flex-row items-center gap-3 border-b border-slate-100 px-5 py-3 active:bg-slate-50 ${p.hariIni ? "opacity-60" : ""}`}
    >
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
        <Text className="text-base font-semibold text-slate-900">{rupiah(p.angsuran)}</Text>
        <Text className="text-xs text-slate-500">saldo {rupiah(p.saldo)}</Text>
      </View>
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
            memuat={laporan.isPending}
            onPress={bukaLaporan}
          />
        </>
      ) : null}
      <Tombol
        judul="Keluar dari HP ini"
        jenis="kedua"
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
