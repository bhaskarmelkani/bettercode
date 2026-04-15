import { describe, expect, test } from "bun:test"
import { filterSlash } from "../src/hooks/useSlashCommands"
import { slashWin } from "../src/components/SlashMenu"

describe("filterSlash", () => {
  test("returns the full filtered match set", () => {
    const all = Array.from({ length: 10 }, (_, i) => ({
      name: `cmd${i}`,
      description: `command ${i}`,
    }))

    expect(filterSlash(all, "cmd")).toHaveLength(10)
  })

  test("keeps prefix filtering behavior", () => {
    const all = [
      { name: "compact", description: "" },
      { name: "compare", description: "" },
      { name: "review", description: "" },
    ]

    expect(filterSlash(all, "com").map((item) => item.name)).toEqual(["compact", "compare"])
  })
})

describe("slashWin", () => {
  test("shows the first window when the focused row is near the top", () => {
    expect(slashWin(10, 1)).toEqual({ start: 0, end: 6 })
  })

  test("scrolls the window down as the focused row moves", () => {
    expect(slashWin(10, 7)).toEqual({ start: 4, end: 10 })
  })

  test("shows the whole list when it fits inside the menu", () => {
    expect(slashWin(4, 3)).toEqual({ start: 0, end: 4 })
  })
})
