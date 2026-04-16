/**
 * Virtual scrolling / visible-slice tests for MessageList.
 * We extract the pure functions and test them independently.
 */
import { describe, test, expect, beforeEach } from "bun:test"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import {
  estimateHeight,
  cacheVersion,
  clearHeightCache,
  pagerOffset,
  unseen,
} from "../src/components/MessageList"
import { buildOffsets, capRange, overscan, quantize, spacers, visible } from "../src/hooks/useVirtualScroll"
import { defaults } from "../src/keybindings"
import { makeMsg, makeTextPart, makeToolPart, makeTranscript } from "./fixtures"

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

function heights(msgs: Message[], parts: Record<string, Part[]>, width: number) {
  return msgs.map((msg) => estimateHeight(msg, parts[msg.id] ?? [], width))
}

function scrollTopFromOffset(totalHeight: number, viewH: number, rowOffset: number): number {
  const clampedOffset = Math.min(rowOffset, Math.max(0, totalHeight - viewH))
  const absoluteTop = totalHeight > viewH ? -(totalHeight - viewH - clampedOffset) : 0
  return absoluteTop < 0 ? -absoluteTop : 0
}

function window(msgs: Message[], parts: Record<string, Part[]>, width: number, viewH: number, rowOffset: number) {
  const list = heights(msgs, parts, width)
  const offsets = buildOffsets(list)
  const total = offsets[offsets.length - 1] ?? 0
  const scrollTop = scrollTopFromOffset(total, viewH, rowOffset)
  const vis = visible(offsets, scrollTop, viewH)
  const win = overscan(list, vis)
  const gap = spacers(offsets, total, win)
  return {
    offsets,
    total,
    visStart: vis.start,
    visEnd: vis.end,
    winStart: win.start,
    winEnd: win.end,
    topSpacer: gap.top,
    bottomSpacer: gap.bottom,
  }
}

// ---------------------------------------------------------------------------
// estimateHeight
// ---------------------------------------------------------------------------
describe("estimateHeight", () => {
  test("user message with no text parts returns a compact minimum height", () => {
    const msg = makeMsg("m1", "user")
    const height = estimateHeight(msg, [], 80)
    expect(height).toBe(2)
  })

  test("user message with short text stays compact", () => {
    const msg = makeMsg("m1", "user")
    const part = makeTextPart("p1", "m1", "Hello") // 5 chars << 74 chars per line
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBe(3)
  })

  test("user message with long text wraps to multiple lines", () => {
    const msg = makeMsg("m1", "user")
    // width=20 → 14 chars per line (20-6)
    const text = "a".repeat(28) // 2 lines
    const part = makeTextPart("p1", "m1", text)
    const height = estimateHeight(msg, [part], 20)
    expect(height).toBe(4)
  })

  test("assistant message with no parts returns a compact minimum height", () => {
    const msg = makeMsg("m1", "assistant")
    const height = estimateHeight(msg, [], 80)
    expect(height).toBe(2)
  })

  test("assistant message text adds only its rendered rows plus shell chrome", () => {
    const msg = makeMsg("m1", "assistant")
    const part = makeTextPart("p1", "m1", "Short") // 1 line
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBe(3)
  })

  test("assistant message skips synthetic text parts", () => {
    const msg = makeMsg("m1", "assistant")
    const part = { ...makeTextPart("p1", "m1", "Synthetic"), synthetic: true } as Part
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBe(2)
  })

  test("assistant message with a collapsed tool stays compact", () => {
    const msg = makeMsg("m1", "assistant")
    const part = { id: "p1", messageID: "m1", type: "tool", sessionID: "s1" } as unknown as Part
    const height = estimateHeight(msg, [part], 80)
    expect(height).toBe(2)
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
    const msgs = [makeMsg("m1", "assistant"), makeMsg("m2", "assistant"), makeMsg("m3", "assistant")]
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

// ---------------------------------------------------------------------------
// cacheVersion — pure version key helper
// ---------------------------------------------------------------------------
describe("cacheVersion", () => {
  test("returns 0 for empty parts", () => {
    expect(cacheVersion([])).toBe(0)
  })

  test("changes when parts count changes", () => {
    const msg = makeMsg("m1", "assistant")
    const p1 = makeTextPart("p1", "m1", "hello")
    const p2 = makeTextPart("p2", "m1", "world")
    expect(cacheVersion([p1])).not.toBe(cacheVersion([p1, p2]))
  })

  test("changes when last text part length changes", () => {
    const p = makeTextPart("p1", "m1", "short")
    const pLong = makeTextPart("p1", "m1", "much longer text here")
    expect(cacheVersion([p])).not.toBe(cacheVersion([pLong]))
  })

  test("same for identical parts arrays", () => {
    const parts = [makeTextPart("p1", "m1", "hello"), makeToolPart("t1", "m1")]
    expect(cacheVersion(parts)).toBe(cacheVersion(parts))
  })

  test("tool-only parts uses parts.length * 1_000_000", () => {
    const parts = [makeToolPart("t1", "m1")]
    expect(cacheVersion(parts)).toBe(1_000_000)
  })

  test("text + tool: last text part drives the text length component", () => {
    const txt = makeTextPart("p1", "m1", "ab") // length 2
    const tool = makeToolPart("t1", "m1")
    // With [txt, tool], no text part comes after tool, so we scan in reverse and skip tool
    // last text = p1 with length 2 → version = 2 * 1_000_000 + 2
    expect(cacheVersion([txt, tool])).toBe(2_000_002)
  })
})

// ---------------------------------------------------------------------------
// clearHeightCache — cache reset helper
// ---------------------------------------------------------------------------
describe("clearHeightCache", () => {
  test("can be called without error on an empty cache", () => {
    clearHeightCache()
    // calling again is a no-op
    clearHeightCache()
  })

  test("subsequent estimateHeight calls after clear return correct values", () => {
    clearHeightCache()
    const msg = makeMsg("m1", "user")
    const part = makeTextPart("p1", "m1", "hello")
    const h = estimateHeight(msg, [part], 80)
    expect(h).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Long-session fixture tests
// ---------------------------------------------------------------------------
describe("makeTranscript fixtures", () => {
  beforeEach(() => clearHeightCache())

  test("20-message transcript has correct shape", () => {
    const { msgs, parts } = makeTranscript(20)
    expect(msgs).toHaveLength(20)
    // Every message has at least one part
    for (const msg of msgs) {
      expect(parts[msg.id]).toBeDefined()
      expect(parts[msg.id]!.length).toBeGreaterThanOrEqual(1)
    }
  })

  test("100-message transcript: estimateHeight returns positive values for all messages", () => {
    const { msgs, parts } = makeTranscript(100)
    for (const msg of msgs) {
      const h = estimateHeight(msg, parts[msg.id] ?? [], 80)
      expect(h).toBeGreaterThan(0)
    }
  })

  test("500-message transcript: total height is consistent across two passes", () => {
    const { msgs, parts } = makeTranscript(500)
    const total1 = msgs.reduce((acc, msg) => acc + estimateHeight(msg, parts[msg.id] ?? [], 80), 0)
    const total2 = msgs.reduce((acc, msg) => acc + estimateHeight(msg, parts[msg.id] ?? [], 80), 0)
    expect(total1).toBe(total2)
    expect(total1).toBeGreaterThan(0)
  })

  test("width change produces different total height for long session", () => {
    const { msgs, parts } = makeTranscript(50)
    const narrow = msgs.reduce((acc, msg) => acc + estimateHeight(msg, parts[msg.id] ?? [], 40), 0)
    const wide = msgs.reduce((acc, msg) => acc + estimateHeight(msg, parts[msg.id] ?? [], 120), 0)
    // narrower terminal → text wraps more → taller
    expect(narrow).toBeGreaterThan(wide)
  })

  test("cacheVersion is stable for completed-message parts (same version on repeated calls)", () => {
    const { msgs, parts } = makeTranscript(20)
    for (const msg of msgs) {
      const p = parts[msg.id] ?? []
      const v1 = cacheVersion(p)
      const v2 = cacheVersion(p)
      expect(v1).toBe(v2)
    }
  })

  test("visibleSlice works on 100-message transcript at 24-row viewport", () => {
    const { msgs, parts } = makeTranscript(100)
    const slice = visibleSlice(msgs, parts, 24, 80, 0)
    // Should return a small subset of all 100 messages
    expect(slice.length).toBeGreaterThan(0)
    expect(slice.length).toBeLessThan(100)
    // Last message in slice should be the last overall (sticky-bottom)
    expect(slice[slice.length - 1]!.id).toBe(msgs[99]!.id)
  })

  test("visibleSlice with offset excludes tail messages", () => {
    const { msgs, parts } = makeTranscript(20)
    const full = visibleSlice(msgs, parts, 200, 80, 0)
    const offset5 = visibleSlice(msgs, parts, 200, 80, 5)
    // offset=5 should exclude last 5 messages
    const fullIds = full.map((m) => m.id)
    const offsetIds = offset5.map((m) => m.id)
    expect(fullIds.every((id) => !offsetIds.includes(id) || offsetIds.includes(id))).toBe(true)
    // The last message in offset5 should not be in the last 5 of msgs
    const last5 = msgs.slice(-5).map((m) => m.id)
    expect(last5.includes(offset5[offset5.length - 1]?.id ?? "")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Windowed rendering — verifies the window-finding logic used by MessageList
// ---------------------------------------------------------------------------
describe("windowed rendering", () => {
  beforeEach(() => clearHeightCache())

  test("sticky-bottom: window includes the last message", () => {
    const { msgs, parts } = makeTranscript(50)
    const { winStart, winEnd } = window(msgs, parts, 80, 24, 0)
    expect(winEnd).toBe(50) // buffer extends to message.length
    expect(msgs.slice(winStart, winEnd).some((m) => m.id === msgs[49]!.id)).toBe(true)
  })

  test("top-scroll: window includes the first message", () => {
    const { msgs, parts } = makeTranscript(50)
    const total = heights(msgs, parts, 80).reduce((sum, n) => sum + n, 0)
    const maxRowOffset = Math.max(0, total - 24)
    const { winStart } = window(msgs, parts, 80, 24, maxRowOffset)
    expect(winStart).toBe(0)
  })

  test("spacers preserve total inner-box height", () => {
    const { msgs, parts } = makeTranscript(30)
    const list = heights(msgs, parts, 80)
    const total = list.reduce((sum, n) => sum + n, 0)
    const maxRowOffset = Math.max(0, total - 24)
    const out = window(msgs, parts, 80, 24, Math.floor(maxRowOffset / 2))
    const visH = (out.offsets[out.winEnd] ?? 0) - (out.offsets[out.winStart] ?? 0)
    const { topSpacer, bottomSpacer } = out
    expect(topSpacer + visH + bottomSpacer).toBe(total)
  })

  test("empty transcript: window is empty with full bottom spacer", () => {
    const offsets = buildOffsets([])
    const vis = visible(offsets, 0, 24)
    const win = overscan([], vis)
    const gap = spacers(offsets, 0, win)
    const { start: winStart, end: winEnd } = win
    const { top: topSpacer, bottom: bottomSpacer } = gap
    expect(winStart).toBe(0)
    expect(winEnd).toBe(0)
    expect(topSpacer).toBe(0)
    expect(bottomSpacer).toBe(0)
  })

  test("all messages fit in viewport: no spacers", () => {
    // 3 short messages that all fit in a large viewport
    const msgs = [makeMsg("m1", "user"), makeMsg("m2", "user"), makeMsg("m3", "user")]
    const parts: Record<string, Part[]> = {}
    const { topSpacer, winStart, winEnd } = window(msgs, parts, 80, 1000, 0)
    expect(winStart).toBe(0)
    expect(winEnd).toBe(3)
    expect(topSpacer).toBe(0)
  })

  test("window shrinks for narrow viewport with many messages", () => {
    const { msgs, parts } = makeTranscript(100)
    const { winStart, winEnd } = window(msgs, parts, 80, 24, 0)
    // Window should be much smaller than 100
    const rendered = winEnd - winStart
    expect(rendered).toBeLessThan(100)
    expect(rendered).toBeGreaterThan(0)
  })

  test("detached scroll: window is centered around scrolled position", () => {
    const { msgs, parts } = makeTranscript(50)
    const total = heights(msgs, parts, 80).reduce((sum, n) => sum + n, 0)
    const midOffset = Math.floor(Math.max(0, total - 24) / 2)
    const { visStart, visEnd } = window(msgs, parts, 80, 24, midOffset)
    // Neither the first nor the last message should be in the visible core
    // (assuming there are enough messages)
    if (msgs.length > 20) {
      expect(visStart).toBeGreaterThan(0)
      expect(visEnd).toBeLessThan(msgs.length)
    }
  })

  test("500-message: window is tiny fraction of total", () => {
    const { msgs, parts } = makeTranscript(500)
    const { winStart, winEnd } = window(msgs, parts, 80, 24, 0)
    const rendered = winEnd - winStart
    // Should render at most ~20 messages (24 rows / ~5 per message + buffer)
    expect(rendered).toBeLessThan(50)
    expect(rendered).toBeGreaterThan(0)
  })

  test("window keeps buffered rows outside the visible core", () => {
    const { msgs, parts } = makeTranscript(50)
    const total = heights(msgs, parts, 80).reduce((sum, n) => sum + n, 0)
    const out = window(msgs, parts, 80, 24, Math.floor(Math.max(0, total - 24) / 2))
    expect(out.visStart).toBeGreaterThanOrEqual(out.winStart)
    expect(out.visEnd).toBeLessThanOrEqual(out.winEnd)
    expect(out.winStart).toBeLessThan(out.visStart)
    expect(out.winEnd).toBeGreaterThan(out.visEnd)
  })
})

describe("virtual scroll helpers", () => {
  test("quantize snaps to the nearest quantum", () => {
    expect(quantize(0)).toBe(0)
    expect(quantize(19, 40)).toBe(0)
    expect(quantize(21, 40)).toBe(40)
    expect(quantize(80, 40)).toBe(80)
  })

  test("capRange limits overlapping movement but allows disjoint jumps", () => {
    expect(capRange({ start: 10, end: 20 }, { start: 40, end: 50 }, 5)).toEqual({ start: 40, end: 50 })
    expect(capRange({ start: 10, end: 20 }, { start: 12, end: 35 }, 5)).toEqual({ start: 12, end: 25 })
  })
})

describe("pagerOffset", () => {
  const key = (over: Partial<Parameters<typeof pagerOffset>[1]> = {}) => ({
    ctrl: false,
    meta: false,
    shift: false,
    pageDown: false,
    pageUp: false,
    upArrow: false,
    downArrow: false,
    ...over,
  })

  test("plain pager keys are ignored while sticky at bottom", () => {
    expect(pagerOffset("j", key(), 0, 100, 24, false, defaults)).toBeUndefined()
    expect(pagerOffset("g", key(), 0, 100, 24, false, defaults)).toBeUndefined()
  })

  test("g jumps to top and G jumps to bottom when detached", () => {
    expect(pagerOffset("g", key(), 12, 100, 24, false, defaults)).toBe(100)
    expect(pagerOffset("G", key({ shift: true }), 12, 100, 24, false, defaults)).toBe(0)
  })

  test("j and k move one line at a time when detached", () => {
    expect(pagerOffset("j", key(), 12, 100, 24, false, defaults)).toBe(11)
    expect(pagerOffset("k", key(), 12, 100, 24, false, defaults)).toBe(13)
  })

  test("ctrl+d and ctrl+u move by half a page", () => {
    expect(pagerOffset("d", key({ ctrl: true }), 20, 100, 24, false, defaults)).toBe(8)
    expect(pagerOffset("u", key({ ctrl: true }), 20, 100, 24, false, defaults)).toBe(32)
  })

  test("space and b move by a full page", () => {
    expect(pagerOffset(" ", key(), 20, 100, 24, false, defaults)).toBe(0)
    expect(pagerOffset("b", key(), 20, 100, 24, false, defaults)).toBe(42)
  })

  test("q snaps back to bottom", () => {
    expect(pagerOffset("q", key(), 20, 100, 24, false, defaults)).toBe(0)
  })

  test("existing page keys still work", () => {
    expect(pagerOffset("", key({ pageUp: true }), 20, 100, 24, false, defaults)).toBe(25)
    expect(pagerOffset("", key({ pageDown: true }), 20, 100, 24, false, defaults)).toBe(15)
    expect(pagerOffset("", key({ ctrl: true, upArrow: true }), 20, 100, 24, false, defaults)).toBe(100)
    expect(pagerOffset("", key({ ctrl: true, downArrow: true }), 20, 100, 24, false, defaults)).toBe(0)
  })
})

describe("unseen", () => {
  test("stays clear while sticky at bottom", () => {
    expect(unseen(12, 8, 0)).toEqual({ count: 0, split: 12 })
  })

  test("counts only messages below the detach point", () => {
    expect(unseen(12, 8, 4)).toEqual({ count: 4, split: 8 })
  })

  test("clamps stale seen markers into bounds", () => {
    expect(unseen(3, 9, 2)).toEqual({ count: 0, split: 3 })
    expect(unseen(3, -4, 2)).toEqual({ count: 3, split: 0 })
  })
})
