/**
 * Virtual scrolling / visible-slice tests for MessageList.
 * We extract the pure functions and test them independently.
 */
import { describe, test, expect } from "bun:test"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import { estimateHeight } from "../src/components/MessageList"

function visibleSlice(
  msgs: Message[],
  parts: Record<string, Part[]>,
  height: number,
  width: number,
  offset: number,
): Message[] {
  const end = Math.max(0, msgs.length - offset)
  let h = 0
  let start = end
  while (start > 0) {
    const msg = msgs[start - 1]!
    h += estimateHeight(msg, parts[msg.id] ?? [], width)
    if (h > height) break
    start--
  }
  return msgs.slice(start, end)
}

function makeMsg(id: string, role: "user" | "assistant"): Message {
  return { id, role, sessionID: "s1" } as Message
}

function makeTextPart(id: string, messageID: string, text: string): Part {
  return { id, messageID, type: "text", text, sessionID: "s1" } as unknown as Part
}

describe("estimateHeight", () => {
  test("user message with no text parts returns 4 (0 lines + 4 padding)", () => {
    const msg = makeMsg("m1", "user")
    const height = estimateHeight(msg, [], 80)
    expect(height).toBeGreaterThanOrEqual(4)
  })

  test("user message with short text returns 5 (1 line + 4)", () => {
    const msg = makeMsg("m1", "user")
    const part = makeTextPart("p1", "m1", "Hello") // 5 chars << 74 chars per line
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBeGreaterThanOrEqual(5)
  })

  test("user message with long text wraps to multiple lines", () => {
    const msg = makeMsg("m1", "user")
    // width=20 → 14 chars per line (20-6)
    const text = "a".repeat(28) // 2 lines
    const part = makeTextPart("p1", "m1", text)
    const height = estimateHeight(msg, [part], 20)
    expect(height).toBeGreaterThanOrEqual(6)
  })

  test("assistant message with no parts returns minimum 3", () => {
    const msg = makeMsg("m1", "assistant")
    const height = estimateHeight(msg, [], 80)
    expect(height).toBeGreaterThanOrEqual(3)
  })

  test("assistant message accumulates text part height", () => {
    const msg = makeMsg("m1", "assistant")
    const part = makeTextPart("p1", "m1", "Short") // 1 line
    const height = estimateHeight(msg, [part], 80)
    // 3 (base) + (1 line + 2 padding) = 6
    expect(height).toBeGreaterThanOrEqual(6)
  })

  test("assistant message skips synthetic text parts", () => {
    const msg = makeMsg("m1", "assistant")
    const part = { ...makeTextPart("p1", "m1", "Synthetic"), synthetic: true } as Part
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBeGreaterThanOrEqual(3)
  })

  test("assistant message with tool part adds 3", () => {
    const msg = makeMsg("m1", "assistant")
    const part = { id: "p1", messageID: "m1", type: "tool", sessionID: "s1" } as unknown as Part
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBeGreaterThanOrEqual(6)
  })

  test("markdown-heavy assistant output keeps enough room for blocks", () => {
    const msg = makeMsg("m1", "assistant")
    const part = {
      id: "p1",
      messageID: "m1",
      sessionID: "s1",
      type: "text",
      text: "# Title\n\n- one\n- two\n\n```ts\nconst x = 1\nconst y = 2\n```",
    } as unknown as Part
    const height = estimateHeight(msg, [part], 50)
    expect(height).toBeGreaterThan(10)
  })
})

describe("visibleSlice", () => {
  test("returns all messages when they fit in height", () => {
    const msgs = [makeMsg("m1", "user"), makeMsg("m2", "user")]
    const parts: Record<string, Part[]> = {}
    // Each user message with no parts = 4 rows; height = 20 fits both
    const slice = visibleSlice(msgs, parts, 20, 80, 0)
    expect(slice.map((m) => m.id)).toEqual(["m1", "m2"])
  })

  test("clips messages that don't fit", () => {
    const msgs = [makeMsg("m1", "user"), makeMsg("m2", "user"), makeMsg("m3", "user")]
    const parts: Record<string, Part[]> = {}
    // height=5 fits 1 user message (4 rows) but not 2
    const slice = visibleSlice(msgs, parts, 5, 80, 0)
    // Only the last message(s) that fit are shown (scrolled to bottom)
    expect(slice.length).toBeLessThan(3)
    expect(slice[slice.length - 1]!.id).toBe("m3")
  })

  test("offset scrolls up (excludes messages from end)", () => {
    const msgs = [makeMsg("m1", "user"), makeMsg("m2", "user"), makeMsg("m3", "user")]
    const parts: Record<string, Part[]> = {}
    // offset=1 excludes the last message
    const slice = visibleSlice(msgs, parts, 20, 80, 1)
    expect(slice.every((m) => m.id !== "m3")).toBe(true)
  })

  test("offset past all messages returns empty", () => {
    const msgs = [makeMsg("m1", "user"), makeMsg("m2", "user")]
    const parts: Record<string, Part[]> = {}
    const slice = visibleSlice(msgs, parts, 20, 80, 10)
    expect(slice).toHaveLength(0)
  })

  test("empty message list returns empty slice", () => {
    const slice = visibleSlice([], {}, 20, 80, 0)
    expect(slice).toHaveLength(0)
  })

  test("uses part heights for sizing when available", () => {
    const msgs = [
      makeMsg("m1", "assistant"),
      makeMsg("m2", "assistant"),
      makeMsg("m3", "assistant"),
    ]
    const longText = "x".repeat(500)
    const parts: Record<string, Part[]> = {
      m1: [makeTextPart("p1", "m1", longText)],
      m2: [makeTextPart("p2", "m2", longText)],
      m3: [makeTextPart("p3", "m3", longText)],
    }
    // Each assistant message with 500 chars at width=80 (74 per line) ≈ 7 lines + 2 + 3 = 12 rows
    // height=15 should fit 1 message (12 rows) but not 2 (24 rows)
    const slice = visibleSlice(msgs, parts, 15, 80, 0)
    expect(slice.length).toBe(1)
    expect(slice[0]!.id).toBe("m3")
  })
})
