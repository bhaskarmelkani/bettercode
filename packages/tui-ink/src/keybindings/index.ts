import { readFile } from "fs/promises"
import { join } from "path"
import { mergeBindings, parseBindings } from "./resolve"
import type { Keymap } from "./schema"

function configRoot() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~"
  const xdg = process.env.XDG_CONFIG_HOME
  return xdg ? join(xdg, "opencode") : join(home, ".config", "opencode")
}

function paths() {
  const out = [join(configRoot(), "keybindings.json")]
  const dir = process.env.OPENCODE_CONFIG_DIR
  if (dir) out.push(join(dir, "keybindings.json"))
  return out
}

export async function readKeybindings(): Promise<Keymap> {
  const files = await Promise.all(
    paths().map(async (file) => {
      try {
        return parseBindings(JSON.parse(await readFile(file, "utf8")))
      } catch {
        return
      }
    }),
  )
  return mergeBindings(...files)
}

export * from "./schema"
export * from "./defaults"
export * from "./resolve"
