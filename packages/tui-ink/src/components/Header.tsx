import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "./Spinner"
import { useTheme } from "../theme-context"

interface HeaderProps {
  projectName: string
  gitBranch: string
  sessionCount: number
  status: "idle" | "generating" | "error"
  width: number
  hint?: string
}

function cut(text: string, max: number) {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

export function Header({ projectName, gitBranch, sessionCount, status, width, hint }: HeaderProps) {
  const theme = useTheme()
  const statusColor = status === "generating" ? theme.yellow : status === "error" ? theme.red : theme.green
  const project = cut(projectName, 24)
  const branch = cut(gitBranch, 24)
  const count = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`
  const spinnerLabel = status === "generating" ? ` ${hint ?? "generating"}` : undefined
  const right = status === "generating" ? (hint ?? "generating") : status === "error" ? "error" : "ready"
  const leftLen = project.length + branch.length + count.length + 6
  const fill = Math.max(0, width - leftLen - right.length - (status === "generating" ? 1 : 0))

  return (
    <Box height={1} flexDirection="row">
      <Text color={theme.cyan} bold>
        {project}
      </Text>
      <Text color={theme.overlay}> ─ </Text>
      <Text color={theme.subtext}>{branch}</Text>
      <Text color={theme.overlay}> ─ </Text>
      <Text color={theme.subtext}>{count}</Text>
      {fill > 0 ? <Text>{" ".repeat(fill)}</Text> : null}
      {status === "generating" ? <Spinner label={spinnerLabel} /> : <Text color={statusColor}>{right}</Text>}
    </Box>
  )
}
