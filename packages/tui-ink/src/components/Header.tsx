import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "@inkjs/ui"
import { theme } from "../theme"

interface HeaderProps {
  projectName: string
  gitBranch: string
  status: "idle" | "generating" | "error"
}

export function Header({ projectName, gitBranch, status }: HeaderProps) {
  const statusColor = status === "generating" ? theme.yellow : status === "error" ? theme.red : theme.green

  return (
    <Box height={1} justifyContent="space-between">
      <Text color={theme.cyan} bold>
        {projectName}
      </Text>
      <Text color={theme.subtext}> {gitBranch}</Text>
      {status === "generating" ? (
        <Spinner label=" generating..." />
      ) : (
        <Text color={statusColor}>{status === "error" ? "error" : "ready"}</Text>
      )}
    </Box>
  )
}
