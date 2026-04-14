import { useState, useEffect } from "react"
import { useAppStore } from "../store"
import type { FilePartInput } from "@opencode-ai/sdk/v2"

export function useMentions(value: string, cursor: number, setValue: (v: string | ((v: string) => string)) => void) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])

  const client = useAppStore((s) => s.client)
  const dir = useAppStore((s) => s.directory)

  useEffect(() => {
    if (!active || !client || !query) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    client.find
      .files({ query, type: "file", limit: 8, ...(dir ? { directory: dir } : {}) })
      .then((r) => {
        if (ctrl.signal.aborted) return
        setResults(r.data ?? [])
        setIdx(0)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [query, active, client, dir])

  const visible = active && results.length > 0

  function select(path: string) {
    const atPos = value.lastIndexOf("@")
    const before = atPos >= 0 ? value.slice(0, atPos) : value
    const fname = path.split("/").pop() ?? path
    setValue(before + "@" + fname + " ")
    setAttachments((a) => [...a, path])
    setActive(false)
    setQuery("")
    setResults([])
  }

  // Updates the mention query from the next text value. No-op when not active.
  function update(next: string) {
    if (!active) return
    const atPos = next.lastIndexOf("@")
    if (atPos >= 0) {
      const q = next.slice(atPos + 1)
      if (/\s/.test(q)) {
        setActive(false)
        setQuery("")
      } else {
        setQuery(q)
      }
    } else {
      setActive(false)
      setQuery("")
    }
  }

  // Handles the @ trigger character. Returns true if mention mode was activated.
  function trigger(input: string): boolean {
    if (input !== "@") return false
    const before = cursor > 0 ? value[cursor - 1] : ""
    if (!before || /\s/.test(before)) {
      setActive(true)
      setQuery("")
      return true
    }
    return false
  }

  function clear() {
    setActive(false)
    setQuery("")
  }

  function buildFileParts(): FilePartInput[] {
    return attachments.map((path) => ({
      type: "file" as const,
      mime: "text/plain",
      filename: path.split("/").pop() ?? path,
      url: `file://${dir ? dir.replace(/\/$/, "") + "/" : ""}${path}`,
    }))
  }

  return {
    active,
    query,
    idx,
    setIdx,
    results,
    visible,
    attachments,
    setAttachments,
    select,
    update,
    trigger,
    clear,
    buildFileParts,
  }
}
