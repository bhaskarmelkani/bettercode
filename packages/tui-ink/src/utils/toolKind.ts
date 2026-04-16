import type { Theme } from "../theme"

export function toolLabel(tool: string) {
  const t = tool.toLowerCase()
  if (t.includes("read") || t.includes("glob") || t.includes("grep") || t.includes("search")) return "read" as const
  if (t.includes("write") || t.includes("edit") || t.includes("patch")) return "write" as const
  if (t.includes("bash") || t.includes("shell") || t.includes("execute")) return "exec" as const
  return "mcp" as const
}

export function toolKind(tool: string, theme: Theme) {
  const label = toolLabel(tool)
  if (label === "read") return { icon: "◇", color: theme.cyan, label } as const
  if (label === "write") return { icon: "✎", color: theme.yellow, label } as const
  if (label === "exec") return { icon: "$", color: theme.green, label } as const
  return { icon: "⬡", color: theme.pink, label } as const
}

export function isWriteTool(tool: string) {
  return toolLabel(tool) === "write"
}
