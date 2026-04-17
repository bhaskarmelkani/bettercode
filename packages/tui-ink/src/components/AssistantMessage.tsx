import React from "react"
import { Box, Text } from "ink"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import type { AssistantMsg } from "../types"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { TextPart } from "./parts/TextPart"
import { ReasoningPart } from "./parts/ReasoningPart"
import { ToolPart } from "./parts/ToolPart"
import { CompactionPart } from "./parts/CompactionPart"
import { MessageDiff } from "./MessageDiff"
import type { SnapshotFileDiff } from "@opencode-ai/sdk/v2"
import { ToolGroup } from "./parts/ToolGroup"
import { groupOpen, groupParts } from "../utils/toolGroup"
import { toolLabel } from "../utils/toolKind"

interface Props {
  message: Message
  parts: Part[]
  showThinking: boolean
  isLast: boolean
  tone?: "search" | "cursor"
  diffs?: SnapshotFileDiff[]
  diffOpen?: boolean
  onToggleDiff?: () => void
}

function dur(start?: number, end?: number) {
  if (!start || !end) return ""
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  const sec = (ms / 1000).toFixed(ms < 10_000 ? 1 : 0)
  return `${sec}s`
}

function tok(input: number, output: number) {
  const total = input + output
  if (total < 1000) return `${total}`
  const out = (total / 1000).toFixed(total < 10_000 ? 1 : 0)
  return `${out}k`
}

function toolSummary(parts: Part[]) {
  const count = new Map<string, number>()
  let total = 0

  for (const part of parts) {
    if (part.type !== "tool") continue
    if (part.state.status !== "completed") continue
    const key = toolLabel(part.tool)
    count.set(key, (count.get(key) ?? 0) + 1)
    if ("time" in part.state && "end" in part.state.time) {
      total += part.state.time.end - part.state.time.start
    }
  }

  const text = [...count.entries()]
    .map(([key, n]) => `${key === "read" ? "◇" : key === "write" ? "✎" : key === "exec" ? "$" : "⬡"} ${n} ${key}`)
    .join(" · ")
  if (!text) return ""
  const time =
    total > 0 ? ` — ${total < 1000 ? `${total}ms` : `${(total / 1000).toFixed(total < 10_000 ? 1 : 0)}s`}` : ""
  return `${text}${time}`
}

export const AssistantMessage = React.memo(function AssistantMessage({
  message,
  parts,
  showThinking,
  isLast,
  tone,
  diffs = [],
  diffOpen = false,
  onToggleDiff,
}: Props) {
  const theme = useTheme()
  const focusMode = useAppStore((s) => s.focusMode)
  const collapsed = useAppStore((s) => s.collapsedTools)
  if (message.role !== "assistant") return null
  const msg = message as AssistantMsg
  const first = parts.find((part) => part.type === "text" && !part.synthetic && !part.ignored)
  const grouped = groupParts(parts)
  const hasText = parts.some((part) => part.type === "text" && !part.synthetic && !part.ignored)
  const hasTools = parts.some((part) => part.type === "tool")
  const tools = toolSummary(parts)

  const done = msg.finish && !["tool-calls", "unknown"].includes(msg.finish)
  let lead = true
  let sep = false
  const doneAt = msg.time?.completed
  // Footer split: context info (left) vs measurements (right).
  const footerLeft = [msg.mode ?? "chat", msg.modelID].filter(Boolean).join(" · ")
  const footerRight = [
    doneAt ? dur(msg.time?.created, doneAt) : "",
    doneAt ? `${tok(msg.tokens.input, msg.tokens.output)} tokens` : "",
    msg.error?.name === "MessageAbortedError" ? "interrupted" : "",
  ].filter(Boolean).join(" · ")
  const border = tone === "cursor" ? theme.cyan : tone === "search" ? theme.yellow : theme.surface2

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2} borderLeft={true} borderColor={border} flexShrink={0}>
      {grouped.map((part) => {
        const needSep =
          !focusMode && !sep && hasText && hasTools && (part.type === "tool" || part.type === "tool-group")

        if (focusMode) {
          if (part.type !== "text" || !first || part.id !== first.id) return null
          return <TextPart key={part.id} part={part} lead="◆" />
        }

        if (part.type === "text") {
          if (part.synthetic || part.ignored) return null
          const out = <TextPart key={part.id} part={part} lead={lead ? "◆" : undefined} />
          lead = false
          return out
        }
        if (part.type === "reasoning") return <ReasoningPart key={part.id} part={part} visible={showThinking} />
        if (part.type === "compaction") return <CompactionPart key={part.id} />
        if (part.type === "tool") {
          sep = sep || needSep
          return (
            <React.Fragment key={part.part.id}>
              {needSep && <Box height={1} />}
              <ToolPart part={part.part} />
            </React.Fragment>
          )
        }
        if (part.type === "tool-group") {
          const open = groupOpen(part.parts, collapsed)
          sep = sep || needSep
          return (
            <React.Fragment key={part.parts[0]?.id}>
              {needSep && <Box height={1} />}
              <ToolGroup parts={part.parts} overview={focusMode} open={open} />
            </React.Fragment>
          )
        }
        return null
      })}

      {focusMode && tools && (
        <Box paddingLeft={3} marginTop={1}>
          <Text color={theme.overlay}>{tools}</Text>
        </Box>
      )}

      {!focusMode && msg.error && msg.error.name !== "MessageAbortedError" && (
        <Box
          marginTop={1}
          paddingLeft={1}
          paddingTop={0}
          paddingBottom={0}
          borderStyle="single"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={theme.red}
          flexDirection="column"
        >
          <Text color={theme.red} bold>
            ✗ {msg.error.name}
          </Text>
          {msg.error.data?.message && (
            <Text wrap="wrap" color={theme.subtext}>
              {msg.error.data.message}
            </Text>
          )}
        </Box>
      )}

      {!focusMode && (isLast || done || msg.error?.name === "MessageAbortedError") && (
        <Box paddingLeft={1} marginTop={1} flexDirection="row">
          <Text color={theme.overlay}>{footerLeft}</Text>
          <Box flexGrow={1} />
          {footerRight ? <Text color={theme.overlay}>{footerRight}</Text> : null}
        </Box>
      )}

      {!focusMode && <MessageDiff diffs={diffs} open={diffOpen} onToggle={onToggleDiff} />}
    </Box>
  )
})
