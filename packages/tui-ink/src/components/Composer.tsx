import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { SlashMenu } from "./SlashMenu"
import { useAppStore } from "../store"
import {
  useTextInput,
  textInsertAt,
  textDelAt,
  textDelForward,
  textDelWord,
  cursorLineIdx,
  lineCount,
} from "../hooks/useTextInput"
import { useMentions } from "../hooks/useMentions"
import { useSlashCommands } from "../hooks/useSlashCommands"
import type { FilePartInput } from "@opencode-ai/sdk/v2"

// Maximum visible input lines before scrolling within the composer.
const MAX_VISIBLE = 5

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
  const [caretOn, setCaretOn] = useState(true)

  // Persisted history and stash from store
  const hist = useAppStore((s) => s.promptHistory)
  const stash = useAppStore((s) => s.promptStash)
  const pushPromptHistory = useAppStore((s) => s.pushPromptHistory)
  const setPromptStash = useAppStore((s) => s.setPromptStash)
  const setComposerLines = useAppStore((s) => s.setComposerLines)
  const composerAppend = useAppStore((s) => s.composerAppend)
  const setMode = useAppStore((s) => s.setMode)
  const agent = useAppStore((s) => s.mode)

  const mentions = useMentions(value, cursor, setValue)
  const slash = useSlashCommands(value, mentions.active, clear, setValue)

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

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    pushPromptHistory(trimmed)
    setHistIdx(null)
    setDraft("")
    clear()
    slash.setIdx(0)
    mentions.setAttachments([])
    const files = mentions.buildFileParts()
    onSubmit(trimmed, files.length > 0 ? files : undefined)
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
        slash.setIdx(0)
        mentions.clear()
        return
      }

      // Ctrl+X → stash current input; Ctrl+Y → pop stash
      if (key.ctrl && input === "x") {
        if (value) {
          setPromptStash(value)
          clear()
          setHistIdx(null)
          slash.setIdx(0)
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
        if (mentions.visible) {
          mentions.clear()
          return
        }
        if (slash.visible) {
          clear()
          slash.setIdx(0)
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
      if (mentions.visible) {
        if (key.upArrow) {
          mentions.setIdx((i) => Math.max(0, i - 1))
          return
        }
        if (key.downArrow) {
          mentions.setIdx((i) => Math.min(mentions.results.length - 1, i + 1))
          return
        }
        if (key.tab || key.return) {
          const path = mentions.results[mentions.idx]
          if (path) mentions.select(path)
          return
        }
      }

      if (key.tab && slash.visible) {
        const cmd = slash.options[slash.idx]
        if (cmd) slash.select(cmd)
        return
      }

      if (key.upArrow) {
        if (slash.visible) {
          slash.setIdx((i) => Math.max(0, i - 1))
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
        if (slash.visible) {
          slash.setIdx((i) => Math.min(slash.options.length - 1, i + 1))
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
        if (slash.visible) {
          const cmd = slash.options[slash.idx]
          if (cmd) slash.select(cmd)
          return
        }
        submit(value)
        return
      }

      if (key.backspace) {
        // Compute cursor-aware next value for mention tracking before mutating state
        const next = textDelAt(value, cursor)[0]
        del()
        slash.setIdx(0)
        mentions.update(next)
        return
      }

      if (key.delete) {
        // Forward delete — Delete key (not Backspace)
        const next = textDelForward(value, cursor)[0]
        deleteForward()
        slash.setIdx(0)
        mentions.update(next)
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
        mentions.update(next)
        return
      }

      if (key.ctrl || key.meta) return

      // Filter out terminal mouse escape sequences (SGR/X10 format, ESC stripped by Ink)
      if (input && (input.startsWith("[<") || input.startsWith("[M"))) return

      if (input) {
        // Compute cursor-aware next value for mention tracking before mutating state
        const next = textInsertAt(value, cursor, input)[0]
        insert(input)
        slash.setIdx(0)

        if (mentions.trigger(input)) return // @ activated — stop here
        mentions.update(next)
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
      {mentions.attachments.length > 0 && (
        <Box flexDirection="row" gap={1} flexWrap="wrap" marginBottom={0} paddingLeft={2}>
          {mentions.attachments.map((a) => (
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
        {mentions.visible && (
          <Box
            position="absolute"
            width={width}
            marginTop={-Math.min(6, mentions.results.length)}
            flexDirection="column"
            paddingX={1}
          >
            {mentions.results.slice(0, 6).map((path, i) => (
              <Text
                key={path}
                backgroundColor={i === mentions.idx ? theme.surface2 : theme.mantle}
                color={i === mentions.idx ? theme.text : theme.subtext}
                wrap="truncate-end"
              >
                {`${i === mentions.idx ? "▶ " : "  "}${path}`}
              </Text>
            ))}
          </Box>
        )}
        {/* Claude-like: keep the input row fixed; show suggestions as an overlay above it. */}
        {slash.visible && <SlashMenu width={width} options={slash.options} focused={slash.idx} />}

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
