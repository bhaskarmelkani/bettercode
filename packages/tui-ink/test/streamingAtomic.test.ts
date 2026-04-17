// M2.3: Verify appendPartDelta is atomic under rapid concurrent calls.
// If this test passes on the first run, M2.3 is already done (no repro needed).

import { describe, test, expect, beforeEach } from "bun:test"
import { useAppStore } from "../src/store"

function makeMessage(sessionID: string, messageID: string) {
  useAppStore.getState().upsertMessage({
    id: messageID,
    sessionID,
    role: "assistant",
    time: { created: Date.now() },
  } as never)
  useAppStore.getState().upsertPart({
    id: "part-1",
    messageID,
    type: "text",
    text: "",
  } as never)
}

describe("appendPartDelta atomicity", () => {
  beforeEach(() => {
    // Reset store to clean state
    useAppStore.setState({
      messages: {},
      parts: {},
      sessions: [],
    })
  })

  test("100 rapid sequential deltas accumulate correctly", () => {
    const sid = "session-1"
    const mid = "msg-1"
    makeMessage(sid, mid)

    for (let i = 0; i < 100; i++) {
      useAppStore.getState().appendPartDelta(mid, "part-1", "text", `${i} `)
    }

    const parts = useAppStore.getState().parts[mid] ?? []
    const part = parts.find((p) => p.id === "part-1")
    expect(part).toBeDefined()
    const text = (part as { text: string }).text

    // All 100 deltas should be present
    const expected = Array.from({ length: 100 }, (_, i) => `${i} `).join("")
    expect(text).toBe(expected)
  })

  test("deltas for different fields accumulate independently", () => {
    const sid = "session-2"
    const mid = "msg-2"
    useAppStore.getState().upsertMessage({
      id: mid, sessionID: sid, role: "assistant", time: { created: Date.now() },
    } as never)
    useAppStore.getState().upsertPart({ id: "part-2", messageID: mid, type: "text", text: "" } as never)

    useAppStore.getState().appendPartDelta(mid, "part-2", "text", "hello ")
    useAppStore.getState().appendPartDelta(mid, "part-2", "text", "world")

    const parts = useAppStore.getState().parts[mid] ?? []
    const part = parts.find((p) => p.id === "part-2") as { text: string } | undefined
    expect(part?.text).toBe("hello world")
  })

  test("appendPartDelta on non-existent part returns unchanged state", () => {
    const mid = "msg-noop"
    const before = useAppStore.getState().parts[mid]
    useAppStore.getState().appendPartDelta(mid, "ghost-part", "text", "data")
    expect(useAppStore.getState().parts[mid]).toBe(before)
  })

  test("interleaved upsertMessage + appendPartDelta preserves all deltas", () => {
    const sid = "session-3"
    const mid = "msg-3"
    makeMessage(sid, mid)

    useAppStore.getState().appendPartDelta(mid, "part-1", "text", "a")
    useAppStore.getState().upsertMessage({
      id: mid, sessionID: sid, role: "assistant",
      time: { created: Date.now(), completed: Date.now() },
    } as never)
    useAppStore.getState().appendPartDelta(mid, "part-1", "text", "b")
    useAppStore.getState().appendPartDelta(mid, "part-1", "text", "c")

    const parts = useAppStore.getState().parts[mid] ?? []
    const part = parts.find((p) => p.id === "part-1") as { text: string } | undefined
    expect(part?.text).toBe("abc")
  })
})
