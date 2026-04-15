import type { Message, Part, TextPart as TextPartType, FilePart as FilePartType } from "@opencode-ai/sdk/v2"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function textPart(part: Part): part is TextPartType {
  return part.type === "text" && !part.synthetic && !part.ignored
}

function userPart(part: Part): part is TextPartType {
  return part.type === "text" && !part.synthetic
}

function filePart(part: Part): part is FilePartType {
  return part.type === "file"
}

function join(list: string[]) {
  return list.map((item) => item.trim()).filter(Boolean).join("\n\n").trim()
}

function toolText(part: Part) {
  if (part.type !== "tool") return ""
  const head = "title" in part.state && typeof part.state.title === "string" && part.state.title ? part.state.title : part.tool
  if (part.state.status === "error") return join([head, part.state.error])
  if (part.state.status === "completed") return join([head, part.state.output])
  return head
}

export function cursorUp(total: number, idx: number | null) {
  if (total === 0) return null
  if (idx === null) return total - 1
  return clamp(idx - 1, 0, total - 1)
}

export function cursorDown(total: number, idx: number | null) {
  if (total === 0) return null
  if (idx === null) return 0
  return clamp(idx + 1, 0, total - 1)
}

export function cursorOffset(idx: number, top: number[], bot: number[], total: number, height: number, offset: number) {
  const max = Math.max(0, total - height)
  const view = clamp(total - height - offset, 0, max)
  const start = top[idx] ?? 0
  const end = bot[idx] ?? start
  if (start < view) return clamp(total - height - start, 0, max)
  if (end > view + height) return clamp(total - end, 0, max)
  return clamp(offset, 0, max)
}

export function messageText(msg: Message, parts: Part[], showThinking: boolean) {
  if (msg.role === "user") {
    const text = join(parts.filter(userPart).map((part) => part.text))
    const files = parts.filter(filePart).map((part) => part.filename ?? "").filter(Boolean).join("\n")
    return join([text, files])
  }

  const text = join(parts.filter(textPart).map((part) => part.text))
  const thinking = showThinking
    ? join(
        parts
          .filter((part): part is Extract<Part, { type: "reasoning" }> => part.type === "reasoning")
          .map((part) => part.text.replace("[REDACTED]", "").trim()),
      )
    : ""
  const tools = join(parts.filter((part) => part.type === "tool").map(toolText))
  return join([text, thinking, tools])
}

export function editText(msg: Message, parts: Part[]) {
  if (msg.role !== "user") return ""
  return join(parts.filter(userPart).map((part) => part.text))
}
