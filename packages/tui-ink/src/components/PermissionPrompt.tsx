import React from "react"
import { Box, Text, useInput } from "ink"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  request: PermissionRequest
  columns: number
}

export function PermissionPrompt({ request, columns }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyPermission)

  useInput((input) => {
    if (input === "y") reply(request.id, "once")
    else if (input === "a") reply(request.id, "always")
    else if (input === "n" || input === "r") reply(request.id, "reject")
  })

  const patterns = request.patterns.join(", ")

  return (
    <Box flexDirection="column" width={columns} paddingX={2} paddingY={1} flexShrink={0}>
      <Box marginBottom={1}>
        <Text backgroundColor={theme.yellow} color={theme.base}>
          {" permission "}
        </Text>
        <Text color={theme.overlay}> answer below</Text>
      </Box>
      <Text color={theme.text} wrap="wrap">
        {request.permission}
      </Text>
      {patterns && (
        <Box marginTop={1}>
          <Text color={theme.subtext} wrap="wrap">
            {patterns}
          </Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text backgroundColor={theme.mantle} color={theme.subtext}>
          {" y  allow once".padEnd(Math.max(0, columns), " ")}
        </Text>
        <Text backgroundColor={theme.mantle} color={theme.subtext}>
          {" a  always allow".padEnd(Math.max(0, columns), " ")}
        </Text>
        <Text backgroundColor={theme.mantle} color={theme.subtext}>
          {" n  reject".padEnd(Math.max(0, columns), " ")}
        </Text>
      </Box>
    </Box>
  )
}
