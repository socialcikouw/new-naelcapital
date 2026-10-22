/**
 * Pelanggaran aturan usaha — `kode` stabil (dijawab API apa adanya), pesan
 * untuk orang. Fungsi domain melempar ini; server menerjemahkannya ke 422.
 */
export class GalatAturan extends Error {
  constructor(
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatAturan";
  }
}

export function wajib(terpenuhi: boolean, kode: string, pesan: string): asserts terpenuhi {
  if (!terpenuhi) throw new GalatAturan(kode, pesan);
}
