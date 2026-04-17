import { describe, test, expect } from "bun:test"

// M1.3.d: focused unit tests for fill >= 0 formula.
// fill = width - LEAD - (onLine && value ? line.length : body.length) - (cursorAtEnd ? 1 : 0)
// These test the formula in isolation (not the full React render).

const LEAD = 3

function computeFill({
  width,
  value,
  line,
  col,
  placeholder = "Type a message...",
}: {
  width: number
  value: string
  line: string
  col: number
  placeholder?: string
}) {
  const body = !value ? placeholder : line || " "
  const cursorAtEnd = col >= line.length
  return Math.max(0, width - LEAD - (value ? line.length : body.length) - (cursorAtEnd ? 1 : 0))
}

describe("composer fill formula", () => {
  test("fill >= 0 for empty line, cursor at end", () => {
    const fill = computeFill({ width: 80, value: "", line: "", col: 0 })
    expect(fill).toBeGreaterThanOrEqual(0)
  })

  test("fill >= 0 for 1-char line with cursor at end", () => {
    const fill = computeFill({ width: 80, value: "a", line: "a", col: 1 })
    expect(fill).toBeGreaterThanOrEqual(0)
  })

  test("fill >= 0 for exact-width line", () => {
    const line = "x".repeat(80 - LEAD - 1) // fills to width - LEAD - 1 (cursor needs 1)
    const fill = computeFill({ width: 80, value: line, line, col: line.length })
    expect(fill).toBeGreaterThanOrEqual(0)
  })

  test("fill + LEAD + line.length + caret = width for cursor-at-end with value", () => {
    const width = 80
    const line = "hello"
    const fill = computeFill({ width, value: line, line, col: line.length })
    expect(LEAD + line.length + 1 + fill).toBe(width)
  })

  test("fill + LEAD + line.length = width for cursor mid-line", () => {
    const width = 80
    const line = "hello world"
    const fill = computeFill({ width, value: line, line, col: 5 })
    expect(LEAD + line.length + fill).toBe(width)
  })

  test("fill + LEAD + placeholder.length + caret = width for empty composer", () => {
    const width = 80
    const placeholder = "Type a message..."
    const fill = computeFill({ width, value: "", line: "", col: 0, placeholder })
    expect(LEAD + placeholder.length + 1 + fill).toBe(width)
  })
})
