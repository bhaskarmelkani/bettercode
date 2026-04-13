import React, { useEffect, useRef, useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import { UserMessage } from "./UserMessage"
import { AssistantMessage } from "./AssistantMessage"
import { useAppStore } from "../store"
import { mouseScrollEvents } from "../mouseScrollEvents"

const EMPTY_MESSAGES: Message[] = []
const EMPTY_PARTS: Record<string, Part[]> = {}

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
function estimateHeight(msg: Message, parts: Part[], width: number): number {
  const safeWidth = Math.max(1, width - 6) // account for border/padding chars
  if (msg.role === "user") {
    const text = parts.find((p) => p.type === "text" && !(p as any).synthetic) as { text: string } | undefined
    const lines = text ? Math.max(1, Math.ceil(text.text.length / safeWidth)) : 0
    return lines + 4 // 1 marginTop + 1 paddingTop + lines + 1 paddingBottom + 1 safety
  }
  // assistant: 1 marginTop + parts + 2 footer (footerMarginTop + footerText)
  let h = 3
  for (const part of parts) {
    if (part.type === "text") {
      const p = part as { text: string; synthetic?: boolean; ignored?: boolean }
      if (p.synthetic || p.ignored) continue
      const lines = Math.max(1, Math.ceil(p.text.length / safeWidth))
      h += lines + 2 // 1 marginTop on TextPart + lines + 1 extra safety
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
  const activeRef = useRef(active)

  const pending = useMemo(
    () => messages.findLast((m) => m.role === "assistant" && !(m as any).time?.completed)?.id,
    [messages],
  )

  // rowOffset: how many rows from the absolute bottom of all content to scroll up.
  // 0 = stick to bottom (latest), positive = scrolled up.
  const [rowOffset, setRowOffset] = useState(savedPos)
  const sticky = rowOffset === 0
  const prevMsgCount = useRef(messages.length)

  // Total estimated height of all messages (+2 safety buffer to prevent bottom clip)
  const totalHeight = useMemo(() => {
    const base = messages.reduce((acc, msg) => acc + estimateHeight(msg, parts[msg.id] ?? [], width), 0)
    return base + 2
  }, [messages, parts, width])

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
            return <UserMessage key={msg.id} message={msg} parts={msgParts} isQueued={isQueued} />
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
