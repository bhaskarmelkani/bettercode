import { describe, expect, test } from "bun:test"
import { defaults, formatKey, mergeBindings, parseBindings, primaryKey, resolveAction } from "../src/keybindings"

describe("keybindings", () => {
  test("resolves default detached scroll bindings", () => {
    expect(resolveAction(defaults, "j", { ctrl: false, meta: false, shift: false }, ["scroll"])).toBe("scrollLineDown")
    expect(resolveAction(defaults, "G", { ctrl: false, meta: false, shift: true }, ["scroll"])).toBe("scrollBottom")
  })

  test("mergeBindings lets user config replace a default action", () => {
    const out = mergeBindings({
      scrollUp: [{ context: "scroll", key: "ctrl+p" }],
    })
    expect(primaryKey(out, "scrollUp", ["scroll"])).toBe("ctrl+p")
    expect(resolveAction(out, "p", { ctrl: true }, ["scroll"])).toBe("scrollUp")
  })

  test("parseBindings ignores unknown actions and invalid keys", () => {
    const out = parseBindings({
      unknown: [{ context: "scroll", key: "ctrl+p" }],
      scrollUp: [{ context: "nope", key: "ctrl+p" }, { context: "scroll", key: "" }],
    })
    expect(out).toEqual({ scrollUp: [] })
  })

  test("formatKey humanizes labels", () => {
    expect(formatKey("return")).toBe("enter")
    expect(formatKey("escape")).toBe("esc")
    expect(formatKey("ctrl+down")).toBe("ctrl+down")
  })
})
