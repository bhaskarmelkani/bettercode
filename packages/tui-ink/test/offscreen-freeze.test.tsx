import React from "react"
import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { render, Text } from "ink"
import { hold, OffscreenFreeze } from "../src/components/OffscreenFreeze"

const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/g

class Out extends PassThrough {
  columns = 80
  rows = 24
  isTTY = true
  data: string[] = []

  override write(chunk: string | Uint8Array, cb?: ((err?: Error | null) => void) | undefined): boolean
  override write(
    chunk: string | Uint8Array,
    enc?: BufferEncoding | ((err?: Error | null) => void) | undefined,
    cb?: ((err?: Error | null) => void) | undefined,
  ): boolean
  override write(
    chunk: string | Uint8Array,
    enc?: BufferEncoding | ((err?: Error | null) => void) | undefined,
    cb?: ((err?: Error | null) => void) | undefined,
  ) {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
    this.data.push(text)
    if (typeof enc === "function") return super.write(chunk, enc)
    return enc ? super.write(chunk, enc, cb) : super.write(chunk, cb)
  }

  getColorDepth() {
    return 24
  }

  hasColors() {
    return true
  }
}

class In extends PassThrough {
  isTTY = true

  setRawMode() {
    return this
  }

  ref() {
    return this
  }

  unref() {
    return this
  }
}

function tidy(text: string) {
  return text.replace(/\r/g, "").replace(ANSI, "").trim()
}

function frame(out: Out) {
  return tidy([...out.data].reverse().find((part) => tidy(part).length > 0) ?? "")
}

function wait(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("hold", () => {
  test("keeps the previous child while hidden", () => {
    expect(hold("old", false, "new")).toBe("old")
  })

  test("falls back to the current child before any visible render", () => {
    expect(hold(undefined, false, "new")).toBe("new")
  })

  test("refreshes the cache while visible", () => {
    expect(hold("old", true, "new")).toBe("new")
  })
})

describe("OffscreenFreeze", () => {
  test("keeps the last visible frame while hidden", async () => {
    const stdout = new Out()
    const stdin = new In()
    const stderr = new Out()
    const app = render(
      <OffscreenFreeze visible={true}>
        <Text>one</Text>
      </OffscreenFreeze>,
      {
        stdout: stdout as unknown as NodeJS.WriteStream,
        stdin: stdin as unknown as NodeJS.ReadStream,
        stderr: stderr as unknown as NodeJS.WriteStream,
        debug: true,
        patchConsole: false,
        exitOnCtrlC: false,
      },
    )

    await wait()
    expect(frame(stdout)).toContain("one")

    app.rerender(
      <OffscreenFreeze visible={false}>
        <Text>two</Text>
      </OffscreenFreeze>,
    )
    await wait()
    expect(frame(stdout)).toContain("one")
    expect(frame(stdout)).not.toContain("two")

    app.rerender(
      <OffscreenFreeze visible={true}>
        <Text>three</Text>
      </OffscreenFreeze>,
    )
    await wait()
    expect(frame(stdout)).toContain("three")

    app.unmount()
    await wait(0)
    app.cleanup()
  })
})
