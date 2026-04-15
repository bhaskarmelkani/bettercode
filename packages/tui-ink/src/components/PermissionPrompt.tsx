import React from "react"
import { Box, Text, useInput } from "ink"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  request: PermissionRequest
  columns: number
}

const permLabels: Record<string, string> = {
  glob: "search files",
  read: "read file",
  write: "write file",
  edit: "edit file",
  patch: "patch file",
  bash: "run command",
  execute: "run command",
  delete: "delete file",
  list: "list directory",
  fetch: "fetch url",
  web: "web request",
  mcp: "mcp tool",
}

function permLabel(permission: string) {
  return permLabels[permission.toLowerCase()] ?? permission
}

function permColor(permission: string, theme: ReturnType<typeof useTheme>) {
  const p = permission.toLowerCase()
  if (p.includes("write") || p.includes("edit") || p.includes("delete")) return theme.red
  if (p.includes("execute") || p.includes("bash") || p.includes("run")) return theme.yellow
  return theme.cyan
}

export function PermissionPrompt({ request, columns }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyPermission)
  const toggleAutoAccept = useAppStore((s) => s.toggleAutoAcceptPermissions)

  useInput((input) => {
    if (input === "y") reply(request.id, "once")
    else if (input === "a") reply(request.id, "always")
    else if (input === "n" || input === "r") reply(request.id, "reject")
    else if (input === "t") {
      toggleAutoAccept()
      reply(request.id, "always")
    }
  })

  const color = permColor(request.permission, theme)

  // Metadata entries — exclude "pattern" since we show request.patterns separately
  const meta = Object.entries(request.metadata ?? {}).filter(
    ([k, v]) => k !== "pattern" && typeof v === "string" && v,
  ) as [string, string][]

  return (
    <Box flexDirection="column" width={columns} paddingX={2} paddingY={1} flexShrink={0}>
      {/* Header: colored permission badge + patterns on the same line */}
      <Box gap={1} marginBottom={request.patterns.length > 0 || meta.length > 0 ? 1 : 0}>
        <Text backgroundColor={color} color={theme.base}>
          {` ${permLabel(request.permission)} `}
        </Text>
        {request.patterns.length > 0 && (
          <Text color={theme.subtext} wrap="truncate-end">
            {request.patterns.join(", ")}
          </Text>
        )}
      </Box>

      {/* Extra metadata (tool name, extra context) */}
      {meta.map(([k, v]) => (
        <Box key={k}>
          <Text color={theme.overlay}>{k}: </Text>
          <Text color={theme.subtext} wrap="truncate-end">
            {v}
          </Text>
        </Box>
      ))}

      {/* Inline action hints */}
      <Box marginTop={1} gap={2}>
        <Text>
          <Text color={theme.text} bold>y</Text>
          <Text color={theme.overlay}> allow once</Text>
        </Text>
        <Text>
          <Text color={theme.text} bold>a</Text>
          <Text color={theme.overlay}> always</Text>
        </Text>
        <Text>
          <Text color={theme.text} bold>n</Text>
          <Text color={theme.overlay}> deny</Text>
        </Text>
        <Text color={theme.surface2}>t auto-accept all</Text>
      </Box>
    </Box>
  )
}
