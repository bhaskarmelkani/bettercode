import { describe, test, expect } from "bun:test"
import { undoState } from "../src/hooks/useUndoBuffer"

describe("undo buffer behavior", () => {
  test("drops the current snapshot and returns the previous one", () => {
    expect(
      undoState(
        [
          { text: "", cursor: 0 },
          { text: "draft", cursor: 5 },
          { text: "draft more", cursor: 10 },
        ],
        "draft more",
        10,
      ).prev,
    ).toEqual({ text: "draft", cursor: 5 })
  })

  test("falls back to empty input when no snapshot remains", () => {
    expect(undoState([], "x", 1).prev).toEqual({ text: "", cursor: 0 })
  })
})
