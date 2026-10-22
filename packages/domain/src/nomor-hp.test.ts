import { describe, expect, test } from "bun:test";
import { bakukanNomorHp } from "./nomor-hp";

describe("bakukanNomorHp", () => {
  test("bentuk yang biasa diketik menjadi E.164", () => {
    expect(bakukanNomorHp("081234567890")).toBe("+6281234567890");
    expect(bakukanNomorHp("0812-3456-7890")).toBe("+6281234567890");
    expect(bakukanNomorHp("62812 3456 7890")).toBe("+6281234567890");
    expect(bakukanNomorHp(" +62 812 3456 7890 ")).toBe("+6281234567890");
  });

  test("yang bukan nomor ditolak", () => {
    expect(bakukanNomorHp("")).toBeNull();
    expect(bakukanNomorHp("abc")).toBeNull();
    expect(bakukanNomorHp("812345")).toBeNull();
    expect(bakukanNomorHp("0812")).toBeNull();
    expect(bakukanNomorHp("+62812345678901234567")).toBeNull();
  });
});
