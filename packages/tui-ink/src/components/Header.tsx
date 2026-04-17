import React, { useEffect, useState } from "react"
import { Box, Text } from "ink"
import type { Part, ToolPart as ToolPartType } from "@opencode-ai/sdk/v2"
import { useShallow } from "zustand/shallow"
import { Spinner } from "./Spinner"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface HeaderProps {
  projectName: string
  gitBranch: string
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

export function Header({ projectName, gitBranch, status, width, hint }: HeaderProps) {
  const theme = useTheme()
  const statusColor = status === "generating" ? theme.yellow : status === "error" ? theme.red : theme.green
  const project = cut(projectName, 24)
  const branch = cut(gitBranch, 24)
  const spinnerLabel = status === "generating" ? ` ${hint ?? "generating"}` : undefined
  const live = useAppStore(
    useShallow((s) => {
      const sid = s.currentSessionID
      const msg = sid ? s.messages[sid] ?? [] : []
      const last = msg.findLast((item) => item.role === "assistant")
      const parts = last ? s.parts[last.id] ?? [] : []
      return {
        sig: stamp(last?.id, parts),
        thinking: !parts.some(isRunning),
      }
    }),
  )
  const [pulse, setPulse] = useState<number>()
  const [since, setSince] = useState<number | null>(null)

  useEffect(() => {
    if (status !== "generating") {
      setPulse(undefined)
      return
    }
    setPulse(Date.now())
  }, [status, live.sig])

  useEffect(() => {
    if (status !== "generating") {
      setSince(null)
      return
    }
    if (!live.thinking) {
      setSince(null)
      return
    }
    setSince((prev) => prev ?? Date.now())
  }, [status, live.thinking])

  return (
    <Box height={1} width={width} flexDirection="row">
      <Text color={theme.cyan} bold>
        {project}
      </Text>
      <Text color={theme.overlay}> ─ </Text>
      <Text color={theme.cyan}>⎇ </Text>
      <Text color={theme.subtext}>{branch}</Text>
      <Box flexGrow={1} />
      {status === "generating" ? (
        <Spinner label={spinnerLabel} pulse={pulse} thinkingSince={since} />
      ) : (
        <Text color={statusColor}>{status === "error" ? "error" : "ready"}</Text>
      )}
    </Box>
  )
}

function isRunning(part: Part): part is ToolPartType {
  return part.type === "tool" && part.state.status === "running"
}

function stamp(id: string | undefined, parts: Part[]) {
  if (!id) return ""
  return `${id}:${parts
    .map((part) => {
      if (part.type === "text") return `t:${part.text.length}`
      if (part.type === "reasoning") return `r:${part.text.length}`
      if (part.type === "tool") return `o:${part.state.status}:${toolTitle(part)}:${toolTime(part)}`
      return part.type
    })
    .join("|")}`
}

function toolTitle(part: ToolPartType) {
  return "title" in part.state && part.state.title ? part.state.title : ""
}

function toolTime(part: ToolPartType) {
  if (!("time" in part.state) || !part.state.time) return ""
  const time = part.state.time
  return `${time.start ?? ""}:${"end" in time ? (time.end ?? "") : ""}`
}
