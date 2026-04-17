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

function detail(request: PermissionRequest) {
  const meta = request.metadata ?? {}
  const p = request.permission.toLowerCase()
  const path = request.patterns
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, 2)
  const first = path[0]
  const list = path.join(", ")
  const command = typeof meta.command === "string" ? meta.command : ""
  const desc = typeof meta.description === "string" ? meta.description : ""
  const url = typeof meta.url === "string" ? meta.url : first
  const query = typeof meta.pattern === "string" ? meta.pattern : first
  const agent = typeof meta.subagent_type === "string" ? meta.subagent_type : first

  if (p === "edit" || p === "write" || p === "patch") {
    return {
      summary: first ? `Change files in ${list}.` : "Change one or more files.",
      risk: "can modify code or config",
    }
  }
  if (p === "delete") {
    return {
      summary: first ? `Remove files from ${list}.` : "Remove files from workspace.",
      risk: "destructive — only allow if expected",
    }
  }
  if (p === "read") {
    return {
      summary: first ? `Read ${first}.` : "Read a file from workspace.",
      risk: "low risk",
    }
  }
  if (p === "glob" || p === "grep" || p === "list") {
    return {
      summary: query ? `Search workspace using ${query}.` : "Search files in workspace.",
      risk: "low risk",
    }
  }
  if (p === "bash" || p === "execute") {
    return {
      summary: desc || command ? `Run: ${desc || command}.` : "Run a shell command.",
      risk: "medium to high risk",
    }
  }
  if (p === "external_directory") {
    return {
      summary: first ? `Access files outside project: ${first}.` : "Access files outside project.",
      risk: "higher risk — expands workspace access",
    }
  }
  if (p === "webfetch" || p === "fetch" || p === "web" || p === "websearch" || p === "codesearch") {
    return {
      summary: url ? `Fetch or search: ${url}.` : "Access content outside workspace.",
      risk: "low to medium risk",
    }
  }
  if (p === "task") {
    return {
      summary: agent ? `Launch a ${agent} subagent.` : "Launch a subagent.",
      risk: "subagent can perform follow-up actions",
    }
  }

  const raw = request.permission.trim()
  const prose = /\s/.test(raw)
  return {
    summary: prose ? raw : `Allow ${request.permission}.`,
    risk: "review before approving",
  }
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
  const info = detail(request)

  const patterns = request.patterns
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, 2)

  // Extra metadata entries (exclude "pattern" since patterns are shown separately)
  const meta = Object.entries(request.metadata ?? {}).filter(
    ([k, v]) => k !== "pattern" && typeof v === "string" && v,
  ) as [string, string][]

  return (
    <Box flexDirection="column" width={columns} flexShrink={0}>
      <Box flexDirection="column" borderStyle="single" borderColor={color} paddingX={1}>
        {/* Title row */}
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text color={color} bold>⚠</Text>
          <Text backgroundColor={color} color={theme.base}>{` ${permLabel(request.permission)} `}</Text>
          <Text color={theme.overlay} dimColor>{info.risk}</Text>
        </Box>

        {/* Pattern + summary on one line if patterns are short, otherwise separate */}
        {patterns.length > 0 ? (
          <Text color={theme.text} wrap="truncate-end">
            {`${patterns.join(" · ")} — ${info.summary}`}
          </Text>
        ) : (
          <Text color={theme.subtext} wrap="truncate-end">{info.summary}</Text>
        )}

        {/* Extra metadata (path, command, etc.) */}
        {meta.map(([k, v]) => (
          <Box key={k} flexDirection="row">
            <Text color={theme.overlay}>{k}: </Text>
            <Text color={theme.subtext} wrap="truncate-end">{v}</Text>
          </Box>
        ))}

        {/* Actions — compact inline row */}
        <Box flexDirection="row" gap={2}>
          <Text>
            <Text backgroundColor={theme.green} color={theme.base} bold>{" y "}</Text>
            <Text color={theme.overlay}> allow</Text>
          </Text>
          <Text>
            <Text backgroundColor={theme.cyan} color={theme.base} bold>{" a "}</Text>
            <Text color={theme.overlay}> always</Text>
          </Text>
          <Text>
            <Text backgroundColor={theme.red} color={theme.base} bold>{" n "}</Text>
            <Text color={theme.overlay}> deny</Text>
          </Text>
          <Text color={theme.surface2} dimColor>t auto-accept</Text>
        </Box>
      </Box>
    </Box>
  )
}
