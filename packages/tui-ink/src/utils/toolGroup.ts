import type { Part, ToolPart as ToolPartSDK } from "@opencode-ai/sdk/v2"
import { toolLabel } from "./toolKind"

export type GroupedPart =
  | Exclude<Part, { type: "tool" }>
  | { type: "tool"; part: ToolPartSDK }
  | { type: "tool-group"; parts: ToolPartSDK[] }

export function groupParts(parts: Part[]) {
  const out: GroupedPart[] = []
  let i = 0

  while (i < parts.length) {
    const part = parts[i]
    if (!part) break
    if (part.type !== "tool") {
      out.push(part)
      i++
      continue
    }
    if (!("state" in part) || !part.state || typeof part.state !== "object" || !("status" in part.state)) {
      out.push({ type: "tool", part: part as ToolPartSDK })
      i++
      continue
    }
    if (part.state.status !== "completed") {
      out.push({ type: "tool", part })
      i++
      continue
    }

    const label = toolLabel(part.tool)
    const run: ToolPartSDK[] = [part]
    i++
    while (i < parts.length) {
      const next = parts[i]
      if (!next || next.type !== "tool") break
      if (!("state" in next) || !next.state || typeof next.state !== "object" || !("status" in next.state)) break
      if (next.state.status !== "completed") break
      if (toolLabel(next.tool) !== label) break
      run.push(next)
      i++
    }

    // Write tools are never grouped — MessageDiff at the bottom already provides
    // the "edits N files" aggregate view. Grouping writes would duplicate it.
    if (label === "write") {
      for (const p of run) out.push({ type: "tool", part: p })
    } else if (run.length === 1) {
      out.push({ type: "tool", part: run[0]! })
    } else {
      out.push({ type: "tool-group", parts: run })
    }
  }

  return out
}

export function groupOpen(parts: ToolPartSDK[], collapsed: Record<string, boolean>) {
  return parts.some((part) => collapsed[part.id] === false)
}

export function groupState(parts: ToolPartSDK[]) {
  if (parts.some((part) => part.state.status === "error")) return "error" as const
  if (parts.some((part) => part.state.status === "running" || part.state.status === "pending"))
    return "running" as const
  return "completed" as const
}

export function groupTitle(parts: ToolPartSDK[]) {
  const label = toolLabel(parts[0]?.tool ?? "")
  const n = parts.length
  if (label === "read") return `Read ${n} files`
  if (label === "write") return `Edited ${n} files`
  if (label === "exec") return `Ran ${n} commands`
  return `MCP ${n} calls`
}

export function groupIcon(parts: ToolPartSDK[]) {
  const label = toolLabel(parts[0]?.tool ?? "")
  if (label === "read") return "◇"
  if (label === "write") return "✎"
  if (label === "exec") return "$"
  return "⬡"
}
