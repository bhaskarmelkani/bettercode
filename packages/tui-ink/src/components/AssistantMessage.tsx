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
  if (message.role !== "assistant") return null
  const msg = message as AssistantMsg
  const lastText = parts.reduce(
    (out, part, i) => (part.type === "text" && !part.synthetic && !part.ignored ? i : out),
    -1,
  )

  const done = msg.finish && !["tool-calls", "unknown"].includes(msg.finish)
  let lead = true
  const doneAt = msg.time?.completed
  const footer = [
    msg.mode ?? "chat",
    msg.modelID,
    doneAt ? dur(msg.time?.created, doneAt) : "",
    doneAt ? `${tok(msg.tokens.input, msg.tokens.output)} tokens` : "",
    msg.error?.name === "MessageAbortedError" ? "interrupted" : "",
  ].filter((v): v is string => !!v)
  const border = tone === "cursor" ? theme.cyan : tone === "search" ? theme.yellow : theme.surface2

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      paddingLeft={2}
      borderLeft={true}
      borderColor={border}
      flexShrink={0}
    >
      {parts.map((part, idx) => {
        if (part.type === "text") {
          if (part.synthetic || part.ignored) return null
          if (focusMode && idx !== lastText) return null
          const out = <TextPart key={part.id} part={part} lead={lead ? "◆" : undefined} />
          lead = false
          return out
        }
        if (focusMode && (part.type === "reasoning" || part.type === "compaction")) return null
        if (part.type === "reasoning") return <ReasoningPart key={part.id} part={part} visible={showThinking} />
        if (part.type === "tool") return <ToolPart key={part.id} part={part} />
        if (part.type === "compaction") return <CompactionPart key={part.id} />
        return null
      })}

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
        <Box paddingLeft={1} marginTop={1}>
          <Text color={theme.overlay}>{footer.join(" · ")}</Text>
        </Box>
      )}

      {!focusMode && <MessageDiff diffs={diffs} open={diffOpen} onToggle={onToggleDiff} />}
    </Box>
  )
})
