/**
 * KAS HARIAN KOLEKTOR — docs/aturan-usaha.md bagian I. Angka masukan
 * dijumlahkan server dari catatan hari itu (setoran, akad, transfer, biaya);
 * di sini hanya rumusnya.
 */

/** Rincian satu hari kolektor yang menyusun tunai seharusnya. */
export interface RincianKas {
  kasLapangan: number;
  /** Σ storting setoran berlaku (negatif bila tabungan melebihi saldo saat lunas). */
  storting: number;
  /** Σ potongan tabungan akad berlaku hari itu. */
  tabunganMasuk: number;
  /** Σ potongan admin akad berlaku hari itu. */
  potonganAdmin: number;
  /** Σ droping akad berlaku hari itu (pokok penuh; gulung: drop baru + drop gulung). */
  droping: number;
  /** Σ transfer setoran berlaku (+ arsip transfer lama). */
  transfer: number;
  /** Σ biaya tak terduga berlaku. */
  biaya: number;
}

/**
 * I1. Tunai yang seharusnya diserahkan kolektor sore hari. Potongan tabungan
 * & admin ditambahkan kembali karena droping mencatat pokok penuh; uang jalan
 * tidak masuk. Boleh negatif (droping melebihi uang masuk).
 */
export function tunaiSeharusnya(r: RincianKas): number {
  return (
    r.kasLapangan +
    r.storting +
    r.tabunganMasuk +
    r.potonganAdmin -
    r.droping -
    r.transfer -
    r.biaya
  );
}

/** I2. Tekor (kurang setor, dipotong dari gaji) dan lebih setor dari `selisih_setor`. */
export function tekorDanLebih(selisihSetor: number): { tekor: number; lebihSetor: number } {
  return { tekor: Math.max(-selisihSetor, 0), lebihSetor: Math.max(selisihSetor, 0) };
}

/**
 * I3. Paling banyak bagian setoran yang boleh dicatat lewat transfer: uang
 * yang benar-benar dibayar nasabah. Gulung = 0 (tak ada uang dari nasabah).
 */
export function batasTransfer(t: {
  jenis: "angsuran" | "pelunasan" | "gulung";
  setoranMurni: number;
  setoranPelunasan: number;
}): number {
  switch (t.jenis) {
    case "angsuran":
      return t.setoranMurni + t.setoranPelunasan;
    case "pelunasan":
      return t.setoranMurni;
    case "gulung":
      return 0;
  }
}
