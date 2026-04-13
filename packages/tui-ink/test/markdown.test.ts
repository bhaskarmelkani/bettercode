import { describe, test, expect } from "bun:test"
import { lex } from "../src/components/markdown/MarkdownRenderer"

describe("markdown lexer", () => {
  test("parses headings, lists, and code blocks", () => {
    const tokens = lex("# Title\n\n- one\n- two\n\n```ts\nconst x = 1\n```")
    expect(tokens.some((t) => t.type === "heading")).toBe(true)
    expect(tokens.some((t) => t.type === "list")).toBe(true)
    expect(tokens.some((t) => t.type === "code")).toBe(true)
  })

  test("handles incomplete fenced blocks without throwing", () => {
    const tokens = lex("```ts\nconst x = 1\n")
    expect(tokens.length).toBeGreaterThan(0)
  })
})
