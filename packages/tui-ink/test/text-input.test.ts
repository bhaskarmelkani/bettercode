/**
 * Tests for useTextInput pure helpers.
 * M4 baseline: append-only textInsert / textDel (kept for compat).
 * M5 additions: cursor-aware textInsertAt, textDelAt, textDelForward, textDelWord.
 * M6 additions: lineCount, cursorLineIdx, cursorLineUp, cursorLineDown, newline via textInsertAt.
 */
import { describe, test, expect } from "bun:test"
import {
  textInsert,
  textDel,
  textInsertAt,
  textDelAt,
  textDelForward,
  textDelWord,
  lineCount,
  cursorLineIdx,
  cursorLineUp,
  cursorLineDown,
} from "../src/hooks/useTextInput"

// ---------------------------------------------------------------------------
// M4 baseline — kept for backward compat
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

describe("composerAppend parity", () => {
  test("appending server text produces same result as setValue callback", () => {
    const start = "fix the"
    const appended = " bug"
    expect(textInsert(start, appended)).toBe(start + appended)
  })
})

describe("stash restore parity", () => {
  test("appending stash to existing value", () => {
    expect(textInsert("", "fix the login bug")).toBe("fix the login bug")
  })

  test("appending stash to partially typed value", () => {
    expect(textInsert("also ", "fix the login bug")).toBe("also fix the login bug")
  })
})

// ---------------------------------------------------------------------------
// M5 cursor-aware helpers
// ---------------------------------------------------------------------------

describe("textInsertAt — insert at cursor", () => {
  test("insert at end (cursor = length)", () => {
    expect(textInsertAt("hello", 5, "!")).toEqual(["hello!", 6])
  })

  test("insert at start (cursor = 0)", () => {
    expect(textInsertAt("hello", 0, "X")).toEqual(["Xhello", 1])
  })

  test("insert in middle", () => {
    expect(textInsertAt("hello", 2, "XY")).toEqual(["heXYllo", 4])
  })

  test("insert into empty string", () => {
    expect(textInsertAt("", 0, "a")).toEqual(["a", 1])
  })

  test("cursor advances by inserted length", () => {
    const [, c] = textInsertAt("abc", 1, "ZZ")
    expect(c).toBe(3)
  })
})

describe("textDelAt — backspace at cursor", () => {
  test("delete char before end (cursor = length)", () => {
    expect(textDelAt("hello", 5)).toEqual(["hell", 4])
  })

  test("delete char before start boundary — no-op", () => {
    expect(textDelAt("hello", 0)).toEqual(["hello", 0])
  })

  test("delete in middle", () => {
    expect(textDelAt("hello", 3)).toEqual(["helo", 2])
  })

  test("empty string — no-op", () => {
    expect(textDelAt("", 0)).toEqual(["", 0])
  })

  test("delete only character", () => {
    expect(textDelAt("x", 1)).toEqual(["", 0])
  })

  test("cursor moves back by one", () => {
    const [, c] = textDelAt("abc", 2)
    expect(c).toBe(1)
  })
})

describe("textDelForward — forward delete at cursor", () => {
  test("delete char after cursor in middle", () => {
    expect(textDelForward("hello", 2)).toEqual(["helo", 2])
  })

  test("delete at start deletes first char", () => {
    expect(textDelForward("hello", 0)).toEqual(["ello", 0])
  })

  test("delete at end — no-op (cursor at length)", () => {
    expect(textDelForward("hello", 5)).toEqual(["hello", 5])
  })

  test("empty string — no-op", () => {
    expect(textDelForward("", 0)).toEqual(["", 0])
  })

  test("cursor does not move", () => {
    const [, c] = textDelForward("abc", 1)
    expect(c).toBe(1)
  })
})

describe("textDelWord — Ctrl+W delete word backward", () => {
  test("delete word at end", () => {
    expect(textDelWord("hello world", 11)).toEqual(["hello ", 6])
  })

  test("delete word at start — no-op", () => {
    expect(textDelWord("hello", 0)).toEqual(["hello", 0])
  })

  test("delete entire content when single word", () => {
    expect(textDelWord("hello", 5)).toEqual(["", 0])
  })

  test("skip trailing spaces then delete word", () => {
    expect(textDelWord("hello world ", 12)).toEqual(["hello ", 6])
  })

  test("delete word in middle of text", () => {
    // cursor at 11 = the space between "world" and " foo"
    // algorithm skips no trailing spaces (value[10]='d'), then deletes "world" back to position 6
    // leaving value.slice(0,6) + value.slice(11) = "hello " + " foo" = "hello  foo"
    const [v, c] = textDelWord("hello world foo", 11)
    expect(v).toBe("hello  foo")
    expect(c).toBe(6)
  })

  test("cursor at boundary between space and word", () => {
    // cursor=6 = right after the space in "hello world" (before 'w')
    // algorithm skips the space at position 5 (trailing space scan), then deletes "hello"
    // leaving value.slice(0,0) + value.slice(6) = "" + "world" = "world"
    const [v, c] = textDelWord("hello world", 6)
    expect(v).toBe("world")
    expect(c).toBe(0)
  })

  test("multiple leading spaces — skips spaces then deletes word", () => {
    // "abc   " with cursor at 6
    const [v, c] = textDelWord("abc   ", 6)
    expect(v).toBe("")
    expect(c).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases — composerAppend with cursor at non-end position
// The hook's setValue always moves cursor to end of the new value.
// This test documents the expected contract.
// ---------------------------------------------------------------------------

describe("composerAppend contract", () => {
  test("textInsertAt at end matches legacy append", () => {
    const value = "fix the"
    const appended = " bug"
    const [v, c] = textInsertAt(value, value.length, appended)
    expect(v).toBe("fix the bug")
    expect(c).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// M6 multi-line pure helpers
// ---------------------------------------------------------------------------

describe("lineCount", () => {
  test("empty string returns 1", () => {
    expect(lineCount("")).toBe(1)
  })

  test("single line with no newline returns 1", () => {
    expect(lineCount("hello")).toBe(1)
  })

  test("two lines", () => {
    expect(lineCount("hello\nworld")).toBe(2)
  })

  test("three lines", () => {
    expect(lineCount("a\nb\nc")).toBe(3)
  })

  test("trailing newline counts as an extra line", () => {
    expect(lineCount("hello\n")).toBe(2)
  })
})

describe("cursorLineIdx", () => {
  test("cursor at start of single line returns 0", () => {
    expect(cursorLineIdx("hello", 0)).toBe(0)
  })

  test("cursor at end of single line returns 0", () => {
    expect(cursorLineIdx("hello", 5)).toBe(0)
  })

  test("cursor at start of second line returns 1", () => {
    // "hello\nworld" — second line starts at index 6
    expect(cursorLineIdx("hello\nworld", 6)).toBe(1)
  })

  test("cursor at end of second line returns 1", () => {
    expect(cursorLineIdx("hello\nworld", 11)).toBe(1)
  })

  test("cursor on third line returns 2", () => {
    // "a\nb\nc" — third line starts at index 4
    expect(cursorLineIdx("a\nb\nc", 4)).toBe(2)
  })
})

describe("cursorLineUp", () => {
  test("single line — cursor stays unchanged", () => {
    expect(cursorLineUp("hello", 3)).toBe(3)
  })

  test("second line col 2 → same col on first line", () => {
    // "hello\nworld", cursor=8 → on "world" at col 2 ("wo")
    expect(cursorLineUp("hello\nworld", 8)).toBe(2)
  })

  test("second line col exceeds first line length → clamp to first line end", () => {
    // "hi\nworld", cursor=8 → on "world" at col 5, first line "hi" length 2 → clamp to 2
    expect(cursorLineUp("hi\nworld", 8)).toBe(2)
  })

  test("second line col 0 → first line col 0", () => {
    expect(cursorLineUp("hello\nworld", 6)).toBe(0)
  })
})

describe("cursorLineDown", () => {
  test("last line — cursor stays unchanged", () => {
    expect(cursorLineDown("hello\nworld", 8)).toBe(8)
  })

  test("first line col 2 → same col on second line", () => {
    // "hello\nworld", cursor=2 → col 2, next line "world" → nextStart=6+min(2,5)=8
    expect(cursorLineDown("hello\nworld", 2)).toBe(8)
  })

  test("first line col exceeds second line length → clamp to second line end", () => {
    // "hello\nhi", cursor=4 → col 4, next line "hi" length 2 → nextStart=6+min(4,2)=8
    expect(cursorLineDown("hello\nhi", 4)).toBe(8)
  })

  test("first line col 0 → second line col 0", () => {
    expect(cursorLineDown("hello\nworld", 0)).toBe(6)
  })

  test("single line — cursor stays unchanged", () => {
    expect(cursorLineDown("hello", 2)).toBe(2)
  })
})

describe("newline insertion via textInsertAt", () => {
  test("insert newline at end splits to two lines", () => {
    const [v, c] = textInsertAt("hello", 5, "\n")
    expect(v).toBe("hello\n")
    expect(c).toBe(6)
    expect(lineCount(v)).toBe(2)
  })

  test("insert newline in middle splits line", () => {
    const [v, c] = textInsertAt("hello world", 5, "\n")
    expect(v).toBe("hello\n world")
    expect(c).toBe(6)
    expect(lineCount(v)).toBe(2)
  })

  test("insert two newlines creates three lines", () => {
    const [v1] = textInsertAt("abc", 3, "\n")
    const [v2] = textInsertAt(v1, v1.length, "\n")
    expect(lineCount(v2)).toBe(3)
  })
})
