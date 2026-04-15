import React from "react"
import { describe, expect, test } from "bun:test"
import { ThemeProvider } from "../src/theme-context"
import { Spinner, glow, isStalled, spinnerText } from "../src/components/Spinner"
import { capture } from "../src/testing/render"

describe("spinner helpers", () => {
  test("timer stays hidden for short thinking bursts", () => {
    const now = 10_000
    expect(spinnerText(" thinking", now, now - 1500)).toBe(" thinking")
  })

  test("timer appears after two seconds", () => {
    const now = 10_000
    expect(spinnerText(" thinking", now, now - 2500)).toBe(" thinking (2.5s)")
  })

  test("stall flips after three seconds without progress", () => {
    const now = 10_000
    expect(isStalled(now, now - 2000)).toBe(false)
    expect(isStalled(now, now - 3500)).toBe(true)
  })

  test("glow centers one bright cell and soft neighbors", () => {
    expect(glow(5, 0)).toEqual([2, 1, 1, 1, 1])
    expect(glow(5, 2)).toEqual([1, 1, 2, 1, 1])
  })
})

describe("spinner render", () => {
  test("shows timer text when thinking long enough", async () => {
    const frame = await capture(
      <ThemeProvider>
        <Spinner label=" thinking" pulse={Date.now()} thinkingSince={Date.now() - 2500} />
      </ThemeProvider>,
      { columns: 40, rows: 1 },
    )

    expect(frame.text).toContain("thinking (2.")
  })
})
