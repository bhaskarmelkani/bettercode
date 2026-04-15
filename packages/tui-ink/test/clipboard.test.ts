import { describe, expect, mock, test } from "bun:test"
import { copy, osc52 } from "../src/utils/clipboard"

describe("clipboard", () => {
  test("returns false for empty copy", async () => {
    expect(await copy("")).toBe(false)
  })

  test("writes an OSC52 payload", () => {
    const write = mock(() => true)
    const prev = process.stdout.write
    process.stdout.write = write as typeof process.stdout.write

    expect(osc52("hello")).toBe(true)
    expect(write).toHaveBeenCalledWith("\u001b]52;c;aGVsbG8=\u0007")

    process.stdout.write = prev
  })
})
