import React, { useEffect, useRef, useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { Message, Part, SnapshotFileDiff, TextPart as TextPartType } from "@opencode-ai/sdk/v2"
import { UserMessage } from "./UserMessage"
import { AssistantMessage } from "./AssistantMessage"
import { useAppStore } from "../store"
import { mouseScrollEvents } from "../mouseScrollEvents"
import { lex } from "./markdown/MarkdownRenderer"
import type { Token } from "./markdown/types"

const EMPTY_MESSAGES: Message[] = []
const EMPTY_PARTS: Record<string, Part[]> = {}
const EMPTY_ARRAY: Part[] = []
const EMPTY_DIFF: SnapshotFileDiff[] = []

// ---------------------------------------------------------------------------
// Height cache — module-scoped so it survives React re-renders.
// Completed messages have immutable parts; their heights are cached until
// either the parts version changes or the terminal width changes.
// Only the in-progress (pending) message is always recomputed.
// ---------------------------------------------------------------------------
type CacheEntry = { height: number; version: number }
const heightCache = new Map<string, CacheEntry>()
let cacheWidth = -1

/**
 * Pure version key for a parts array.
 * version = (parts.length * 1_000_000) + length of the last text part's text.
 * Cheap to compute and changes whenever streaming appends characters.
 */
export function cacheVersion(parts: Part[], diffs: SnapshotFileDiff[] = [], open = false): number {
  const last = [...parts].reverse().find((p): p is TextPartType => p.type === "text")
  const patch = diffs.reduce((sum, item) => sum + item.patch.length, 0)
  return parts.length * 1_000_000 + (last?.text.length ?? 0) + diffs.length * 10_000 + patch + (open ? 1 : 0)
}

/** Clear the height cache (used in tests and on width change). */
export function clearHeightCache(): void {
  heightCache.clear()
  cacheWidth = -1
}

function cachedHeight(
  msg: Message,
  parts: Part[],
  diffs: SnapshotFileDiff[],
  open: boolean,
  width: number,
  pending: string | undefined,
) {
  // Always recompute for the actively streaming message.
  if (msg.id === pending) return estimateHeight(msg, parts, width, diffs, open)
  const v = cacheVersion(parts, diffs, open)
  const entry = heightCache.get(msg.id)
  if (entry && entry.version === v) return entry.height
  const h = estimateHeight(msg, parts, width, diffs, open)
  heightCache.set(msg.id, { height: h, version: v })
  return h
}

interface Props {
  sessionID: string
  height: number
  width: number
  active: boolean
  generating: boolean
}

// ---------------------------------------------------------------------------
// Height estimation
// Estimates how many terminal rows a message will occupy.
// Intentionally errs on the high side so we never underflow the viewport.
// ---------------------------------------------------------------------------
function text(items: Token[]): string {
  return items
    .map((tok) => {
      if (tok.type === "text" || tok.type === "html" || tok.type === "escape") return tok.raw ?? tok.text ?? ""
      if (tok.tokens?.length) return text(tok.tokens)
      if (tok.items?.length) return text(tok.items)
      return tok.raw ?? tok.text ?? ""
    })
    .join("")
}

function lines(input: string, width: number) {
  return Math.max(1, Math.ceil(Math.max(1, input.length) / Math.max(1, width)))
}

function fileRows(parts: Part[], width: number) {
  const files = parts.filter((part) => part.type === "file")
  if (files.length === 0) return 0
  const badge = files.reduce(
    (rows, file) => rows + Math.max(8, (file.filename ?? "").length + 8),
    0,
  )
  return 1 + Math.max(1, Math.ceil(badge / Math.max(1, width)))
}

function measure(items: Token[], width: number): number {
  return items.reduce((sum, tok) => {
    if (tok.type === "space") return sum
    if (tok.type === "heading") return sum + lines(text(tok.tokens ?? []), width) + 1
    if (tok.type === "paragraph") return sum + lines(text(tok.tokens ?? []), width) + 1
    if (tok.type === "code") {
      const body = tok.text ?? ""
      return sum + Math.max(1, body.split(/\r?\n/).length) + 2
    }
    if (tok.type === "list") {
      return sum + (tok.items ?? []).reduce((rows, item) => rows + measure(item.tokens ?? [], width - 2) + 1, 1)
    }
    if (tok.type === "blockquote") return sum + 1 + measure(tok.tokens ?? [], width - 2)
    if (tok.type === "hr") return sum + 1
    if (tok.tokens?.length) return sum + measure(tok.tokens, width)
    if (tok.items?.length) return sum + measure(tok.items, width)
    return sum + lines(tok.raw ?? tok.text ?? "", width)
  }, 0)
}

export function estimateHeight(msg: Message, parts: Part[], width: number, diffs: SnapshotFileDiff[] = [], open = false): number {
  const safeWidth = Math.max(1, width - 6)
  if (msg.role === "user") {
    const t = parts.find((p): p is TextPartType => p.type === "text" && !p.synthetic)
    const body = t ? lex(t.text) : []
    return Math.max(1, measure(body, safeWidth)) + 1 + fileRows(parts, safeWidth)
  }
  let h = 1
  for (const part of parts) {
    if (part.type === "text") {
      if (part.synthetic || part.ignored) continue
      h += Math.max(1, measure(lex(part.text), safeWidth))
    } else if (part.type === "tool") {
      h += 1
    } else if (part.type === "compaction") {
      h += 2
    } else if (part.type === "reasoning") {
      const text = part.text.replace("[REDACTED]", "").trim()
      if (text) h += lines(text, safeWidth) + 2
    }
  }
  const done = "finish" in msg && msg.finish && !["tool-calls", "unknown"].includes(msg.finish)
  const foot = done || ("error" in msg && !!msg.error?.name)
  if (diffs.length > 0) {
    h += 1 + diffs.length
    if (open) {
      h += diffs.reduce((sum, item) => sum + Math.min(13, item.patch.split(/\r?\n/).length + 1), 0)
    }
  }
  return Math.max(2, h + (foot ? 2 : 0))
}

// ---------------------------------------------------------------------------
// Session-scoped parts selector with reference stability.
// Uses a ref-based cache so the returned Record has a stable identity when
// none of the per-message Part[] arrays actually changed.
// ---------------------------------------------------------------------------
function useSessionParts(sessionID: string): Record<string, Part[]> {
  const messages = useAppStore((s) => s.messages[sessionID] ?? EMPTY_MESSAGES)
  const allParts = useAppStore((s) => s.parts)
  const stable = useRef<Record<string, Part[]>>(EMPTY_PARTS)

  return useMemo(() => {
    if (messages.length === 0) {
      stable.current = EMPTY_PARTS
      return EMPTY_PARTS
    }
    const prev = stable.current
    let changed = false
    const next: Record<string, Part[]> = {}
    for (const msg of messages) {
      const p = allParts[msg.id]
      if (p !== undefined) {
        next[msg.id] = p
        if (p !== prev[msg.id]) changed = true
      } else if (msg.id in prev) {
        changed = true
      }
    }
    // Return the previous Record if content is identical (same Part[] refs).
    const prevLen = Object.keys(prev).length
    const nextLen = Object.keys(next).length
    if (!changed && prevLen === nextLen) return prev
    stable.current = next
    return next
  }, [allParts, messages])
}

// ---------------------------------------------------------------------------
// Scroll step in rows
// ---------------------------------------------------------------------------
const SCROLL_STEP = 5
const MOUSE_SCROLL_STEP = 3
// Extra messages to render above/below the visible viewport
const WIN_BUFFER = 2

export const MessageList = React.memo(function MessageList({ sessionID, height, width, active, generating }: Props) {
  const messages = useAppStore((s) => s.messages[sessionID] ?? EMPTY_MESSAGES)
  const parts = useSessionParts(sessionID)
  const showThinking = useAppStore((s) => s.showThinking)
  const savedPos = useAppStore((s) => s.scrollPos[sessionID] ?? 0)
  const setScrollPos = useAppStore((s) => s.setScrollPos)
  const loadMessageDiff = useAppStore((s) => s.loadMessageDiff)
  const toggleDiffCollapse = useAppStore((s) => s.toggleDiffCollapse)
  const messageDiff = useAppStore((s) => s.messageDiff)
  const collapsedDiffs = useAppStore((s) => s.collapsedDiffs)
  const collapsedTools = useAppStore((s) => s.collapsedTools)
  const expandAllTools = useAppStore((s) => s.expandAllTools)
  const collapseAllTools = useAppStore((s) => s.collapseAllTools)
  const activeRef = useRef(active)

  const pending = useMemo(() => messages.findLast((m) => m.role === "assistant" && !m.time.completed)?.id, [messages])

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parentID) continue
      if (!msg.time.completed && !msg.error) continue
      loadMessageDiff(sessionID, msg.id, msg.parentID)
    }
  }, [loadMessageDiff, messages, sessionID])

  // rowOffset: how many rows from the absolute bottom of all content to scroll up.
  // 0 = stick to bottom (latest), positive = scrolled up.
  const [rowOffset, setRowOffset] = useState(savedPos)
  const sticky = rowOffset === 0
  const prevMsgCount = useRef(messages.length)

  // Compute totalHeight and per-message cumulative heights in one pass.
  // cumH[i] = sum of heights of messages 0..i-1; cumH[messages.length] = total base.
  // Completed messages are served from heightCache (O(1)); only the pending message
  // is recomputed on every delta.
  const [totalHeight, cumH] = useMemo(() => {
    if (cacheWidth !== width) {
      heightCache.clear()
      cacheWidth = width
    }
    const h: number[] = [0]
    for (const msg of messages) {
      const diffs = messageDiff[msg.id] ?? EMPTY_DIFF
      const open = !(collapsedDiffs[msg.id] ?? true)
      h.push(h[h.length - 1]! + cachedHeight(msg, parts[msg.id] ?? EMPTY_ARRAY, diffs, open, width, pending))
    }
    return [h[h.length - 1]!, h] as const
  }, [collapsedDiffs, messageDiff, messages, parts, width, pending])

  // Max rows we can scroll up before reaching the very top
  const maxRowOffset = Math.max(0, totalHeight - height)
  const clampedOffset = Math.min(rowOffset, maxRowOffset)

  // Keep refs stable for subscriptions
  activeRef.current = active
  const maxRowOffsetRef = useRef(maxRowOffset)
  maxRowOffsetRef.current = maxRowOffset

  // Absolute top position of the content box inside the clipping container.
  // Short content (fits in viewport): start at top (blank space falls naturally below last message).
  // Long content: negative margin scrolls content up; rowOffset=0 shows bottom, max shows top.
  const absoluteTop = totalHeight > height ? -(totalHeight - height - clampedOffset) : 0

  // ---------------------------------------------------------------------------
  // Windowed rendering — find the visible message range.
  // scrollTop: how many rows of content are above the viewport top edge.
  // We render WIN_BUFFER extra messages before and after the visible range.
  // Top + bottom spacers preserve the total inner-box height so scroll math
  // stays identical to full-list rendering.
  // ---------------------------------------------------------------------------
  const scrollTop = absoluteTop < 0 ? -absoluteTop : 0
  const viewEnd = scrollTop + height

  let winFirst = messages.length
  let winLast = -1
  for (let i = 0; i < messages.length; i++) {
    const top = cumH[i]!
    const bottom = cumH[i + 1]!
    if (bottom > scrollTop && top < viewEnd) {
      if (i < winFirst) winFirst = i
      winLast = i
    }
  }

  // Clamp window with buffer
  const winStart = Math.max(0, winFirst - WIN_BUFFER)
  const winEnd = Math.min(messages.length, winLast + 1 + WIN_BUFFER)

  // Spacers preserve total inner-box height = totalHeight
  const topSpacer = cumH[winStart]!
  const bottomSpacer = totalHeight - cumH[winEnd]!

  // Restore scroll position when switching sessions
  useEffect(() => {
    setRowOffset(savedPos)
  }, [sessionID])

  // Persist scroll position changes
  useEffect(() => {
    setScrollPos(sessionID, clampedOffset)
  }, [sessionID, clampedOffset])

  // Sticky: snap back to bottom when new messages arrive while at bottom
  useEffect(() => {
    if (sticky && messages.length !== prevMsgCount.current) {
      setRowOffset(0)
    }
    prevMsgCount.current = messages.length
  }, [messages.length, sticky])

  // Mouse wheel scroll — stable subscription, uses refs to avoid re-subscribing
  useEffect(() => {
    return mouseScrollEvents.on((direction) => {
      if (!activeRef.current) return
      if (direction === "up") {
        setRowOffset((o) => Math.min(o + MOUSE_SCROLL_STEP, maxRowOffsetRef.current))
      } else {
        setRowOffset((o) => Math.max(0, o - MOUSE_SCROLL_STEP))
      }
    })
  }, [])

  useInput(
    (_input, key) => {
      if (_input === "e" && !key.ctrl && !key.meta && !key.shift && generating) {
        const msg = [...messages].reverse().find((m) => m.role === "assistant")
        if (!msg) return
        const tools = (parts[msg.id] ?? EMPTY_ARRAY).filter((p) => p.type === "tool")
        if (tools.length === 0) return
        const all = tools.every((part) => {
          const collapsed = collapsedTools[part.id]
          return collapsed ?? part.state.status === "completed"
        })
        if (all) expandAllTools(sessionID)
        else collapseAllTools(sessionID)
        return
      }
      // Scroll up: PageUp, Shift+↑, or plain ↑ while generating
      const scrollUp = key.pageUp || (key.upArrow && key.shift) || (key.upArrow && generating)
      // Scroll down: PageDown, Shift+↓, or plain ↓ while generating
      const scrollDown = key.pageDown || (key.downArrow && key.shift) || (key.downArrow && generating)
      if (scrollUp) {
        setRowOffset((o) => Math.min(o + SCROLL_STEP, maxRowOffset))
        return
      }
      if (scrollDown) {
        setRowOffset((o) => Math.max(0, o - SCROLL_STEP))
        return
      }
      // ctrl+up: jump to very top
      if (key.ctrl && key.upArrow) {
        setRowOffset(maxRowOffset)
        return
      }
      // ctrl+down: snap to bottom (sticky)
      if (key.ctrl && key.downArrow) {
        setRowOffset(0)
        return
      }
    },
    { isActive: active },
  )

  const last = messages[messages.length - 1]
  const win = messages.slice(winStart, winEnd)

  return (
    <Box height={height} overflowY="hidden" flexDirection="column">
      {/* Scroll indicator — overlaid at the top-right when scrolled up */}
      {clampedOffset > 0 && (
        <Box position="absolute" width={width} flexDirection="row" justifyContent="flex-end">
          <Text dimColor>{`↑ scrolled · ctrl+↓ snap bottom `}</Text>
        </Box>
      )}

      {/* Content box — negative marginTop slides content up, overflowY clips it.
          absoluteTop is negative when rowOffset=0 (stick to bottom), 0 when at top.
          Top/bottom spacers preserve the total inner-box height so scroll math
          stays identical regardless of how many messages are actually rendered. */}
      <Box flexDirection="column" marginTop={absoluteTop}>
        {topSpacer > 0 && <Box height={topSpacer} />}
        {win.map((msg) => {
          const msgParts = parts[msg.id] ?? EMPTY_ARRAY
          if (msg.role === "user") {
            const isQueued = !!(pending && msg.id > pending)
            return <UserMessage key={msg.id} parts={msgParts} isQueued={isQueued} />
          }
          return (
            <AssistantMessage
              key={msg.id}
              message={msg}
              parts={msgParts}
              showThinking={showThinking}
              isLast={msg.id === last?.id}
              diffs={messageDiff[msg.id] ?? EMPTY_DIFF}
              diffOpen={!(collapsedDiffs[msg.id] ?? true)}
              onToggleDiff={(messageDiff[msg.id]?.length ?? 0) > 0 ? () => toggleDiffCollapse(msg.id) : undefined}
            />
          )
        })}
        {bottomSpacer > 0 && <Box height={bottomSpacer} />}
      </Box>
    </Box>
  )
})
