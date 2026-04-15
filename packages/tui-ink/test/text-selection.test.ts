import { describe, expect, test } from "bun:test"
import { sliceSelection, selectionRows } from "../src/hooks/useTextSelection"
import { projectViewport } from "../src/components/MessageList"
import { makeMsg, makeTextPart } from "./fixtures"

describe("text selection", () => {
  test("slices a single row selection", () => {
    const lines = ["hello world"]
    expect(sliceSelection(lines, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe("hello")
  })

  test("slices multiple rows with newlines", () => {
    const lines = ["hello world", "second row", "third row"]
    expect(sliceSelection(lines, { x: 6, y: 0 }, { x: 5, y: 2 })).toBe("world\nsecond row\nthird")
  })

  test("builds overlay rows for multi-line selection", () => {
    const lines = ["hello world", "second row", "third row"]
    expect(selectionRows(lines, { x: 6, y: 0 }, { x: 5, y: 2 })).toEqual([
      { x: 6, y: 0, text: "world" },
      { x: 0, y: 1, text: "second row" },
      { x: 0, y: 2, text: "third" },
    ])
  })
})

describe("projectViewport", () => {
  test("projects visible rows for a simple transcript", () => {
    const msg = [makeMsg("u1", "user"), makeMsg("a1", "assistant")]
    const parts = {
      u1: [makeTextPart("p1", "u1", "hello from user")],
      a1: [makeTextPart("p2", "a1", "assistant reply")],
    }
    const lines = projectViewport({
      messages: msg,
      parts,
      topH: [0, 3],
      botH: [3, 6],
      winStart: 0,
      winEnd: 2,
      scrollTop: 0,
      height: 6,
      width: 40,
      mark: { count: 0, split: 2 },
      collapsed: {},
      diffs: {},
      collapsedDiffs: {},
      showThinking: false,
      focusMode: false,
    })

    expect(lines[1]).toContain("hello from user")
    expect(lines[4]).toContain("assistant reply")
  })
})
