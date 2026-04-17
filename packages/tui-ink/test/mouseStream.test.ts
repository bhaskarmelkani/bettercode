import { describe, test, expect } from "bun:test"
import { parseMouse, isLeftDown, isMotion, isRelease } from "../src/hooks/useMouseStream"

describe("parseMouse", () => {
  test("left button down at (10, 5)", () => {
    const events = parseMouse("\x1b[<0;11;6M")
    expect(events).toHaveLength(1)
    const ev = events[0]!
    expect(ev.btn).toBe(0)
    expect(ev.x).toBe(10) // 11 - 1
    expect(ev.y).toBe(5)  // 6 - 1
    expect(ev.up).toBe(false)
  })

  test("left button release", () => {
    const events = parseMouse("\x1b[<0;11;6m")
    expect(events).toHaveLength(1)
    expect(events[0]!.up).toBe(true)
  })

  test("motion with left held (btn = 32)", () => {
    const events = parseMouse("\x1b[<32;15;8M")
    expect(events).toHaveLength(1)
    expect(events[0]!.btn).toBe(32)
    expect(isMotion(32)).toBe(true)
    expect(isLeftDown(32)).toBe(false)
  })

  test("wheel up (btn = 64)", () => {
    const events = parseMouse("\x1b[<64;1;1M")
    expect(events).toHaveLength(1)
    expect(events[0]!.btn).toBe(64)
  })

  test("wheel down (btn = 65)", () => {
    const events = parseMouse("\x1b[<65;1;1M")
    expect(events).toHaveLength(1)
    expect(events[0]!.btn).toBe(65)
  })

  test("multiple events in one chunk", () => {
    const chunk = "\x1b[<0;5;5M\x1b[<32;6;5M\x1b[<0;7;5m"
    const events = parseMouse(chunk)
    expect(events).toHaveLength(3)
    expect(events[0]!.up).toBe(false)
    expect(events[1]!.btn).toBe(32)
    expect(events[2]!.up).toBe(true)
  })

  test("partial/interrupted sequence returns no events", () => {
    const events = parseMouse("\x1b[<0;5;")
    expect(events).toHaveLength(0)
  })

  test("empty string", () => {
    expect(parseMouse("")).toHaveLength(0)
  })
})

describe("button helpers", () => {
  test("isLeftDown", () => {
    expect(isLeftDown(0)).toBe(true)  // btn=0: left button, no motion
    expect(isLeftDown(1)).toBe(false) // btn=1: middle button
    expect(isLeftDown(32)).toBe(false) // btn=32: motion bit set
    expect(isLeftDown(64)).toBe(false) // btn=64: wheel
  })

  test("isMotion", () => {
    expect(isMotion(32)).toBe(true)
    expect(isMotion(33)).toBe(true) // 32 | 1 = motion + middle
    expect(isMotion(0)).toBe(false)
    expect(isMotion(64)).toBe(false)
  })

  test("isRelease", () => {
    expect(isRelease(0, "m")).toBe(true)
    expect(isRelease(0, "M")).toBe(false)
  })
})
