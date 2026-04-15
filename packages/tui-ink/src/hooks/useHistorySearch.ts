import { useState } from "react"

export function findHistory(list: string[], query: string) {
  const text = query.trim().toLowerCase()
  if (!text) return list
  return list.filter((item) => item.toLowerCase().includes(text))
}

export function useHistorySearch(list: string[]) {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)

  const hits = findHistory(list, query)
  const match = hits[idx] ?? ""

  const start = () => {
    setActive(true)
    setQuery("")
    setIdx(0)
  }

  const cancel = () => {
    setActive(false)
    setQuery("")
    setIdx(0)
  }

  const accept = () => {
    const text = match
    cancel()
    return text
  }

  const next = () => {
    if (hits.length === 0) return
    setIdx((n) => (n + 1) % hits.length)
  }

  const input = (value: string) => {
    setQuery((prev) => prev + value)
    setIdx(0)
  }

  const back = () => {
    setQuery((prev) => prev.slice(0, -1))
    setIdx(0)
  }

  return {
    active,
    query,
    match,
    start,
    cancel,
    accept,
    next,
    input,
    back,
  }
}
