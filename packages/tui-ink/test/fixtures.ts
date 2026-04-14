/**
 * Reusable test fixtures for long-session transcript tests.
 *
 * All helpers return plain objects that satisfy the minimum shape expected
 * by estimateHeight, visibleSlice, and height cache tests.
 */
import type { Message, Part, TextPart as TextPartType } from "@opencode-ai/sdk/v2"

const SID = "fixture-session"

export function makeMsg(id: string, role: "user" | "assistant", sid = SID): Message {
  return { id, role, sessionID: sid } as Message
}

export function makeTextPart(id: string, msgID: string, txt: string, sid = SID): Part {
  return { id, messageID: msgID, type: "text", text: txt, sessionID: sid } as unknown as Part
}

export function makeToolPart(id: string, msgID: string, sid = SID): Part {
  return {
    id,
    messageID: msgID,
    sessionID: sid,
    type: "tool",
    tool: "Bash",
    state: { status: "completed", input: { command: "ls" }, title: "ls", output: "file.ts" },
  } as unknown as Part
}

/**
 * Build a mixed transcript of n messages (alternating user / assistant).
 * Every third assistant message also gets a tool part.
 * Returns { msgs, parts } ready for estimateHeight / visibleSlice / cache tests.
 */
export function makeTranscript(n: number, sid = SID): { msgs: Message[]; parts: Record<string, Part[]> } {
  const msgs: Message[] = []
  const parts: Record<string, Part[]> = {}
  for (let i = 0; i < n; i++) {
    const id = `msg-${i}`
    const role: "user" | "assistant" = i % 2 === 0 ? "user" : "assistant"
    const msg = makeMsg(id, role, sid)
    msgs.push(msg)
    const txt = makeTextPart(`p-${i}`, id, `Message ${i}: ${"x".repeat((i % 5) * 20 + 10)}`, sid)
    if (role === "assistant" && i % 3 === 1) {
      const tool = makeToolPart(`t-${i}`, id, sid)
      parts[id] = [txt, tool]
    } else {
      parts[id] = [txt]
    }
  }
  return { msgs, parts }
}
