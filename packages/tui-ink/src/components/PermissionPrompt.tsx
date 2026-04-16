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
      summary: first ? `This will change files in ${list}.` : "This will change one or more files in your workspace.",
      risk: "It can modify code or config. Review the target paths before allowing.",
    }
  }

  if (p === "delete") {
    return {
      summary: first ? `This will remove files from ${list}.` : "This will remove files from your workspace.",
      risk: "This is destructive. Only allow it if you expect those files to be deleted.",
    }
  }

  if (p === "read") {
    return {
      summary: first
        ? `This will read content from ${first}.`
        : "This will read a file or directory from your workspace.",
      risk: "Low risk. It only exposes file contents to the running agent.",
    }
  }

  if (p === "glob" || p === "grep" || p === "list") {
    return {
      summary: query ? `This will search your workspace using ${query}.` : "This will search files in your workspace.",
      risk: "Low risk. It only inspects filenames or file contents.",
    }
  }

  if (p === "bash" || p === "execute") {
    return {
      summary:
        desc || command ? `This will run: ${desc || command}.` : "This will run a shell command in your workspace.",
      risk: "Medium to high risk. Commands can edit files, install packages, or access the network.",
    }
  }

  if (p === "external_directory") {
    return {
      summary: first
        ? `This will access files outside the current project: ${first}.`
        : "This will access files outside the current project.",
      risk: "Higher risk. It expands the agent's access beyond the current workspace.",
    }
  }

  if (p === "webfetch" || p === "fetch" || p === "web" || p === "websearch" || p === "codesearch") {
    return {
      summary: url
        ? `This will fetch or search remote content for ${url}.`
        : "This will access content outside the local workspace.",
      risk: "Low to medium risk. It may send queries to external services and import remote content into context.",
    }
  }

  if (p === "task") {
    return {
      summary: agent ? `This will launch a ${agent} subagent.` : "This will launch a subagent to continue work.",
      risk: "The subagent can perform multiple follow-up actions within its allowed permissions.",
    }
  }

  const raw = request.permission.trim()
  const prose = /\s/.test(raw)
  return {
    summary: prose ? raw : `This will allow the ${request.permission} capability for the current action.`,
    risk: prose
      ? "Review the request details and target paths before approving."
      : "Review the request details before approving.",
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

  // Metadata entries — exclude "pattern" since we show request.patterns separately
  const meta = Object.entries(request.metadata ?? {}).filter(
    ([k, v]) => k !== "pattern" && typeof v === "string" && v,
  ) as [string, string][]

  return (
    <Box flexDirection="column" width={columns} paddingX={1} flexShrink={0}>
      <Box flexDirection="column" borderStyle="single" borderColor={color} paddingX={1}>
        {/* Title */}
        <Box gap={1}>
          <Text color={color} bold>
            {"⚠ Permission"}
          </Text>
          <Text backgroundColor={color} color={theme.base}>
            {` ${permLabel(request.permission)} `}
          </Text>
        </Box>

        {/* Patterns */}
        {request.patterns.length > 0 && (
          <Box marginTop={1}>
            <Text color={theme.text} wrap="truncate-end">
              {request.patterns.join("\n")}
            </Text>
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text} wrap="wrap">
            {info.summary}
          </Text>
          <Text color={theme.subtext} wrap="wrap">
            {info.risk}
          </Text>
        </Box>

        {/* Extra metadata */}
        {meta.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {meta.map(([k, v]) => (
              <Box key={k}>
                <Text color={theme.overlay}>{k}: </Text>
                <Text color={theme.subtext} wrap="truncate-end">
                  {v}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Actions */}
        <Box marginTop={1} gap={2}>
          <Text>
            <Text backgroundColor={theme.green} color={theme.base} bold>
              {" y "}
            </Text>
            <Text color={theme.overlay}> allow</Text>
          </Text>
          <Text>
            <Text backgroundColor={theme.cyan} color={theme.base} bold>
              {" a "}
            </Text>
            <Text color={theme.overlay}> always</Text>
          </Text>
          <Text>
            <Text backgroundColor={theme.red} color={theme.base} bold>
              {" n "}
            </Text>
            <Text color={theme.overlay}> deny</Text>
          </Text>
          <Text>
            <Text color={theme.surface2} dimColor>
              t auto-accept
            </Text>
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
