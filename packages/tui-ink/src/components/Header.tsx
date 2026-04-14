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
  const bg = theme.mantle

  return (
    <Box height={1} justifyContent="space-between">
      <Text color={theme.cyan} bold backgroundColor={bg}>
        {projectName}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        ─{" "}
      </Text>
      <Text color={theme.subtext} backgroundColor={bg}>
        {gitBranch}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        ─{" "}
      </Text>
      <Text color={theme.subtext} backgroundColor={bg}>
        {count}
      </Text>
      {status === "generating" ? (
        <Spinner label=" generating..." />
      ) : (
        <Text color={statusColor} backgroundColor={bg}>
          {" "}
          ● {status === "error" ? "error" : "ready"}
        </Text>
      )}
    </Box>
  )
}
