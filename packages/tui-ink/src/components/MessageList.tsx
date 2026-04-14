import React, { useEffect, useRef, useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { Message, Part, TextPart as TextPartType } from "@opencode-ai/sdk/v2"
import { UserMessage } from "./UserMessage"
import { AssistantMessage } from "./AssistantMessage"
import { useAppStore } from "../store"
import { mouseScrollEvents } from "../mouseScrollEvents"
import { lex } from "./markdown/MarkdownRenderer"
import type { Token } from "./markdown/types"

const EMPTY_MESSAGES: Message[] = []
const EMPTY_PARTS: Record<string, Part[]> = {}

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
export function cacheVersion(parts: Part[]): number {
  const last = [...parts].reverse().find((p): p is TextPartType => p.type === "text")
  return parts.length * 1_000_000 + (last?.text.length ?? 0)
}

/** Clear the height cache (used in tests and on width change). */
export function clearHeightCache(): void {
  heightCache.clear()
  cacheWidth = -1
}

function cachedHeight(msg: Message, parts: Part[], width: number, pending: string | undefined): number {
  // Always recompute for the actively streaming message.
  if (msg.id === pending) return estimateHeight(msg, parts, width)
  const v = cacheVersion(parts)
  const entry = heightCache.get(msg.id)
  if (entry && entry.version === v) return entry.height
  const h = estimateHeight(msg, parts, width)
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

export function estimateHeight(msg: Message, parts: Part[], width: number): number {
  const safeWidth = Math.max(1, width - 6)
  if (msg.role === "user") {
    const t = parts.find((p): p is TextPartType => p.type === "text" && !p.synthetic)
    const body = t ? lex(t.text) : []
    return measure(body, safeWidth) + 4 // margin + border + padding + safety
  }
  // assistant: margin + border + parts + footer + safety
  let h = 4
  for (const part of parts) {
    if (part.type === "text") {
      if (part.synthetic || part.ignored) continue
      h += measure(lex(part.text), safeWidth) + 1
    } else if (part.type === "tool") {
      h += 4 // 1 marginTop + title + optional summary + 1 safety
    } else if (part.type === "compaction") {
      h += 2
    } else if (part.type === "reasoning") {
      h += 1
    }
  }
  return Math.max(3, h)
}

// ---------------------------------------------------------------------------
// Session-scoped parts selector
// Only watches parts for messages belonging to this session, so an unrelated
// session streaming doesn't trigger a re-render here.
// ---------------------------------------------------------------------------
function useSessionParts(sessionID: string): Record<string, Part[]> {
  // Watch the messages array directly (stable store reference) rather than
  // mapping to IDs. `.map()` inside a selector creates a new array on every
  // store update, causing useSyncExternalStore to detect an infinite change
  // loop and throw "Maximum update depth exceeded".
  const messages = useAppStore((s) => s.messages[sessionID] ?? EMPTY_MESSAGES)
  const allParts = useAppStore((s) => s.parts)

  return useMemo(() => {
    if (messages.length === 0) return EMPTY_PARTS
    const out: Record<string, Part[]> = {}
    for (const msg of messages) {
      const p = allParts[msg.id]
      if (p) out[msg.id] = p
    }
    return out
  }, [allParts, messages])
}

// ---------------------------------------------------------------------------
// Scroll step in rows
// ---------------------------------------------------------------------------
const SCROLL_STEP = 5
const MOUSE_SCROLL_STEP = 3

export const MessageList = React.memo(function MessageList({ sessionID, height, width, active, generating }: Props) {
  const messages = useAppStore((s) => s.messages[sessionID] ?? EMPTY_MESSAGES)
  const parts = useSessionParts(sessionID)
  const showThinking = useAppStore((s) => s.showThinking)
  const savedPos = useAppStore((s) => s.scrollPos[sessionID] ?? 0)
  const setScrollPos = useAppStore((s) => s.setScrollPos)
  const collapsedTools = useAppStore((s) => s.collapsedTools)
  const expandAllTools = useAppStore((s) => s.expandAllTools)
  const collapseAllTools = useAppStore((s) => s.collapseAllTools)
  const activeRef = useRef(active)

  const pending = useMemo(() => messages.findLast((m) => m.role === "assistant" && !m.time.completed)?.id, [messages])

  // rowOffset: how many rows from the absolute bottom of all content to scroll up.
  // 0 = stick to bottom (latest), positive = scrolled up.
  const [rowOffset, setRowOffset] = useState(savedPos)
  const sticky = rowOffset === 0
  const prevMsgCount = useRef(messages.length)

  // Total estimated height of all messages. Completed messages are served
  // from the module-scoped heightCache; only the pending (streaming) message
  // is recomputed on every delta.
  const totalHeight = useMemo(() => {
    if (cacheWidth !== width) {
      heightCache.clear()
      cacheWidth = width
    }
    const base = messages.reduce((acc, msg) => acc + cachedHeight(msg, parts[msg.id] ?? [], width, pending), 0)
    return base + 2
  }, [messages, parts, width, pending])

  // Max rows we can scroll up before reaching the very top
  const maxRowOffset = Math.max(0, totalHeight - height)
  const clampedOffset = Math.min(rowOffset, maxRowOffset)

  // Keep refs stable for subscriptions
  activeRef.current = active
  const maxRowOffsetRef = useRef(maxRowOffset)
  maxRowOffsetRef.current = maxRowOffset

  // Absolute top position of the content box inside the clipping container.
  // rowOffset=0  → absoluteTop = -(totalHeight-height)  → shows BOTTOM of content
  // rowOffset=max → absoluteTop = 0                     → shows TOP of content
  const absoluteTop = totalHeight > height ? -(totalHeight - height - clampedOffset) : 0

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
        const tools = (parts[msg.id] ?? []).filter((p) => p.type === "tool")
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

  return (
    <Box height={height} overflowY="hidden" flexDirection="column">
      {/* Scroll indicator — overlaid at the top-right when scrolled up */}
      {clampedOffset > 0 && (
        <Box position="absolute" width={width} flexDirection="row" justifyContent="flex-end">
          <Text dimColor>{`↑ scrolled · ctrl+↓ snap bottom `}</Text>
        </Box>
      )}

      {/* Content box — negative marginTop slides content up, overflowY clips it.
          absoluteTop is negative when rowOffset=0 (stick to bottom), 0 when at top. */}
      <Box flexDirection="column" marginTop={absoluteTop}>
        {messages.map((msg) => {
          const msgParts = parts[msg.id] ?? []
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
            />
          )
        })}
      </Box>
    </Box>
  )
})
