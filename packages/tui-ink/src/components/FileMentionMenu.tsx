import React, { useState, useEffect } from "react"
import { Box, Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"

interface Props {
  query: string
  onSelect: (path: string) => void
}

export function FileMentionMenu({ query, onSelect }: Props) {
  const theme = useTheme()
  const client = useAppStore((s) => s.client)
  const directory = useAppStore((s) => s.directory)
  const [results, setResults] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!client || !query) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    client.find
      .files({ query, type: "file", limit: 10, ...(directory ? { directory } : {}) })
      .then((r) => {
        if (ctrl.signal.aborted) return
        setResults(r.data ?? [])
        setIdx(0)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [query, client, directory])

  if (results.length === 0) return null

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2} paddingY={1}>
      {results.map((path, i) => (
        <Text
          key={path}
          color={i === idx ? theme.cyan : theme.subtext}
          backgroundColor={theme.mantle}
          wrap="truncate-end"
        >
          {`${i === idx ? "▶" : " "} ${path}`}
        </Text>
      ))}
      <Box marginTop={0}>
        <Text color={theme.surface2} dimColor>
          ↑↓ navigate · tab/enter select · esc dismiss
        </Text>
      </Box>
    </Box>
  )
}

// Hook for managing @ mention state in Composer
export function useFileMention() {
  const [active, setActive] = useState(false)
  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<string[]>([])
  const client = useAppStore((s) => s.client)
  const directory = useAppStore((s) => s.directory)

  useEffect(() => {
    if (!active || !client || !query) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    client.find
      .files({ query, type: "file", limit: 10, ...(directory ? { directory } : {}) })
      .then((r) => {
        if (ctrl.signal.aborted) return
        setResults(r.data ?? [])
        setIdx(0)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [query, active, client, directory])

  return { active, setActive, query, setQuery, idx, setIdx, results }
}
