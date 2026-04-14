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
}

function cut(text: string, max: number) {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

export function Header({ projectName, gitBranch, sessionCount, status, width }: HeaderProps) {
  const theme = useTheme()
  const statusColor = status === "generating" ? theme.yellow : status === "error" ? theme.red : theme.green
  const project = cut(projectName, 24)
  const branch = cut(gitBranch, 24)
  const count = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`
  const bg = theme.mantle
  const right = status === "generating" ? "generating" : status === "error" ? "error" : "ready"
  const leftLen = project.length + branch.length + count.length + 6
  const fill = Math.max(0, width - leftLen - right.length - (status === "generating" ? 1 : 0))

  return (
    <Box height={1} flexDirection="row">
      <Text color={theme.cyan} bold backgroundColor={bg}>
        {project}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        ─{" "}
      </Text>
      <Text color={theme.subtext} backgroundColor={bg}>
        {branch}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        ─{" "}
      </Text>
      <Text color={theme.subtext} backgroundColor={bg}>
        {count}
      </Text>
      {fill > 0 ? <Text backgroundColor={bg}>{" ".repeat(fill)}</Text> : null}
      {status === "generating" ? (
        <Spinner label=" generating" backgroundColor={bg} />
      ) : (
        <Text color={statusColor} backgroundColor={bg}>
          {right}
        </Text>
      )}
    </Box>
  )
}
