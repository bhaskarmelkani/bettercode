import React from "react"
import { Box, Text, useInput } from "ink"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  request: PermissionRequest
}

export function PermissionPrompt({ request }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyPermission)

  useInput((input) => {
    if (input === "y") reply(request.id, "once")
    else if (input === "a") reply(request.id, "always")
    else if (input === "n" || input === "r") reply(request.id, "reject")
  })

  const patterns = request.patterns.join(", ")

  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
      borderStyle="single"
      borderLeft={true}
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      borderColor={theme.yellow}
      marginBottom={1}
      flexShrink={0}
    >
      <Text color={theme.yellow} bold>
        Permission required
      </Text>
      <Text color={theme.text}>{request.permission}</Text>
      {patterns && <Text color={theme.subtext}>{patterns}</Text>}
      <Box marginTop={1} gap={2}>
        <Text color={theme.green}>
          <Text bold>y</Text> allow once
        </Text>
        <Text color={theme.cyan}>
          <Text bold>a</Text> always allow
        </Text>
        <Text color={theme.red}>
          <Text bold>n</Text> reject
        </Text>
      </Box>
    </Box>
  )
}
