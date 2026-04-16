import type { Binding, BindingFile, Action, Context, Keymap } from "./schema"
import { ACTIONS, CONTEXTS } from "./schema"
import { defaults } from "./defaults"

type Flags = {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  tab?: boolean
  return?: boolean
  escape?: boolean
  backspace?: boolean
  delete?: boolean
  pageDown?: boolean
  pageUp?: boolean
  upArrow?: boolean
  downArrow?: boolean
  leftArrow?: boolean
  rightArrow?: boolean
}

const shiftEnter = new Set(["[27;2;13~", "[13;2u", "[27;2u"])
const actionSet = new Set<string>(ACTIONS)
const contextSet = new Set<string>(CONTEXTS)

export function parseKey(raw: string): string | undefined {
  const key = raw.trim().toLowerCase()
  if (!key) return
  const parts = key
    .split("+")
    .map((item) => item.trim())
    .filter(Boolean)
  if (parts.length === 0) return
  const mods = new Set<string>()
  let base = ""
  for (const part of parts) {
    if (part === "cmd" || part === "command") {
      mods.add("meta")
      continue
    }
    if (part === "option") {
      mods.add("meta")
      continue
    }
    if (part === "control") {
      mods.add("ctrl")
      continue
    }
    if (part === "enter") {
      base = "return"
      continue
    }
    if (part === "esc") {
      base = "escape"
      continue
    }
    if (part === "pgup" || part === "page-up") {
      base = "pageup"
      continue
    }
    if (part === "pgdn" || part === "page-down") {
      base = "pagedown"
      continue
    }
    if (part === "arrowup") {
      base = "up"
      continue
    }
    if (part === "arrowdown") {
      base = "down"
      continue
    }
    if (part === "arrowleft") {
      base = "left"
      continue
    }
    if (part === "arrowright") {
      base = "right"
      continue
    }
    if (part === " ") {
      base = "space"
      continue
    }
    if (part === "ctrl" || part === "meta" || part === "shift") {
      mods.add(part)
      continue
    }
    if (base) return
    base = part
  }
  if (!base) return
  const head = ["ctrl", "meta", "shift"].filter((item) => mods.has(item))
  return [...head, base].join("+")
}

export function formatKey(raw: string): string {
  const key = parseKey(raw) ?? raw
  if (key === "shift+tab") return "shift + tab"
  const parts = key.split("+")
  const base = parts.pop() ?? key
  const tail =
    base === "return"
      ? "enter"
      : base === "escape"
        ? "esc"
        : base === "pageup"
          ? "pgup"
          : base === "pagedown"
            ? "pgdn"
            : base
  return [...parts, tail].join("+")
}

export function normalizeKey(input: string, key: Flags): string | undefined {
  if (input && shiftEnter.has(input)) return "shift+return"
  if (key.tab && key.shift) return "shift+tab"
  if (key.return) return parseKey(`${mods(key)}return`)
  if (key.escape) return "escape"
  if (key.backspace) return "backspace"
  if (key.delete) return "delete"
  if (key.pageUp) return "pageup"
  if (key.pageDown) return "pagedown"
  if (key.upArrow) return parseKey(`${mods(key)}up`)
  if (key.downArrow) return parseKey(`${mods(key)}down`)
  if (key.leftArrow) return parseKey(`${mods(key)}left`)
  if (key.rightArrow) return parseKey(`${mods(key)}right`)
  if (key.tab) return "tab"
  if (!input || input.startsWith("[<") || input.startsWith("[M") || input.startsWith("\u001b")) return
  if (input === " ") return "space"
  if (input === "\t") return "tab"
  const base = input.length === 1 ? input.toLowerCase() : input
  return parseKey(`${mods(key)}${base}`)
}

function mods(key: Flags) {
  const out: string[] = []
  if (key.ctrl) out.push("ctrl+")
  if (key.meta) out.push("meta+")
  if (key.shift) out.push("shift+")
  return out.join("")
}

function normalizeBinding(item: Binding): Binding | undefined {
  if (!contextSet.has(item.context)) return
  const key = parseKey(item.key)
  if (!key) return
  return { context: item.context, key }
}

export function mergeBindings(...list: Array<BindingFile | undefined>): Keymap {
  const out = Object.fromEntries(ACTIONS.map((action) => [action, defaults[action].slice()])) as Keymap
  for (const file of list) {
    if (!file) continue
    for (const [name, value] of Object.entries(file)) {
      if (!actionSet.has(name) || !Array.isArray(value)) continue
      const next = value.map((item) => normalizeBinding(item)).filter((item): item is Binding => !!item)
      out[name as Action] = next
    }
  }
  return out
}

export function parseBindings(input: unknown): BindingFile | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return
  const out: BindingFile = {}
  for (const [name, value] of Object.entries(input)) {
    if (!actionSet.has(name) || !Array.isArray(value)) continue
    const list = value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return
        const context = "context" in item && typeof item.context === "string" ? item.context : ""
        const key = "key" in item && typeof item.key === "string" ? item.key : ""
        return normalizeBinding({ context: context as Context, key })
      })
      .filter((item): item is Binding => !!item)
    out[name as Action] = list
  }
  return out
}

export function primaryBinding(bindings: Keymap, action: Action, contexts?: Context[]): Binding | undefined {
  const list = bindings[action] ?? []
  if (!contexts || contexts.length === 0) return list[0]
  for (const ctx of contexts) {
    const hit = list.find((item) => item.context === ctx)
    if (hit) return hit
  }
  return list[0]
}

export function primaryKey(bindings: Keymap, action: Action, contexts?: Context[]): string {
  const item = primaryBinding(bindings, action, contexts)
  return item ? formatKey(item.key) : ""
}

export function resolveAction(
  bindings: Keymap,
  input: string,
  key: Flags,
  contexts: Context[],
): Action | undefined {
  const name = normalizeKey(input, key)
  if (!name) return
  for (const ctx of contexts) {
    const hit = ACTIONS.find((action) => bindings[action].some((item) => item.context === ctx && item.key === name))
    if (hit) return hit
  }
}
