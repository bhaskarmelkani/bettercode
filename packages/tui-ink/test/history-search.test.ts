import { describe, test, expect } from "bun:test"
import { findHistory } from "../src/hooks/useHistorySearch"

describe("findHistory", () => {
  test("returns newest matches first", () => {
    expect(findHistory(["fix latest", "middle", "fix first"], "fix")).toEqual(["fix latest", "fix first"])
  })

  test("matches case-insensitively", () => {
    expect(findHistory(["Ship It", "later"], "ship")).toEqual(["Ship It"])
  })

  test("empty query returns full history", () => {
    expect(findHistory(["a", "b"], "")).toEqual(["a", "b"])
  })
})
