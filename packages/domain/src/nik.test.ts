import { expect, test } from "bun:test";
import { samarkanNik } from "./nik";

test("NIK tersamar: 4 digit awal & akhir", () => {
  expect(samarkanNik("3201234567890001")).toBe("3201********0001");
});
