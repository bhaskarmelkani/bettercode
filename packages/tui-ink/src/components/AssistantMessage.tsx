import React from "react"
import { Box, Text } from "ink"
import type { Message, Part } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { TextPart } from "./parts/TextPart"
import { ReasoningPart } from "./parts/ReasoningPart"
import { ToolPart } from "./parts/ToolPart"
import { CompactionPart } from "./parts/CompactionPart"

interface Props {
  message: Message
  parts: Part[]
  showThinking: boolean
  isLast: boolean
}

export function AssistantMessage({ message, parts, showThinking, isLast }: Props) {
  const theme = useTheme()
  const msg = message as Message & {
    providerID?: string
    modelID?: string
    finish?: string
    error?: { name: string; data: { message: string } }
    mode?: string
    time?: { created: number; completed?: number }
  }

  const done = msg.finish && !["tool-calls", "unknown"].includes(msg.finish)

  return (
    <Box flexDirection="column" marginTop={1} flexShrink={0}>
      {parts.map((part) => {
        if (part.type === "text") {
          const p = part as {
            type: "text"
            text: string
            synthetic?: boolean
            ignored?: boolean
            id: string
            sessionID: string
            messageID: string
          }
          if (p.synthetic || p.ignored) return null
          return <TextPart key={part.id} part={p as any} />
        }
        if (part.type === "reasoning") return <ReasoningPart key={part.id} part={part as any} visible={showThinking} />
        if (part.type === "tool") return <ToolPart key={part.id} part={part as any} />
        if (part.type === "compaction") return <CompactionPart key={part.id} />
        return null
      })}

      {msg.error && msg.error.name !== "MessageAbortedError" && (
        <Box
          marginTop={1}
          paddingLeft={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={theme.red}
        >
          <Text wrap="wrap" color={theme.subtext}>
            {msg.error.data.message}
          </Text>
        </Box>
      )}

      {(isLast || done || msg.error?.name === "MessageAbortedError") && (
        <Box paddingLeft={3} marginTop={1}>
          <Text>
            <Text color={theme.lavender}>▣ </Text>
            <Text color={theme.text}>{msg.mode ?? "chat"}</Text>
            {msg.modelID && <Text color={theme.overlay}> · {msg.modelID}</Text>}
            {msg.error?.name === "MessageAbortedError" && <Text color={theme.overlay}> · interrupted</Text>}
          </Text>
        </Box>
      )}
    </Box>
  )
}
