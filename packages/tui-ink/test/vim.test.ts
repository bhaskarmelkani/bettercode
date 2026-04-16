import { describe, it, expect } from "bun:test"
import {
  motionH, motionL,
  motionW, motionB, motionE,
  motion0, motionCaret, motionDollar,
  motionJ, motionK, motionGG, motionG,
  motionF, motionFF, motionT, motionTT,
  objectIW, objectAW, objectIQ, objectIB,
} from "../src/vim/motions"
import {
  applyDelete, applyChange, applyYank,
  applyLineDelete, applyLineYank,
  applyPaste, applyPasteAfter,
} from "../src/vim/operators"
import { initialVimState } from "../src/vim/types"

// ─── motions ──────────────────────────────────────────────────────────────────

describe("motionH / motionL", () => {
  it("h moves left, stops at line start", () => {
    expect(motionH("hello", 2)).toBe(1)
    expect(motionH("hello", 0)).toBe(0)
  })
  it("l moves right, stops before newline in normal mode", () => {
    expect(motionL("hello", 0)).toBe(1)
    expect(motionL("hi\nworld", 1)).toBe(1) // 'i' is last char on line (l cannot go to newline)
  })
})

describe("word motions", () => {
  it("w moves to next word start", () => {
    const t = "hello world foo"
    expect(motionW(t, 0)).toBe(6)   // 'w' in world
    expect(motionW(t, 6)).toBe(12)  // 'f' in foo
  })

  it("b moves to previous word start", () => {
    const t = "hello world foo"
    expect(motionB(t, 12)).toBe(6)  // 'w' in world
    expect(motionB(t, 6)).toBe(0)   // 'h' in hello
  })

  it("e moves to end of word", () => {
    const t = "hello world"
    expect(motionE(t, 0)).toBe(4)   // end of 'hello'
    expect(motionE(t, 6)).toBe(10)  // end of 'world'
  })
})

describe("line motions", () => {
  it("0 jumps to start of line", () => {
    const t = "hello\nworld"
    expect(motion0(t, 4)).toBe(0)
    expect(motion0(t, 9)).toBe(6) // start of 'world'
  })

  it("$ jumps to last char of line", () => {
    const t = "hello\nworld"
    expect(motionDollar(t, 0)).toBe(4)  // last char of 'hello'
    expect(motionDollar(t, 6)).toBe(10) // last char of 'world'
  })

  it("^ jumps to first non-blank", () => {
    const t = "  hello"
    expect(motionCaret(t, 6)).toBe(2)
  })

  it("j / k move between lines", () => {
    const t = "hello\nworld"
    expect(motionJ(t, 0)).toBe(6)  // down to 'world'
    expect(motionK(t, 7)).toBe(1)  // up to same col in 'hello'
  })
})

describe("find motions", () => {
  it("f finds inclusive forward", () => {
    const t = "hello world"
    expect(motionF(t, 0, "o")).toBe(4)
  })
  it("F finds inclusive backward", () => {
    const t = "hello world"
    expect(motionFF(t, 10, "o")).toBe(7)
  })
  it("t finds exclusive forward (stops before char)", () => {
    const t = "hello world"
    expect(motionT(t, 0, "o")).toBe(3)
  })
  it("T finds exclusive backward", () => {
    const t = "hello world"
    expect(motionTT(t, 10, "o")).toBe(8)
  })
})

describe("gg / G motions", () => {
  it("gg goes to top", () => {
    expect(motionGG("hello\nworld")).toBe(0)
  })
  it("G goes to last line start", () => {
    expect(motionG("hello\nworld")).toBe(6)
  })
})

// ─── text objects ─────────────────────────────────────────────────────────────

describe("text objects", () => {
  it("iw selects inner word", () => {
    const t = "hello world"
    expect(objectIW(t, 2)).toEqual([0, 5])   // cursor inside 'hello'
    expect(objectIW(t, 7)).toEqual([6, 11])  // cursor inside 'world'
  })

  it("aw selects word + trailing space", () => {
    const t = "hello world"
    const range = objectAW(t, 2) // cursor inside 'hello'
    expect(range).not.toBeNull()
    if (range) {
      const [s, e] = range
      expect(t.slice(s, e)).toBe("hello ") // word + trailing space
    }
  })

  it("i\" selects inner double-quoted string", () => {
    const t = `say "hello" world`
    // cursor at position 6 ('h' inside quotes)
    const range = objectIQ(t, 6, '"')
    expect(range).not.toBeNull()
    if (range) {
      expect(t.slice(range[0], range[1])).toBe("hello")
    }
  })

  it("i( selects inner parens", () => {
    const t = "foo(bar)"
    const range = objectIB(t, 5, "(", ")")
    expect(range).not.toBeNull()
    if (range) {
      expect(t.slice(range[0], range[1])).toBe("bar")
    }
  })
})

// ─── operators ────────────────────────────────────────────────────────────────

describe("applyDelete", () => {
  it("deletes a range", () => {
    const { text, cursor, yanked } = applyDelete("hello world", 6, 11)
    expect(text).toBe("hello ")
    expect(yanked).toBe("world")
    expect(cursor).toBeLessThanOrEqual(text.length)
  })

  it("deletes forward (from < to)", () => {
    const { text, yanked } = applyDelete("abcde", 1, 3)
    expect(text).toBe("ade")
    expect(yanked).toBe("bc")
  })
})

describe("applyLineDelete", () => {
  it("deletes the entire current line", () => {
    const t = "line1\nline2\nline3"
    const { text, yanked } = applyLineDelete(t, 7) // cursor on 'line2'
    expect(yanked).toBe("line2\n")
    expect(text).toBe("line1\nline3")
  })
})

describe("applyPaste / applyPasteAfter", () => {
  it("pastes before cursor", () => {
    const { text } = applyPaste("hello", 2, "XY")
    expect(text).toBe("heXYllo")
  })
  it("pastes after cursor", () => {
    const { text } = applyPasteAfter("hello", 2, "XY")
    expect(text).toBe("helXYlo")
  })
})

// ─── vim state ────────────────────────────────────────────────────────────────

describe("initialVimState", () => {
  it("starts in insert mode", () => {
    expect(initialVimState().mode).toBe("insert")
  })
  it("has empty count and null operator", () => {
    const s = initialVimState()
    expect(s.count).toBe("")
    expect(s.operator).toBeNull()
    expect(s.register).toBe("")
  })
})
