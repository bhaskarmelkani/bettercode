import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk/v2"
import { cursorDown, cursorOffset, cursorUp, editText, messageText } from "../src/components/MessageActions"
import { makeMsg, makeTextPart, makeToolPart } from "./fixtures"

describe("message actions", () => {
  test("shift+up starts from the latest message and clamps at the top", () => {
    expect(cursorUp(0, null)).toBeNull()
    expect(cursorUp(4, null)).toBe(3)
    expect(cursorUp(4, 2)).toBe(1)
    expect(cursorUp(4, 0)).toBe(0)
  })

  test("shift+down starts from the first message and clamps at the bottom", () => {
    expect(cursorDown(0, null)).toBeNull()
    expect(cursorDown(4, null)).toBe(0)
    expect(cursorDown(4, 1)).toBe(2)
    expect(cursorDown(4, 3)).toBe(3)
  })

  test("cursorOffset keeps visible messages stable and scrolls hidden ones into view", () => {
    const top = [0, 8, 16]
    const bot = [8, 16, 24]

    expect(cursorOffset(2, top, bot, 24, 10, 0)).toBe(0)
    expect(cursorOffset(0, top, bot, 24, 10, 0)).toBe(14)
    expect(cursorOffset(2, top, bot, 24, 10, 14)).toBe(0)
  })

  test("messageText copies user prompts with attached files", () => {
    const msg = makeMsg("u1", "user")
    const parts = [
      makeTextPart("p1", "u1", "retry the login flow"),
      {
        id: "f1",
        messageID: "u1",
        sessionID: "fixture-session",
        type: "file",
        filename: "src/login.ts",
      } as unknown as Part,
    ]

    expect(messageText(msg, parts, false)).toBe("retry the login flow\n\nsrc/login.ts")
    expect(editText(msg, parts)).toBe("retry the login flow")
  })

  test("messageText includes visible assistant prose, reasoning, and tool output", () => {
    const msg = makeMsg("a1", "assistant")
    const parts = [
      makeTextPart("p1", "a1", "Here is the fix."),
      {
        id: "r1",
        messageID: "a1",
        sessionID: "fixture-session",
        type: "reasoning",
        text: "checked the auth branch",
      } as unknown as Part,
      makeToolPart("t1", "a1"),
    ]

    expect(messageText(msg, parts, true)).toContain("Here is the fix.")
    expect(messageText(msg, parts, true)).toContain("checked the auth branch")
    expect(messageText(msg, parts, true)).toContain("ls")
    expect(messageText(msg, parts, true)).toContain("file.ts")
    expect(editText(msg, parts)).toBe("")
  })
})
