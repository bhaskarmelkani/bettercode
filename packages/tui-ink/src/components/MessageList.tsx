import React, { useEffect, useRef, useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { Message, Part, SnapshotFileDiff, TextPart as TextPartType } from "@opencode-ai/sdk/v2"
import { UserMessage } from "./UserMessage"
import { AssistantMessage } from "./AssistantMessage"
import { useAppStore } from "../store"
import { mouseScrollEvents } from "../mouseScrollEvents"
import { lex } from "./markdown/MarkdownRenderer"
import type { Token } from "./markdown/types"
import { useTheme } from "../theme-context"
import type { AssistantMsg } from "../types"
import { OffscreenFreeze } from "./OffscreenFreeze"
import { useTextSelection } from "../hooks/useTextSelection"
import { copy } from "../utils/clipboard"
import { cursorDown, cursorOffset, cursorUp, editText, messageText } from "./MessageActions"

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

function toolOpen(part: Part, collapsed: Record<string, boolean>, focusMode: boolean) {
  if (part.type !== "tool") return false
  if (!("state" in part) || !part.state || typeof part.state !== "object" || !("status" in part.state)) return false
  if (focusMode) return false
  if (collapsed[part.id] === false) return true
  if (collapsed[part.id] === true) return false
  return part.state.status === "error"
}

function crop(text: string, cols: number, rows: number) {
  const list = text.split(/\r?\n/)
  return Math.min(list.length, rows) + (list.length > rows ? 1 : 0)
}

function toolHeight(part: Part, width: number, collapsed: Record<string, boolean>, focusMode: boolean) {
  if (part.type !== "tool") return 0
  if (!("state" in part) || !part.state || typeof part.state !== "object" || !("status" in part.state)) return 1
  if (!toolOpen(part, collapsed, focusMode)) return 1
  const cols = Math.max(40, width - 6)
  if (part.state.status === "error") return 2 + crop(part.state.error, cols, 30)
  if (part.state.status === "completed") {
    if (
      (part.tool.includes("write") || part.tool.includes("edit") || part.tool.includes("patch")) &&
      part.state.output.includes("@@")
    ) {
      return 2 + crop(part.state.output, cols, 30)
    }
    return 2 + crop(part.state.output, cols, 30)
  }
  return 2 + crop(JSON.stringify(part.state.input, null, 2), cols, 30)
}

function diffHeight(diffs: SnapshotFileDiff[], open: boolean) {
  if (diffs.length === 0) return 0
  return 1 + diffs.length + (open ? diffs.reduce((sum, item) => sum + 1 + crop(item.patch, 200, 25), 0) : 0)
}

function viewVersion(
  msg: Message,
  parts: Part[],
  diffs: SnapshotFileDiff[],
  diffOpen: boolean,
  collapsed: Record<string, boolean>,
  focusMode: boolean,
  showThinking: boolean,
  isLast: boolean,
) {
  const err = msg.role === "assistant" ? (msg as AssistantMsg).error : undefined
  return (
    cacheVersion(parts, diffs, diffOpen) +
    parts.reduce(
      (sum, part, i) =>
        sum +
        (part.type === "tool" ? (toolOpen(part, collapsed, focusMode) ? (i + 1) * 17 : (i + 1) * 11) : 0) +
        (part.type === "reasoning" && showThinking ? (i + 1) * 5 : 0),
      0,
    ) +
    (focusMode ? 101 : 0) +
    (showThinking ? 211 : 0) +
    (isLast ? 307 : 0) +
    (err ? 401 : 0)
  )
}

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
  diffOpen: boolean,
  width: number,
  pending: string | undefined,
  collapsed: Record<string, boolean>,
  focusMode: boolean,
  showThinking: boolean,
  isLast: boolean,
) {
  // Always recompute for the actively streaming message.
  if (msg.id === pending) {
    return estimateHeight(msg, parts, width, diffs, diffOpen, { collapsed, focusMode, showThinking, isLast })
  }
  const v = viewVersion(msg, parts, diffs, diffOpen, collapsed, focusMode, showThinking, isLast)
  const entry = heightCache.get(msg.id)
  if (entry && entry.version === v) return entry.height
  const h = estimateHeight(msg, parts, width, diffs, diffOpen, { collapsed, focusMode, showThinking, isLast })
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

type Key = {
  ctrl: boolean
  meta: boolean
  shift: boolean
  pageDown: boolean
  pageUp: boolean
  upArrow: boolean
  downArrow: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function unseen(total: number, seen: number | undefined, offset: number) {
  if (offset === 0) return { count: 0, split: total }
  const split = clamp(seen ?? total, 0, total)
  return { count: Math.max(0, total - split), split }
}

export function pagerOffset(input: string, key: Key, pos: number, max: number, rows: number, generating: boolean) {
  const half = Math.max(1, Math.floor(rows / 2))
  const full = Math.max(1, rows - 2)
  const free = pos > 0
  const plain = !key.ctrl && !key.meta

  if (key.pageUp || (key.upArrow && key.shift) || (key.upArrow && generating)) {
    return clamp(pos + SCROLL_STEP, 0, max)
  }

  if (key.pageDown || (key.downArrow && key.shift) || (key.downArrow && generating)) {
    return clamp(pos - SCROLL_STEP, 0, max)
  }

  if (key.ctrl && key.upArrow) return max
  if (key.ctrl && key.downArrow) return 0
  if (!free) return

  if (plain && input === "g" && !key.shift) return max
  if (plain && key.shift && input.toLowerCase() === "g") return 0
  if (plain && input === "j") return clamp(pos - 1, 0, max)
  if (plain && input === "k") return clamp(pos + 1, 0, max)
  if (key.ctrl && input === "d") return clamp(pos - half, 0, max)
  if (key.ctrl && input === "u") return clamp(pos + half, 0, max)
  if (key.ctrl && input === "f") return clamp(pos - full, 0, max)
  if (key.ctrl && input === "b") return clamp(pos + full, 0, max)
  if (plain && input === " ") return clamp(pos - full, 0, max)
  if (plain && input === "b") return clamp(pos + full, 0, max)
  if (plain && input === "q") return 0
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
  const badge = files.reduce((rows, file) => rows + Math.max(8, (file.filename ?? "").length + 8), 0)
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

export function estimateHeight(
  msg: Message,
  parts: Part[],
  width: number,
  diffs: SnapshotFileDiff[] = [],
  diffOpen = false,
  opts: {
    collapsed?: Record<string, boolean>
    focusMode?: boolean
    showThinking?: boolean
    isLast?: boolean
  } = {},
): number {
  const safeWidth = Math.max(1, width - 6)
  if (msg.role === "user") {
    const t = parts.find((p): p is TextPartType => p.type === "text" && !p.synthetic)
    const body = t ? lex(t.text) : []
    return Math.max(1, measure(body, safeWidth)) + 1 + fileRows(parts, safeWidth)
  }
  const item = msg as AssistantMsg
  const collapsed = opts.collapsed ?? {}
  const focusMode = opts.focusMode ?? false
  const showThinking = opts.showThinking ?? true
  const isLast = opts.isLast ?? false
  const lastText = focusMode
    ? parts.reduce((out, part, i) => (part.type === "text" && !part.synthetic && !part.ignored ? i : out), -1)
    : -1
  let h = 1
  for (const [i, part] of parts.entries()) {
    if (part.type === "text") {
      if (part.synthetic || part.ignored) continue
      if (focusMode && i !== lastText) continue
      h += Math.max(1, measure(lex(part.text), safeWidth))
    } else if (part.type === "tool") {
      h += toolHeight(part, safeWidth, collapsed, focusMode)
    } else if (part.type === "compaction") {
      if (focusMode) continue
      h += 2
    } else if (part.type === "reasoning") {
      if (!showThinking || focusMode) continue
      const text = part.text.replace("[REDACTED]", "").trim()
      if (text) h += lines(text, safeWidth) + 2
    }
  }
  if (focusMode) return Math.max(2, h)
  const done = !!item.finish && !["tool-calls", "unknown"].includes(item.finish)
  const aborted = item.error?.name === "MessageAbortedError"
  if (item.error?.name && item.error.name !== "MessageAbortedError") {
    h += 1 + (typeof item.error.data?.message === "string" ? lines(item.error.data.message, safeWidth) : 0)
  }
  h += diffHeight(diffs, diffOpen)
  if (isLast || done || aborted) h += 2
  return Math.max(2, h)
}

function stickyPromptText(messages: Message[], parts: Record<string, Part[]>): string {
  const last = messages.findLast((msg) => msg.role === "user")
  if (!last) return ""
  const part = (parts[last.id] ?? EMPTY_ARRAY).find(
    (item): item is TextPartType => item.type === "text" && !item.synthetic,
  )
  if (!part) return ""
  const first = part.text.split("\n")[0] ?? ""
  return first.length > 80 ? `${first.slice(0, 79)}…` : first
}

function age(start?: number, end?: number) {
  if (!start || !end) return ""
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  const sec = (ms / 1000).toFixed(ms < 10_000 ? 1 : 0)
  return `${sec}s`
}

function usage(input = 0, output = 0) {
  const total = input + output
  if (total < 1000) return `${total}`
  const out = (total / 1000).toFixed(total < 10_000 ? 1 : 0)
  return `${out}k`
}

function lineCap(text: string, width: number) {
  if (width <= 0) return ""
  return text.length <= width ? text : text.slice(0, width)
}

function wrapPlain(text: string, width: number, head = "", tail = head) {
  const rows = text.split(/\r?\n/)
  const out: string[] = []

  for (const row of rows) {
    if (!row) {
      out.push(lineCap(head, width))
      continue
    }

    let rest = row
    let first = true
    while (rest.length > 0) {
      const prefix = first ? head : tail
      const span = Math.max(1, width - prefix.length)
      out.push(lineCap(prefix + rest.slice(0, span), width))
      rest = rest.slice(span)
      first = false
    }
  }

  return out.length > 0 ? out : [lineCap(head, width)]
}

function limitRows(text: string, width: number, rows: number, head = "", tail = head) {
  const out = wrapPlain(text, width, head, tail)
  if (out.length <= rows) return out
  return [...out.slice(0, rows), lineCap(`${tail}… ${out.length - rows} more lines`, width)]
}

function toolSum(input: Record<string, unknown>) {
  return Object.entries(input)
    .slice(0, 3)
    .map(([key, value]) => {
      if (typeof value === "string") return value
      if (typeof value === "number" || typeof value === "boolean") return String(value)
      if (Array.isArray(value)) return `${key}[${value.length}]`
      if (value && typeof value === "object") return key
      return key
    })
    .filter(Boolean)
    .join(" ")
}

function toolTitle(part: Part) {
  if (part.type !== "tool") return ""
  const state = part.state
  if ("title" in state && typeof state.title === "string" && state.title) return state.title
  const sum = toolSum(state.input)
  return sum ? `${part.tool} ${sum}` : part.tool
}

function projectUser(parts: Part[], width: number, isQueued: boolean) {
  const out = [""]
  const item = parts.find((part): part is TextPartType => part.type === "text" && !part.synthetic)
  if (item) out.push(...wrapPlain(item.text, width, " ● ", "   "))
  const files = parts.filter((part) => part.type === "file").map((part) => `[${part.filename ?? ""}]`).join(" ")
  if (files) out.push(...wrapPlain(files, width, "   ", "   "))
  if (isQueued) out.push("   QUEUED")
  return out
}

function projectTool(part: Part, width: number, collapsed: Record<string, boolean>, focusMode: boolean) {
  if (part.type !== "tool") return [] as string[]
  const out = [`   ${toolOpen(part, collapsed, focusMode) ? "▾" : "▸"} ${toolTitle(part)}`]
  if (!toolOpen(part, collapsed, focusMode)) return out
  const state = part.state
  if (state.status === "error") return [...out, ...limitRows(state.error, width, 30, "     ", "     ")]
  if (state.status === "completed") return [...out, ...limitRows(state.output, width, 30, "     ", "     ")]
  return [...out, ...limitRows(JSON.stringify(state.input, null, 2), width, 30, "     ", "     ")]
}

function projectDiffs(diffs: SnapshotFileDiff[], open: boolean, width: number) {
  if (diffs.length === 0) return [] as string[]
  const add = diffs.reduce((sum, item) => sum + item.additions, 0)
  const del = diffs.reduce((sum, item) => sum + item.deletions, 0)
  const out = [""]
  out.push(lineCap(`   ${open ? "▾" : "▸"} edits ${diffs.length} file${diffs.length === 1 ? "" : "s"} +${add} -${del}`, width))
  for (const item of diffs) {
    out.push("")
    out.push(...wrapPlain(`${item.status} ${item.file} +${item.additions} -${item.deletions}`, width, "   ", "   "))
    if (!open) continue
    out.push(...limitRows(item.patch, width, 25, "     ", "     "))
  }
  return out
}

function projectAssistant(
  msg: Message,
  parts: Part[],
  width: number,
  showThinking: boolean,
  isLast: boolean,
  focusMode: boolean,
  collapsed: Record<string, boolean>,
  diffs: SnapshotFileDiff[],
  diffOpen: boolean,
) {
  const out = [""]
  const item = msg as AssistantMsg
  const lastText = focusMode
    ? parts.reduce((acc, part, i) => (part.type === "text" && !part.synthetic && !part.ignored ? i : acc), -1)
    : -1
  let lead = true

  for (const [i, part] of parts.entries()) {
    if (part.type === "text") {
      if (part.synthetic || part.ignored) continue
      if (focusMode && i !== lastText) continue
      out.push(...wrapPlain(part.text, width, lead ? "   ◆ " : "   ", lead ? "     " : "   "))
      lead = false
      continue
    }
    if (focusMode && (part.type === "reasoning" || part.type === "compaction")) continue
    if (part.type === "reasoning") {
      if (!showThinking) continue
      const text = part.text.replace("[REDACTED]", "").trim()
      if (!text) continue
      out.push("")
      out.push(" Thinking:")
      out.push(...wrapPlain(text, width, "  ", "  "))
      continue
    }
    if (part.type === "tool") {
      out.push(...projectTool(part, width, collapsed, focusMode))
      continue
    }
    if (part.type === "compaction") {
      out.push("")
      out.push("   compacted context")
    }
  }

  if (!focusMode && item.error && item.error.name !== "MessageAbortedError") {
    out.push("")
    out.push(` ✗ ${item.error.name}`)
    if (typeof item.error.data?.message === "string") {
      out.push(...wrapPlain(item.error.data.message, width, "   ", "   "))
    }
  }

  const done = !!item.finish && !["tool-calls", "unknown"].includes(item.finish)
  const doneAt = item.time?.completed
  const footer = [
    item.mode ?? "chat",
    item.modelID,
    doneAt ? age(item.time?.created, doneAt) : "",
    doneAt ? `${usage(item.tokens.input, item.tokens.output)} tokens` : "",
    item.error?.name === "MessageAbortedError" ? "interrupted" : "",
  ].filter((value): value is string => !!value)
  if (!focusMode && (isLast || done || item.error?.name === "MessageAbortedError") && footer.length > 0) {
    out.push("")
    out.push(lineCap(` ${footer.join(" · ")}`, width))
  }

  if (!focusMode) out.push(...projectDiffs(diffs, diffOpen, width))
  return out
}

export function projectViewport(args: {
  messages: Message[]
  parts: Record<string, Part[]>
  topH: number[]
  botH: number[]
  winStart: number
  winEnd: number
  scrollTop: number
  height: number
  width: number
  mark: { count: number; split: number }
  pending?: string
  collapsed: Record<string, boolean>
  diffs: Record<string, SnapshotFileDiff[]>
  collapsedDiffs: Record<string, boolean>
  showThinking: boolean
  focusMode: boolean
}) {
  const out = Array.from({ length: args.height }, () => "")

  for (let i = args.winStart; i < args.winEnd; i++) {
    const msg = args.messages[i]
    if (!msg) continue
    const parts = args.parts[msg.id] ?? EMPTY_ARRAY
    const row = args.topH[i] ?? 0
    const span = (args.botH[i] ?? row) - row
    const rel = row - args.scrollTop
    const diff = args.diffs[msg.id] ?? EMPTY_DIFF
    const diffOpen = !(args.collapsedDiffs[msg.id] ?? true)
    const isQueued = !!(args.pending && msg.id > args.pending)
    const showMark = args.mark.count > 0 && i === args.mark.split
    const body =
      msg.role === "user"
        ? projectUser(parts, args.width, isQueued)
        : projectAssistant(
            msg,
            parts,
            args.width,
            args.showThinking,
            msg.id === args.messages[args.messages.length - 1]?.id,
            args.focusMode,
            args.collapsed,
            diff,
            diffOpen,
          )
    const rows = showMark
      ? [lineCap(` ── ${args.mark.count} new message${args.mark.count > 1 ? "s" : ""} ── `, args.width), ...body]
      : body

    while (rows.length < span) rows.push("")
    if (rows.length > span) rows.length = span

    for (let j = 0; j < rows.length; j++) {
      const y = rel + j
      if (y < 0 || y >= args.height) continue
      out[y] = rows[j] ?? ""
    }
  }

  return out
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
// Extra messages to render above/below the visible viewport
const WIN_BUFFER = 2

export function findWindow(
  top: number[],
  bot: number[],
  total: number,
  scrollTop: number,
  viewH: number,
  buffer = WIN_BUFFER,
) {
  const viewEnd = scrollTop + viewH
  let first = top.length
  let last = -1

  for (let i = 0; i < top.length; i++) {
    if (bot[i]! <= scrollTop || top[i]! >= viewEnd) continue
    if (i < first) first = i
    last = i
  }

  if (last === -1) {
    return {
      visStart: 0,
      visEnd: 0,
      winStart: 0,
      winEnd: 0,
      topSpacer: 0,
      bottomSpacer: total,
    }
  }

  const visStart = first
  const visEnd = last + 1
  const winStart = Math.max(0, visStart - buffer)
  const winEnd = Math.min(top.length, visEnd + buffer)
  const topSpacer = top[winStart] ?? total
  const bottomSpacer = winEnd > 0 ? total - (bot[winEnd - 1] ?? 0) : total

  return {
    visStart,
    visEnd,
    winStart,
    winEnd,
    topSpacer,
    bottomSpacer,
  }
}

export const MessageList = React.memo(function MessageList({ sessionID, height, width, active, generating }: Props) {
  const theme = useTheme()
  const messages = useAppStore((s) => s.messages[sessionID] ?? EMPTY_MESSAGES)
  const parts = useSessionParts(sessionID)
  const showThinking = useAppStore((s) => s.showThinking)
  const focusMode = useAppStore((s) => s.focusMode)
  const searchMode = useAppStore((s) => s.searchMode)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const searchMatchIdx = useAppStore((s) => s.searchMatchIdx)
  const setSearchMatchCount = useAppStore((s) => s.setSearchMatchCount)
  const savedPos = useAppStore((s) => s.scrollPos[sessionID] ?? 0)
  const setScrollPos = useAppStore((s) => s.setScrollPos)
  const seen = useAppStore((s) => s.lastSeen[sessionID])
  const setLastSeen = useAppStore((s) => s.setLastSeen)
  const cursorIdx = useAppStore((s) => s.messageCursor[sessionID] ?? null)
  const setMessageCursor = useAppStore((s) => s.setMessageCursor)
  const seedComposer = useAppStore((s) => s.seedComposer)
  const loadMessageDiff = useAppStore((s) => s.loadMessageDiff)
  const toggleDiffCollapse = useAppStore((s) => s.toggleDiffCollapse)
  const messageDiff = useAppStore((s) => s.messageDiff)
  const collapsedDiffs = useAppStore((s) => s.collapsedDiffs)
  const collapsedTools = useAppStore((s) => s.collapsedTools)
  const expandAllTools = useAppStore((s) => s.expandAllTools)
  const collapseAllTools = useAppStore((s) => s.collapseAllTools)
  const addToast = useAppStore((s) => s.addToast)
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
  const mark = useMemo(() => unseen(messages.length, seen, rowOffset), [messages.length, rowOffset, seen])
  const stickyPrompt = useMemo(() => (sticky ? "" : stickyPromptText(messages, parts)), [messages, parts, sticky])
  const prevMsgCount = useRef(messages.length)
  const prevTotal = useRef(0)
  const prevOffset = useRef(savedPos)
  const searchState = useRef({ open: false, pos: savedPos })

  // Compute totalHeight and per-message cumulative heights in one pass.
  // cumH[i] = sum of heights of messages 0..i-1; cumH[messages.length] = total base.
  // Completed messages are served from heightCache (O(1)); only the pending message
  // is recomputed on every delta.
  const [totalHeight, topH, botH] = useMemo(() => {
    if (cacheWidth !== width) {
      heightCache.clear()
      cacheWidth = width
    }
    const top: number[] = []
    const bot: number[] = []
    let sum = 0
    for (const [i, msg] of messages.entries()) {
      if (mark.count > 0 && i === mark.split) sum += 1
      top.push(sum)
      const diffs = messageDiff[msg.id] ?? EMPTY_DIFF
      const diffOpen = !(collapsedDiffs[msg.id] ?? true)
      sum += cachedHeight(
        msg,
        parts[msg.id] ?? EMPTY_ARRAY,
        diffs,
        diffOpen,
        width,
        pending,
        collapsedTools,
        focusMode,
        showThinking,
        msg.id === messages[messages.length - 1]?.id,
      )
      bot.push(sum)
    }
    return [sum, top, bot] as const
  }, [collapsedDiffs, collapsedTools, focusMode, mark.count, mark.split, messageDiff, messages, parts, showThinking, width, pending])

  const matches = useMemo(() => {
    if (!searchMode || !searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return messages
      .map((msg, i) => {
        const text = (parts[msg.id] ?? EMPTY_ARRAY)
          .filter((part): part is TextPartType => part.type === "text" && !part.synthetic && !part.ignored)
          .map((part) => part.text)
          .join(" ")
          .toLowerCase()
        return text.includes(q) ? i : -1
      })
      .filter((i) => i !== -1)
  }, [messages, parts, searchMode, searchQuery])

  // Max rows we can scroll up before reaching the very top
  const maxRowOffset = Math.max(0, totalHeight - height)
  const clampedOffset = Math.min(rowOffset, maxRowOffset)

  useEffect(() => {
    setSearchMatchCount(matches.length)
  }, [matches.length, setSearchMatchCount])

  useEffect(() => {
    if (matches.length === 0) return
    const idx = ((searchMatchIdx % matches.length) + matches.length) % matches.length
    const msgIdx = matches[idx]
    if (msgIdx === undefined) return
    const top = topH[msgIdx] ?? 0
    const bottom = botH[msgIdx] ?? 0
    const center = (top + bottom) / 2
    const target = Math.max(0, totalHeight - center - Math.floor(height / 2))
    setRowOffset(Math.min(target, maxRowOffset))
  }, [botH, height, matches, maxRowOffset, searchMatchIdx, topH, totalHeight])

  useEffect(() => {
    const prev = prevTotal.current
    if (prev === totalHeight) return
    prevTotal.current = totalHeight
    const delta = totalHeight - prev
    if (delta === 0 || rowOffset === 0 || searchMode) return
    setRowOffset((o) => Math.min(Math.max(0, o + delta), Math.max(0, totalHeight - height)))
  }, [height, rowOffset, searchMode, totalHeight])

  useEffect(() => {
    if (searchMode && !searchState.current.open) {
      searchState.current = { open: true, pos: rowOffset }
      return
    }
    if (!searchMode && searchState.current.open) {
      searchState.current.open = false
      setRowOffset(searchState.current.pos)
    }
  }, [rowOffset, searchMode])

  useEffect(() => {
    prevOffset.current = savedPos
  }, [sessionID])

  useEffect(() => {
    if (cursorIdx === null) return
    if (messages.length === 0) {
      setMessageCursor(sessionID, null)
      return
    }
    if (cursorIdx >= messages.length) setMessageCursor(sessionID, messages.length - 1)
  }, [cursorIdx, messages.length, sessionID, setMessageCursor])

  useEffect(() => {
    const prev = prevOffset.current
    if (prev === 0 && rowOffset > 0) setLastSeen(sessionID, messages.length)
    if (rowOffset === 0 && seen !== messages.length) setLastSeen(sessionID, messages.length)
    prevOffset.current = rowOffset
  }, [messages.length, rowOffset, seen, sessionID, setLastSeen])

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
  const view = useMemo(
    () => findWindow(topH, botH, totalHeight, scrollTop, height),
    [botH, height, scrollTop, topH, totalHeight],
  )

  // Restore scroll position when switching sessions
  useEffect(() => {
    prevTotal.current = totalHeight
    setRowOffset(savedPos)
  }, [sessionID, savedPos, totalHeight])

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
    return mouseScrollEvents.on((direction, rows) => {
      if (!activeRef.current) return
      if (direction === "up") {
        setRowOffset((o) => Math.min(o + rows, maxRowOffsetRef.current))
      } else {
        setRowOffset((o) => Math.max(0, o - rows))
      }
    })
  }, [])

  useInput(
    (_input, key) => {
      if (key.escape && cursorIdx !== null) {
        setMessageCursor(sessionID, null)
        return
      }

      if (key.shift && key.upArrow) {
        const next = cursorUp(messages.length, cursorIdx)
        if (next === null) return
        setMessageCursor(sessionID, next)
        setRowOffset((offset) => cursorOffset(next, topH, botH, totalHeight, height, offset))
        return
      }

      if (key.shift && key.downArrow) {
        const next = cursorDown(messages.length, cursorIdx)
        if (next === null) return
        setMessageCursor(sessionID, next)
        setRowOffset((offset) => cursorOffset(next, topH, botH, totalHeight, height, offset))
        return
      }

      const plainCopy = cursorIdx !== null && !key.ctrl && !key.meta && !key.shift && _input === "c"
      const chordCopy = cursorIdx !== null && key.ctrl && key.shift && _input.toLowerCase() === "c"
      if (plainCopy || chordCopy) {
        const msg = messages[cursorIdx]
        if (!msg) return
        const text = messageText(msg, parts[msg.id] ?? EMPTY_ARRAY, showThinking)
        if (!text) return
        void copy(text).then((ok) => {
          addToast({
            message: ok ? "Copied message" : "Copy failed",
            variant: ok ? "success" : "error",
            duration: 1800,
          })
        })
        return
      }

      if (cursorIdx !== null && !key.ctrl && !key.meta && !key.shift && _input === "e") {
        const msg = messages[cursorIdx]
        if (!msg || msg.role !== "user") return
        const text = editText(msg, parts[msg.id] ?? EMPTY_ARRAY)
        if (!text) return
        seedComposer(text)
        setMessageCursor(sessionID, null)
        setRowOffset(0)
        return
      }

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
      setRowOffset((o) => pagerOffset(_input, key, o, maxRowOffset, height, generating) ?? o)
    },
    { isActive: active },
  )

  const last = messages[messages.length - 1]
  const win = messages.slice(view.winStart, view.winEnd)
  const current =
    matches.length === 0 ? -1 : matches[((searchMatchIdx % matches.length) + matches.length) % matches.length]!
  const selection = useTextSelection({
    active,
    detached: clampedOffset > 0,
    lines: useMemo(
      () =>
        projectViewport({
          messages,
          parts,
          topH,
          botH,
          winStart: view.winStart,
          winEnd: view.winEnd,
          scrollTop,
          height,
          width,
          mark,
          pending,
          collapsed: collapsedTools,
          diffs: messageDiff,
          collapsedDiffs,
          showThinking,
          focusMode,
        }),
      [messages, parts, topH, botH, view.winStart, view.winEnd, scrollTop, height, width, mark, pending, collapsedTools, messageDiff, collapsedDiffs, showThinking, focusMode],
    ),
    width,
    height,
    top: 1 + (searchMode ? 1 : 0),
    onCopy: (text, ok) =>
      addToast({
        message: ok ? `Copied ${text.length} chars` : "Copy failed",
        variant: ok ? "success" : "error",
        duration: 1800,
      }),
  })

  useEffect(() => {
    selection.clear()
  }, [sessionID, clampedOffset, searchMode, cursorIdx])

  return (
    <Box height={height} overflowY="hidden" flexDirection="column">
      {stickyPrompt && (
        <Box position="absolute" width={width} flexDirection="row" paddingLeft={1} paddingRight={1}>
          <Text color={theme.cyan} bold wrap="truncate-end">
            {"▶ "}
          </Text>
          <Text color={theme.subtext} wrap="truncate-end">
            {stickyPrompt}
          </Text>
        </Box>
      )}
      {/* Scroll indicator — overlaid at the top-right when scrolled up */}
      {clampedOffset > 0 && (
        <Box position="absolute" width={width} flexDirection="row" justifyContent="flex-end">
          <Text dimColor>{`↑ scrolled · ctrl+↓ snap bottom `}</Text>
        </Box>
      )}
      {clampedOffset > 0 && mark.count > 0 && (
        <Box position="absolute" width={width} marginTop={Math.max(0, height - 1)} justifyContent="center">
          <Text color={theme.cyan} inverse>{` ↓ ${mark.count} new ↓ `}</Text>
        </Box>
      )}
      {selection.rows.map((row) => (
        <Box key={`${row.y}-${row.x}-${row.text.length}`} position="absolute" marginTop={row.y} paddingLeft={row.x}>
          <Text inverse>{row.text}</Text>
        </Box>
      ))}

      {/* Content box — negative marginTop slides content up, overflowY clips it.
          absoluteTop is negative when rowOffset=0 (stick to bottom), 0 when at top.
          Top/bottom spacers preserve the total inner-box height so scroll math
          stays identical regardless of how many messages are actually rendered. */}
      <Box flexDirection="column" marginTop={absoluteTop}>
        {view.topSpacer > 0 && <Box height={view.topSpacer} />}
        {win.map((msg, i) => {
          const msgParts = parts[msg.id] ?? EMPTY_ARRAY
          const idx = view.winStart + i
          const highlight = matches.includes(idx)
          const currentHighlight = idx === current
          const tone = idx === cursorIdx ? "cursor" : currentHighlight || highlight ? "search" : undefined
          const showMark = mark.count > 0 && idx === mark.split
          const visible = idx >= view.visStart && idx < view.visEnd
          if (msg.role === "user") {
            const isQueued = !!(pending && msg.id > pending)
            return (
              <OffscreenFreeze key={msg.id} visible={visible}>
                <React.Fragment>
                  {showMark && (
                    <Box justifyContent="center">
                      <Text color={theme.cyan} bold>{` ── ${mark.count} new message${mark.count > 1 ? "s" : ""} ── `}</Text>
                    </Box>
                  )}
                  <UserMessage parts={msgParts} isQueued={isQueued} tone={tone} />
                </React.Fragment>
              </OffscreenFreeze>
            )
          }
          return (
            <OffscreenFreeze key={msg.id} visible={visible}>
              <React.Fragment>
                {showMark && (
                  <Box justifyContent="center">
                    <Text color={theme.cyan} bold>{` ── ${mark.count} new message${mark.count > 1 ? "s" : ""} ── `}</Text>
                  </Box>
                )}
                <AssistantMessage
                  message={msg}
                  parts={msgParts}
                  showThinking={showThinking}
                  isLast={msg.id === last?.id}
                  tone={tone}
                  diffs={messageDiff[msg.id] ?? EMPTY_DIFF}
                  diffOpen={!(collapsedDiffs[msg.id] ?? true)}
                  onToggleDiff={(messageDiff[msg.id]?.length ?? 0) > 0 ? () => toggleDiffCollapse(msg.id) : undefined}
                />
              </React.Fragment>
            </OffscreenFreeze>
          )
        })}
        {view.bottomSpacer > 0 && <Box height={view.bottomSpacer} />}
      </Box>
    </Box>
  )
})
