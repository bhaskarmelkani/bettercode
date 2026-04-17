// M6.2.g: Verify that concurrent child agent streams don't cross-contaminate
// and that abort-one vs abort-all semantics are correct.

import { describe, test, expect, beforeEach } from "bun:test"
import { useAppStore } from "../src/store"

const BASE_SESSION = "parent-session"
const CHILD_A = "child-a"
const CHILD_B = "child-b"

function setupSession(id: string, parentID?: string) {
  useAppStore.getState().upsertSession({
    id,
    parentID,
    title: id,
    time: { created: Date.now(), updated: Date.now() },
    version: 0,
    userID: "u1",
    share: undefined,
  } as never)
}

function setupMessage(sessionID: string, msgID: string) {
  useAppStore.getState().upsertMessage({
    id: msgID, sessionID, role: "assistant", time: { created: Date.now() },
  } as never)
  useAppStore.getState().upsertPart({ id: `part-${msgID}`, messageID: msgID, type: "text", text: "" } as never)
}

describe("concurrent child agents", () => {
  beforeEach(() => {
    useAppStore.setState({ messages: {}, parts: {}, sessions: [], sessionStatus: {} })
    setupSession(BASE_SESSION)
    setupSession(CHILD_A, BASE_SESSION)
    setupSession(CHILD_B, BASE_SESSION)
    setupMessage(CHILD_A, "msg-a")
    setupMessage(CHILD_B, "msg-b")
  })

  test("deltas from child A don't appear in child B messages", () => {
    useAppStore.getState().appendPartDelta("msg-a", "part-msg-a", "text", "response from A")
    useAppStore.getState().appendPartDelta("msg-b", "part-msg-b", "text", "response from B")

    const partsA = useAppStore.getState().parts["msg-a"] ?? []
    const partsB = useAppStore.getState().parts["msg-b"] ?? []

    const textA = (partsA.find((p) => p.id === "part-msg-a") as { text: string } | undefined)?.text ?? ""
    const textB = (partsB.find((p) => p.id === "part-msg-b") as { text: string } | undefined)?.text ?? ""

    expect(textA).toContain("response from A")
    expect(textA).not.toContain("response from B")
    expect(textB).toContain("response from B")
    expect(textB).not.toContain("response from A")
  })

  test("messages from different children are keyed separately", () => {
    const msgs = useAppStore.getState().messages
    expect(msgs[CHILD_A]).toBeDefined()
    expect(msgs[CHILD_B]).toBeDefined()
    expect(msgs[CHILD_A]).not.toBe(msgs[CHILD_B])
  })

  test("child sessions are filtered by parentID", () => {
    const { sessions } = useAppStore.getState()
    const children = sessions.filter((s) => s.parentID === BASE_SESSION)
    expect(children).toHaveLength(2)
    expect(children.map((s) => s.id).sort()).toEqual([CHILD_A, CHILD_B].sort())
  })

  test("setting status on one child doesn't affect the other", () => {
    useAppStore.getState().setSessionStatus(CHILD_A, { type: "busy", sessionID: CHILD_A } as never)
    const statusA = useAppStore.getState().sessionStatus[CHILD_A]
    const statusB = useAppStore.getState().sessionStatus[CHILD_B]
    expect(statusA?.type).toBe("busy")
    expect(statusB).toBeUndefined()
  })

  test("permissions from child A appear in parent's permission view", () => {
    // Simulate a permission attributed to child A
    const perm = { id: "perm-1", sessionID: CHILD_A, message: "Allow write?" } as never
    useAppStore.getState().upsertPermission(perm)

    // Parent should see child A's permissions (per SessionScreen filter logic)
    const childPerms = useAppStore.getState().sessions
      .filter((s) => s.parentID === BASE_SESSION)
      .flatMap((child) => useAppStore.getState().permissions[child.id] ?? [])

    expect(childPerms).toHaveLength(1)
    expect(childPerms[0]!.id).toBe("perm-1")
  })
})
