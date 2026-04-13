import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "./Spinner"
import { useTheme } from "../theme-context"

interface HeaderProps {
  projectName: string
  gitBranch: string
  sessionCount: number
  status: "idle" | "generating" | "error"
}

export function Header({ projectName, gitBranch, sessionCount, status }: HeaderProps) {
  const theme = useTheme()
  const statusColor = status === "generating" ? theme.yellow : status === "error" ? theme.red : theme.green
  const count = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`

  return (
    <Box height={1} justifyContent="space-between">
      <Text color={theme.cyan} bold>
        {projectName}
      </Text>
      <Text color={theme.overlay}> ─ </Text>
      <Text color={theme.subtext}>{gitBranch}</Text>
      <Text color={theme.overlay}> ─ </Text>
      <Text color={theme.subtext}>{count}</Text>
      {status === "generating" ? (
        <Spinner label=" generating..." />
      ) : (
        <Text color={statusColor}>
          ● {status === "error" ? "error" : "ready"}
        </Text>
      )}
    </Box>
  )
}
