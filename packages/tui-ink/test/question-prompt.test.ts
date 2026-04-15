import { describe, expect, test } from "bun:test"
import { questionWin, wraps } from "../src/components/QuestionPrompt"

describe("wraps", () => {
  test("counts wrapped rows for a single line", () => {
    expect(wraps("abcdef", 3)).toBe(2)
  })

  test("counts wrapped rows across hard line breaks", () => {
    expect(wraps("abcd\nef", 3)).toBe(3)
  })
})

describe("questionWin", () => {
  test("shows the whole list when every item fits", () => {
    expect(questionWin([2, 2, 1], 1, 8)).toEqual({ start: 0, end: 3 })
  })

  test("scrolls down to keep the focused answer visible", () => {
    expect(questionWin([2, 2, 2, 1], 3, 5)).toEqual({ start: 1, end: 4 })
  })

  test("keeps earlier answers visible until the viewport overflows", () => {
    expect(questionWin([2, 2, 2, 1], 2, 5)).toEqual({ start: 1, end: 4 })
  })
})
