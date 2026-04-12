import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"

interface Message {
  id: string
  role: "user" | "ai"
  content: string
}

interface ChatPaneProps {
  messages: Message[]
  width: number
  height: number
}

export function ChatPane({ messages, width, height }: ChatPaneProps) {
  const theme = useTheme()
  return (
    <Box flexDirection="column" width={width} height={height} overflowY="hidden">
      {messages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={1}>
          <Text color={msg.role === "user" ? theme.cyan : theme.lavender} bold>
            {msg.role === "user" ? "You" : "AI"}
          </Text>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
      ))}
    </Box>
  )
}
