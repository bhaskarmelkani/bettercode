import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { SlashMenu, type SlashCommand } from "./SlashMenu"
import { useAppStore } from "../store"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import {
  useTextInput,
  textInsertAt,
  textDelAt,
  textDelForward,
  textDelWord,
  cursorLineIdx,
  lineCount,
} from "../hooks/useTextInput"
import type { FilePartInput } from "@opencode-ai/sdk/v2"

// Maximum visible input lines before scrolling within the composer.
const MAX_VISIBLE = 5

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
  width: number
}

export function Composer({ onSubmit, onAbort, active, generating, width }: Props) {
  const theme = useTheme()
  const {
    value,
    cursor,
    setValue,
    insert,
    del,
    deleteForward,
    deleteWord,
    moveLeft,
    moveRight,
    home,
    end,
    clear,
    newline,
    lineUp,
    lineDown,
  } = useTextInput()
  const [draft, setDraft] = useState("")
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [slashIdx, setSlashIdx] = useState(0)
  const [caretOn, setCaretOn] = useState(true)

  // Persisted history and stash from store
  const hist = useAppStore((s) => s.promptHistory)
  const stash = useAppStore((s) => s.promptStash)
  const pushPromptHistory = useAppStore((s) => s.pushPromptHistory)
  const setPromptStash = useAppStore((s) => s.setPromptStash)
  const setComposerLines = useAppStore((s) => s.setComposerLines)

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
  const setMode = useAppStore((s) => s.setMode)
  const agent = useAppStore((s) => s.mode)
  const regCmds = useCommands()

  // Blink caret when idle and active. Freeze (off) when inactive or generating.
  useEffect(() => {
    if (!active || generating) {
      setCaretOn(false)
      return
    }
    const t = setInterval(() => setCaretOn((v) => !v), 530)
    return () => {
      clearInterval(t)
      setCaretOn(true)
    }
  }, [generating, active])

  // Handle server-appended text
  useEffect(() => {
    if (!composerAppend) return
    setValue((v) => v + composerAppend)
    useAppStore.getState().setComposerAppend("")
  }, [composerAppend])

  // Sync visible line count to store so SessionScreen can adjust dockHeight.
  useEffect(() => {
    setComposerLines(Math.min(MAX_VISIBLE, lineCount(value)))
  }, [value])

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

  const slashOptions = isSlash ? allSlash.filter((c) => c.name.startsWith(query)).slice(0, 6) : []
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
    clear()
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
      clear()
      return
    }
    if (cmd.name === "clear") {
      clear()
      return
    }
    const reg = regCmds.find((c) => c.slash === cmd.name && c.enabled !== false)
    if (reg) {
      clear()
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
        clear()
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
          clear()
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

      // Shift+Tab → cycle the active primary agent
      if (key.shift && key.tab) {
        setMode(agent === "plan" ? "build" : "plan")
        return
      }

      if (key.escape) {
        if (mentionVisible) {
          setMentionActive(false)
          setMentionQuery("")
          return
        }
        if (slashVisible) {
          clear()
          setSlashIdx(0)
        } else {
          clear()
          setHistIdx(null)
        }
        return
      }

      // Alt+Enter → insert newline (multi-line input)
      if (key.meta && key.return) {
        newline()
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
        // Multi-line: move cursor up within input if not on first line.
        if (value.includes("\n") && cursorLineIdx(value, cursor) > 0) {
          lineUp()
          return
        }
        // Single-line or on first line: history navigation.
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
        // Multi-line: move cursor down within input if not on last line.
        if (value.includes("\n")) {
          const idx = cursorLineIdx(value, cursor)
          if (idx < lineCount(value) - 1) {
            lineDown()
            return
          }
        }
        // Single-line or on last line: history navigation.
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

      if (key.backspace) {
        // Compute cursor-aware next value for mention tracking before mutating state
        const next = textDelAt(value, cursor)[0]
        del()
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

      if (key.delete) {
        // Forward delete — Delete key (not Backspace)
        const next = textDelForward(value, cursor)[0]
        deleteForward()
        setSlashIdx(0)
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

      if (key.leftArrow) {
        moveLeft()
        return
      }

      if (key.rightArrow) {
        moveRight()
        return
      }

      if (key.ctrl && input === "a") {
        home()
        return
      }

      if (key.ctrl && input === "e") {
        end()
        return
      }

      if (key.ctrl && input === "w") {
        const next = textDelWord(value, cursor)[0]
        deleteWord()
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

      // Filter out terminal mouse escape sequences (SGR/X10 format, ESC stripped by Ink)
      if (input && (input.startsWith("[<") || input.startsWith("[M"))) return

      if (input) {
        // Compute cursor-aware next value for mention tracking before mutating state
        const next = textInsertAt(value, cursor, input)[0]
        insert(input)
        setSlashIdx(0)

        // Check for @ trigger — char before cursor position
        if (input === "@") {
          const charBefore = cursor > 0 ? value[cursor - 1] : ""
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

  const placeholder = generating
    ? "Generating... (↑↓ scroll · ctrl+c abort)"
    : "Type a message... (/ for commands, @ for files)"

  // Compute visible window for multi-line input.
  const allLines = value.split("\n")
  const curLine = cursorLineIdx(value, cursor)
  const viewStart = Math.max(0, curLine - MAX_VISIBLE + 1)
  const visLines = allLines.slice(viewStart, viewStart + MAX_VISIBLE)
  // Precompute start position of each line in `value`.
  const allStarts = allLines.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + allLines[i - 1]!.length + 1)
    return acc
  }, [])

  return (
    <Box flexDirection="column" flexShrink={0} position="relative">
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

      <Box flexDirection="column" position="relative">
        {mentionVisible && (
          <Box
            position="absolute"
            width={width}
            marginTop={-Math.min(6, mentionResults.length)}
            flexDirection="column"
            paddingX={1}
          >
            {mentionResults.slice(0, 6).map((path, i) => (
              <Text
                key={path}
                backgroundColor={i === mentionIdx ? theme.surface2 : theme.mantle}
                color={i === mentionIdx ? theme.text : theme.subtext}
                wrap="truncate-end"
              >
                {`${i === mentionIdx ? "▶ " : "  "}${path}`}
              </Text>
            ))}
          </Box>
        )}
        {/* Claude-like: keep the input row fixed; show suggestions as an overlay above it. */}
        {slashVisible && <SlashMenu width={width} options={slashOptions} focused={slashIdx} />}

        {/* Separator — between transcript and input */}
        <Text color={active ? theme.surface1 : theme.mantle}>{"─".repeat(width)}</Text>

        {/* Input area — single or multi-line */}
        {generating ? (
          <Box flexDirection="row">
            <Text color={theme.yellow}>{"◎ "}</Text>
            <Text color={theme.overlay}>{placeholder}</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {visLines.map((line, vi) => {
              const absIdx = viewStart + vi
              const lineStart = allStarts[absIdx]!
              const onLine = absIdx === curLine
              const col = onLine ? cursor - lineStart : -1
              const txt = active ? theme.text : theme.overlay
              const glyph = active ? theme.cyan : theme.overlay

              return (
                <Box key={absIdx} flexDirection="row">
                  <Text color={glyph}>{vi === 0 && viewStart === 0 ? "› " : "  "}</Text>
                  {onLine ? (
                    <>
                      {col > 0 && <Text color={txt}>{line.slice(0, col)}</Text>}
                      <Text backgroundColor={caretOn ? theme.cyan : undefined} color={caretOn ? theme.base : txt}>
                        {col < line.length ? line[col] : " "}
                      </Text>
                      {col < line.length && <Text color={txt}>{line.slice(col + 1)}</Text>}
                      {!value && <Text color={theme.overlay}>{placeholder}</Text>}
                    </>
                  ) : (
                    <Text color={txt}>{line || " "}</Text>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
