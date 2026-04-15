import React from "react"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { render } from "ink"

export type Frame = {
  ansi: string
  text: string
}

type Size = {
  columns: number
  rows: number
}

const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/g

function tidy(text: string) {
  const out = text.replace(/\r/g, "")
  const rows = out.split("\n").map((line) => line.replace(/\s+$/g, ""))
  return `${rows.join("\n").trimEnd()}\n`
}

function strip(text: string) {
  return text.replace(ANSI, "")
}

class Out extends PassThrough {
  columns: number
  rows: number
  isTTY = true
  data: string[] = []

  constructor(size: Size) {
    super()
    this.columns = size.columns
    this.rows = size.rows
  }

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

  resize(size: Size) {
    this.columns = size.columns
    this.rows = size.rows
    this.emit("resize")
  }
}

class In extends PassThrough {
  isTTY = true
  raw = false

  setRawMode(raw: boolean) {
    this.raw = raw
    return this
  }

  ref() {
    return this
  }

  unref() {
    return this
  }
}

function frame(out: Out) {
  const item = [...out.data].reverse().find((part) => tidy(strip(part)).trim().length > 0)
  return item ?? ""
}

function wait(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function capture(node: React.ReactNode, size: Size): Promise<Frame> {
  const stdout = new Out(size)
  const stdin = new In()
  const stderr = new Out(size)
  const app = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    debug: true,
    patchConsole: false,
    exitOnCtrlC: false,
  })

  await wait()
  const ansi = frame(stdout)
  app.unmount()
  await wait(0)
  app.cleanup()

  return {
    ansi,
    text: tidy(strip(ansi)),
  }
}

export function input(stdin: EventEmitter, text: string) {
  stdin.emit("data", text)
}
