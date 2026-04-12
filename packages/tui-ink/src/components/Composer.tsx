import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { SlashMenu, type SlashCommand } from "./SlashMenu"
import { useAppStore } from "../store"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import type { FilePartInput } from "@opencode-ai/sdk/v2"

const SPIN_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Built-in slash commands always available in session context
const BUILTIN: SlashCommand[] = [
  { name: "undo", description: "Revert last message" },
  { name: "compact", description: "Compact (summarize) session" },
  { name: "thinking", description: "Toggle reasoning visibility" },
  { name: "clear", description: "Clear composer input" },
]

interface Props {
  onSubmit: (text: string, files?: FilePartInput[]) => void
  onAbort: () => void
  active: boolean
  generating: boolean
}

export function Composer({ onSubmit, onAbort, active, generating }: Props) {
  const theme = useTheme()
  const [value, setValue] = useState("")
  const [draft, setDraft] = useState("")
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [slashIdx, setSlashIdx] = useState(0)
  const [spinFrame, setSpinFrame] = useState(0)
  const [caretOn, setCaretOn] = useState(true)

  // Persisted history and stash from store
  const hist = useAppStore((s) => s.promptHistory)
  const stash = useAppStore((s) => s.promptStash)
  const pushPromptHistory = useAppStore((s) => s.pushPromptHistory)
  const setPromptStash = useAppStore((s) => s.setPromptStash)

  // @ mention state
  const [mentionActive, setMentionActive] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionIdx, setMentionIdx] = useState(0)
  const [mentionResults, setMentionResults] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])

  const client = useAppStore((s) => s.client)
  const directory = useAppStore((s) => s.directory)
  const commands = useAppStore((s) => s.commands)
  const setShowThinking = useAppStore((s) => s.setShowThinking)
  const showThinking = useAppStore((s) => s.showThinking)
  const composerAppend = useAppStore((s) => s.composerAppend)
  const regCmds = useCommands()

  // Animate spinner while generating
  useEffect(() => {
    if (!generating) {
      setSpinFrame(0)
      return
    }
    const t = setInterval(() => setSpinFrame((f) => (f + 1) % SPIN_FRAMES.length), 100)
    return () => clearInterval(t)
  }, [generating])

  // Blink caret when idle
  useEffect(() => {
    if (generating) {
      setCaretOn(true)
      return
    }
    const t = setInterval(() => setCaretOn((v) => !v), 530)
    return () => { clearInterval(t); setCaretOn(true) }
  }, [generating])

  // Handle server-appended text
  useEffect(() => {
    if (!composerAppend) return
    setValue((v) => v + composerAppend)
    useAppStore.getState().setComposerAppend("")
  }, [composerAppend])

  // File search for @ mentions
  useEffect(() => {
    if (!mentionActive || !client || !mentionQuery) {
      setMentionResults([])
      return
    }
    const ctrl = new AbortController()
    client.find
      .files({ query: mentionQuery, type: "file", limit: 8, ...(directory ? { directory } : {}) })
      .then((r) => {
        if (ctrl.signal.aborted) return
        setMentionResults(r.data ?? [])
        setMentionIdx(0)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [mentionQuery, mentionActive, client, directory])

  const isSlash = value.startsWith("/") && !mentionActive
  const query = isSlash ? value.slice(1).toLowerCase() : ""

  const regSlash: SlashCommand[] = regCmds
    .filter((c) => c.slash && c.enabled !== false && !BUILTIN.find((b) => b.name === c.slash))
    .map((c) => ({ name: c.slash!, description: c.description ?? c.label }))

  const allSlash: SlashCommand[] = [
    ...BUILTIN,
    ...regSlash,
    ...commands
      .filter((c) => c.name && !BUILTIN.find((b) => b.name === c.name) && !regSlash.find((r) => r.name === c.name))
      .map((c) => ({ name: c.name, description: c.description ?? "" })),
  ]

  const slashOptions = isSlash ? allSlash.filter((c) => c.name.startsWith(query)) : []
  const slashVisible = slashOptions.length > 0 && !mentionActive
  const mentionVisible = mentionActive && mentionResults.length > 0

  function buildFileParts(): FilePartInput[] {
    return attachments.map((path) => ({
      type: "file" as const,
      mime: "text/plain",
      filename: path.split("/").pop() ?? path,
      url: `file://${directory ? directory.replace(/\/$/, "") + "/" : ""}${path}`,
    }))
  }

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    pushPromptHistory(trimmed)
    setHistIdx(null)
    setDraft("")
    setValue("")
    setSlashIdx(0)
    setAttachments([])
    const files = buildFileParts()
    onSubmit(trimmed, files.length > 0 ? files : undefined)
  }

  function selectMention(path: string) {
    // Replace @query with @filename in value
    const atIdx = value.lastIndexOf("@")
    const before = atIdx >= 0 ? value.slice(0, atIdx) : value
    const fname = path.split("/").pop() ?? path
    setValue(before + "@" + fname + " ")
    setAttachments((a) => [...a, path])
    setMentionActive(false)
    setMentionQuery("")
    setMentionResults([])
  }

  function handleSlashSelect(cmd: SlashCommand) {
    if (cmd.name === "thinking") {
      setShowThinking(!showThinking)
      setValue("")
      return
    }
    if (cmd.name === "clear") {
      setValue("")
      return
    }
    const reg = regCmds.find((c) => c.slash === cmd.name && c.enabled !== false)
    if (reg) {
      setValue("")
      setSlashIdx(0)
      registry.trigger(reg.id)
      return
    }
    setValue("/" + cmd.name + " ")
    setSlashIdx(0)
  }

  // When generating: only Ctrl+C (abort) is handled. This frees up arrow keys
  // so the message list can be scrolled while the model is responding.
  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        onAbort()
      }
    },
    { isActive: active && generating },
  )

  // Full editing input — inactive while generating so arrow keys go to MessageList.
  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        onAbort()
        return
      }

      if (key.ctrl && input === "u") {
        setValue("")
        setHistIdx(null)
        setSlashIdx(0)
        setMentionActive(false)
        setMentionQuery("")
        return
      }

      // Ctrl+X → stash current input; Ctrl+Y → pop stash
      if (key.ctrl && input === "x") {
        if (value) {
          setPromptStash(value)
          setValue("")
          setHistIdx(null)
          setSlashIdx(0)
        }
        return
      }
      if (key.ctrl && input === "y") {
        if (stash) {
          setValue((v) => v + stash)
          setPromptStash(null)
        }
        return
      }

      if (key.escape) {
        if (mentionVisible) {
          setMentionActive(false)
          setMentionQuery("")
          return
        }
        if (slashVisible) {
          setValue("")
          setSlashIdx(0)
        } else {
          setValue("")
          setHistIdx(null)
        }
        return
      }

      // Handle @ mention navigation
      if (mentionVisible) {
        if (key.upArrow) {
          setMentionIdx((i) => Math.max(0, i - 1))
          return
        }
        if (key.downArrow) {
          setMentionIdx((i) => Math.min(mentionResults.length - 1, i + 1))
          return
        }
        if (key.tab || key.return) {
          const path = mentionResults[mentionIdx]
          if (path) selectMention(path)
          return
        }
      }

      if (key.tab && slashVisible) {
        const cmd = slashOptions[slashIdx]
        if (cmd) handleSlashSelect(cmd)
        return
      }

      if (key.upArrow) {
        if (slashVisible) {
          setSlashIdx((i) => Math.max(0, i - 1))
          return
        }
        if (hist.length === 0) return
        if (histIdx === null) {
          setDraft(value)
          const idx = hist.length - 1
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        } else if (histIdx > 0) {
          const idx = histIdx - 1
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        }
        return
      }

      if (key.downArrow) {
        if (slashVisible) {
          setSlashIdx((i) => Math.min(slashOptions.length - 1, i + 1))
          return
        }
        if (histIdx === null) return
        if (histIdx < hist.length - 1) {
          const idx = histIdx + 1
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        } else {
          setHistIdx(null)
          setValue(draft)
        }
        return
      }

      if (key.return) {
        if (slashVisible) {
          const cmd = slashOptions[slashIdx]
          if (cmd) handleSlashSelect(cmd)
          return
        }
        submit(value)
        return
      }

      if (key.backspace || key.delete) {
        const next = value.slice(0, -1)
        setValue(next)
        setSlashIdx(0)
        // Update mention query when backspacing
        if (mentionActive) {
          const atIdx = next.lastIndexOf("@")
          if (atIdx >= 0) {
            setMentionQuery(next.slice(atIdx + 1))
          } else {
            setMentionActive(false)
            setMentionQuery("")
          }
        }
        return
      }

      if (key.ctrl || key.meta) return

      if (input) {
        const next = value + input
        setValue(next)
        setSlashIdx(0)

        // Check for @ trigger
        if (input === "@") {
          const charBefore = value.slice(-1)
          if (!charBefore || /\s/.test(charBefore)) {
            setMentionActive(true)
            setMentionQuery("")
            return
          }
        }

        // Update mention query
        if (mentionActive) {
          const atIdx = next.lastIndexOf("@")
          if (atIdx >= 0) {
            const q = next.slice(atIdx + 1)
            if (/\s/.test(q)) {
              setMentionActive(false)
              setMentionQuery("")
            } else {
              setMentionQuery(q)
            }
          } else {
            setMentionActive(false)
            setMentionQuery("")
          }
        }
      }
    },
    { isActive: active && !generating },
  )

  const placeholder = generating ? "Generating... (↑↓ scroll · ctrl+c abort)" : "Type a message... (/ for commands, @ for files)"

  return (
    <Box flexDirection="column" flexShrink={0}>
      {slashVisible && (
        <SlashMenu query={query} options={slashOptions} focused={slashIdx} onSelect={handleSlashSelect} />
      )}
      {mentionVisible && (
        <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
          {mentionResults.map((path, i) => (
            <Box key={path} flexDirection="row" gap={1}>
              <Text color={i === mentionIdx ? theme.cyan : theme.overlay}>{i === mentionIdx ? "▶" : " "}</Text>
              <Text color={i === mentionIdx ? theme.text : theme.subtext} wrap="truncate-end">
                {path}
              </Text>
            </Box>
          ))}
          <Text color={theme.surface2} dimColor>
            ↑↓ navigate · tab/enter insert · esc dismiss
          </Text>
        </Box>
      )}
      {attachments.length > 0 && (
        <Box flexDirection="row" gap={1} flexWrap="wrap" marginBottom={0} paddingLeft={2}>
          {attachments.map((a) => (
            <Box key={a} flexDirection="row">
              <Text backgroundColor={theme.mauve} color={theme.base}>
                {" "}
                {a.split("/").pop()}{" "}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {stash && (
        <Box paddingLeft={2} marginBottom={0}>
          <Text color={theme.overlay} dimColor>
            stash: {stash.slice(0, 40)}
            {stash.length > 40 ? "…" : ""} (ctrl+y to restore)
          </Text>
        </Box>
      )}
      <Box flexDirection="row">
        <Text color={generating ? theme.yellow : theme.cyan}>
          {generating ? SPIN_FRAMES[spinFrame] + " " : "› "}
        </Text>
        {generating ? (
          <Text color={theme.overlay}>{placeholder}</Text>
        ) : (
          <>
            {value && <Text color={theme.text}>{value}</Text>}
            <Text backgroundColor={caretOn ? theme.cyan : undefined} color={theme.base}>{" "}</Text>
            {!value && <Text color={theme.overlay}>{placeholder}</Text>}
          </>
        )}
      </Box>
      <Box marginTop={0}>
        <Text color={theme.surface2} dimColor>
          {generating
            ? "ctrl+c abort · ↑↓ scroll messages · shift+↑↓ scroll 3x"
            : "enter submit · ↑↓ history · ctrl+u clear · ctrl+x stash · ctrl+y pop · / commands · @ files"}
        </Text>
      </Box>
    </Box>
  )
}
