/**
 * Tests for useTextInput pure helpers.
 * The hook wraps these in useState; the pure functions are the stable contract.
 *
 * M5 will replace these with cursor-aware variants.
 * Until then these verify the append-only baseline that Composer relies on.
 */
import { describe, test, expect } from "bun:test"
import { textInsert, textDel } from "../src/hooks/useTextInput"

// ---------------------------------------------------------------------------
// textInsert — append to end
// ---------------------------------------------------------------------------

describe("textInsert — append", () => {
  test("appends a single character to empty string", () => {
    expect(textInsert("", "a")).toBe("a")
  })

  test("appends a character to non-empty string", () => {
    expect(textInsert("hello", "!")).toBe("hello!")
  })

  test("appends a multi-char chunk (paste)", () => {
    expect(textInsert("hello", " world")).toBe("hello world")
  })

  test("appending empty string leaves value unchanged", () => {
    expect(textInsert("hello", "")).toBe("hello")
  })

  test("appending @ trigger character works", () => {
    expect(textInsert("", "@")).toBe("@")
    expect(textInsert("attach ", "@")).toBe("attach @")
  })

  test("appending slash command trigger works", () => {
    expect(textInsert("", "/")).toBe("/")
    expect(textInsert("/", "c")).toBe("/c")
  })
})

// ---------------------------------------------------------------------------
// textDel — delete last character (append-only backspace)
// ---------------------------------------------------------------------------

describe("textDel — delete last char", () => {
  test("deletes the last character", () => {
    expect(textDel("hello")).toBe("hell")
  })

  test("empties a single-character string", () => {
    expect(textDel("x")).toBe("")
  })

  test("empty string stays empty (no-crash boundary)", () => {
    expect(textDel("")).toBe("")
  })

  test("deletes trailing space", () => {
    expect(textDel("hello ")).toBe("hello")
  })

  test("deletes trailing slash (slash command clearing)", () => {
    expect(textDel("/compact ")).toBe("/compact")
  })
})

// ---------------------------------------------------------------------------
// Parity: composerAppend scenario
// The Composer handles server-appended text via:
//   setValue(v => v + composerAppend)  →  insert(composerAppend)
// ---------------------------------------------------------------------------

describe("composerAppend parity", () => {
  test("appending server text produces same result as setValue callback", () => {
    const start = "fix the"
    const appended = " bug"
    // Old: setValue(v => v + composerAppend)
    const legacyResult = start + appended
    // New: textInsert(start, appended)
    expect(textInsert(start, appended)).toBe(legacyResult)
  })
})

// ---------------------------------------------------------------------------
// Parity: stash restore scenario
// Ctrl+Y: setValue(v => v + stash)
// ---------------------------------------------------------------------------

describe("stash restore parity", () => {
  test("appending stash to existing value", () => {
    const current = ""
    const stashed = "fix the login bug"
    expect(textInsert(current, stashed)).toBe(stashed)
  })

  test("appending stash to partially typed value", () => {
    const current = "also "
    const stashed = "fix the login bug"
    expect(textInsert(current, stashed)).toBe("also fix the login bug")
  })
})
