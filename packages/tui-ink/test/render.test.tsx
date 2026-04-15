import { describe, test, expect } from "bun:test"
import { dirname, join } from "node:path"
import { mkdir } from "node:fs/promises"
import { capture } from "../src/testing/render"
import { scenarios } from "../src/testing/scenarios"

const ROOT = dirname(import.meta.path)
const SNAP = join(ROOT, "__snapshots__", "frames")

async function match(name: string, text: string) {
  const file = join(SNAP, `${name}.txt`)
  if (process.env.UPDATE_SNAPSHOTS === "1") {
    await mkdir(SNAP, { recursive: true })
    await Bun.write(file, text)
    return
  }
  const snap = await Bun.file(file).text()
  expect(text).toBe(snap)
}

describe("render snapshots", () => {
  for (const item of scenarios) {
    test(item.name, async () => {
      const frame = await capture(item.render(), item)
      await match(item.name, frame.text)
    })
  }
})
