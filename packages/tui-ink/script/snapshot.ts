import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { capture } from "../src/testing/render"
import { scenarios } from "../src/testing/scenarios"

const OUT = join(import.meta.dir, "..", "artifacts", "frames")

await mkdir(OUT, { recursive: true })

const rows: string[] = ["# BetterCode TUI Frames", ""]

for (const item of scenarios) {
  const frame = await capture(item.render(), item)
  await Bun.write(join(OUT, `${item.name}.ansi`), frame.ansi)
  await Bun.write(join(OUT, `${item.name}.txt`), frame.text)
  rows.push(`- ${item.name}: [${item.name}.txt](./${item.name}.txt), [${item.name}.ansi](./${item.name}.ansi)`)
}

rows.push("")
await Bun.write(join(OUT, "index.md"), rows.join("\n"))
