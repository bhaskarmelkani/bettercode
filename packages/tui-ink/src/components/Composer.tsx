import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { SlashMenu } from "./SlashMenu"
import { Spinner } from "./Spinner"
import { useAppStore } from "../store"
import {
  useTextInput,
  textInsertAt,
  textDelAt,
  textDelKey,
  textDelWord,
  textKillLine,
  cursorLineIdx,
  lineCount,
} from "../hooks/useTextInput"
import { useHistorySearch } from "../hooks/useHistorySearch"
import { useMentions } from "../hooks/useMentions"
import { useSlashCommands } from "../hooks/useSlashCommands"
import { editPrompt } from "../utils/promptEditor"
import { readClipboardImage, type ClipboardImage } from "../utils/imagePaste"
import { computeHighlights, type Highlight } from "../hooks/useHighlights"
import type { FilePartInput, QuestionRequest } from "@opencode-ai/sdk/v2"
import { primaryKey, resolveAction } from "../keybindings"
import { useVimMode } from "../hooks/useVimMode"

// Maximum visible input lines before scrolling within the composer.
const MAX_VISIBLE = 15

const LEAD = 3

interface Props {
  onSubmit: (text: string, files?: FilePartInput[]) => void
  onAbort: () => void
  onSteer?: (text: string, files?: FilePartInput[]) => void
  active: boolean
  generating: boolean
  width: number
  question?: QuestionRequest | null
}

type Key = {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  tab?: boolean
  return?: boolean
  escape?: boolean
  backspace?: boolean
  delete?: boolean
  upArrow?: boolean
  downArrow?: boolean
  leftArrow?: boolean
  rightArrow?: boolean
}

export function Composer({ onSubmit, onAbort, onSteer, active, generating, width, question: questionProp }: Props) {
  const theme = useTheme()
  const {
    value,
    cursor,
    setValue,
    setAt,
    insert,
    del,
    deleteKey,
    deleteWord,
    moveLeft,
    moveRight,
    home,
    end,
    clear,
    undo,
    newline,
    lineUp,
    lineDown,
    killLine,
    yank,
    yankPop,
  } = useTextInput()
  const [draft, setDraft] = useState("")
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [caretOn, setCaretOn] = useState(true)
  const [busy, setBusy] = useState(false)
  const [base, setBase] = useState("")
  const [images, setImages] = useState<ClipboardImage[]>([])

  // Persisted history and stash from store
  const hist = useAppStore((s) => s.promptHistory)
  const stash = useAppStore((s) => s.promptStash)
  const pushPromptHistory = useAppStore((s) => s.pushPromptHistory)
  const setPromptStash = useAppStore((s) => s.setPromptStash)
  const setComposerLines = useAppStore((s) => s.setComposerLines)
  const composerAppend = useAppStore((s) => s.composerAppend)
  const composerSeed = useAppStore((s) => s.composerSeed)
  const setMode = useAppStore((s) => s.setMode)
  const agent = useAppStore((s) => s.mode)
  const addToast = useAppStore((s) => s.addToast)
  const bindings = useAppStore((s) => s.keybindings)
  const vimEnabled = useAppStore((s) => s.vimEnabled)

  const vim = useVimMode(vimEnabled)

  // Question is passed from SessionScreen → BottomDock → Composer so it always uses
  // the correct session's questions without depending on s.currentSessionID.
  const question = questionProp ?? null
  const replyQuestion = useAppStore((s) => s.replyQuestion)
  const rejectQuestion = useAppStore((s) => s.rejectQuestion)

  const [qIdx, setQIdx] = useState(0)
  const [qAnswers, setQAnswers] = useState<string[][]>([])
  const [qOptIdx, setQOptIdx] = useState(0)
  const currentQ = question ? (question.questions[qIdx] ?? null) : null
  const qOpts = currentQ?.options ?? []
  const qShowCustom = currentQ?.custom !== false
  const qTotal = qOpts.length + (qShowCustom ? 1 : 0)
  const qInCustom = qShowCustom && qOptIdx === qOpts.length

  useEffect(() => {
    if (!question) return
    setQIdx(0)
    setQAnswers([])
    setQOptIdx(0)
    clear()
  }, [question?.id])

  function advanceQ(ans: string[]) {
    if (!question) return
    const next = [...qAnswers, ans]
    const nextIdx = qIdx + 1
    if (nextIdx >= question.questions.length) {
      void replyQuestion(question.id, next)
    } else {
      setQAnswers(next)
      setQIdx(nextIdx)
      setQOptIdx(0)
      clear()
    }
  }

  const mentions = useMentions(value, cursor, setValue)
  const slash = useSlashCommands(value, mentions.active, clear, setValue)
  const search = useHistorySearch(hist)

  // Blink caret when active. Freeze (off) when inactive.
  useEffect(() => {
    if (!active) {
      setCaretOn(false)
      return
    }
    const t = setInterval(() => setCaretOn((v) => !v), 530)
    return () => {
      clearInterval(t)
      setCaretOn(true)
    }
  }, [active])

  // Handle server-appended text
  useEffect(() => {
    if (!composerAppend) return
    setValue((v) => v + composerAppend)
    useAppStore.getState().setComposerAppend("")
  }, [composerAppend])

  useEffect(() => {
    if (!composerSeed) return
    if (value && value !== composerSeed.text) setPromptStash(value)
    restore(composerSeed.text)
    useAppStore.getState().clearComposerSeed()
  }, [composerSeed, value])

  // Sync visible line count to store so SessionScreen can adjust dockHeight.
  useEffect(() => {
    setComposerLines(Math.min(MAX_VISIBLE, lineCount(value)))
  }, [value])

  function buildSubmission(text: string) {
    const trimmed = text.trim()
    if (!trimmed && images.length === 0) return null
    if (!trimmed) return null
    pushPromptHistory(trimmed)
    setHistIdx(null)
    setDraft("")
    clear()
    slash.setIdx(0)
    mentions.setAttachments([])
    const imgParts: FilePartInput[] = images.map((img) => ({
      type: "file" as const,
      mime: img.mime,
      url: `data:${img.mime};base64,${img.data}`,
    }))
    setImages([])
    const files = [...mentions.buildFileParts(), ...imgParts]
    return { trimmed, files: files.length > 0 ? files : undefined }
  }

  async function pasteImage() {
    const img = await readClipboardImage()
    if (img) setImages((prev) => [...prev, img])
  }

  function submit(text: string) {
    const result = buildSubmission(text)
    if (result) onSubmit(result.trimmed, result.files)
  }

  function steer(text: string) {
    const result = buildSubmission(text)
    if (result) onSteer?.(result.trimmed, result.files)
  }

  function reset() {
    setHistIdx(null)
    slash.setIdx(0)
  }

  function restore(text: string) {
    setValue(text)
    reset()
    mentions.update(text)
  }

  function cancelSearch() {
    search.cancel()
    restore(base)
  }

  function acceptSearch() {
    const text = search.accept()
    restore(text || base)
  }

  function startSearch() {
    if (!search.active) setBase(value)
    mentions.clear()
    slash.setIdx(0)
    search.start()
  }

  async function openEditor() {
    setBusy(true)
    try {
      const next = await editPrompt(value)
      restore(next)
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "failed to open editor",
        variant: "error",
        duration: 3000,
      })
    } finally {
      setBusy(false)
    }
  }

  function handleSearch(input: string, key: Key) {
    if (!search.active) return false
    if (key.ctrl && input === "r") {
      search.next()
      return true
    }
    if (key.escape || (key.ctrl && input === "g")) {
      cancelSearch()
      return true
    }
    if (key.return || (key.ctrl && input === "j")) {
      acceptSearch()
      return true
    }
    if (key.backspace || key.delete) {
      search.back()
      return true
    }
    if (!key.ctrl && !key.meta && input && !input.startsWith("[") && !input.startsWith("\u001b")) {
      search.input(input)
      return true
    }
    return true
  }

  // When generating: handle text editing and queue/steer submission.
  // Arrow keys are intentionally NOT consumed so they flow to MessageList for scrolling.
  useInput(
    (input, key) => {
      // Questions appear while the model is generating (tool pause) — handle them here too.
      if (question && currentQ) {
        if (!qInCustom) {
          if (key.upArrow) { setQOptIdx((i) => Math.max(0, i - 1)); return }
          if (key.downArrow) { setQOptIdx((i) => Math.min(qTotal - 1, i + 1)); return }
          if (key.escape) { void rejectQuestion(question.id); return }
          if (key.return) { advanceQ([qOpts[qOptIdx]?.label ?? ""]); return }
          return
        } else {
          if (key.return) {
            const text = value.trim()
            if (text) { advanceQ([text]); clear() }
            return
          }
          if (key.escape || key.upArrow) {
            setQOptIdx(Math.max(0, qOpts.length - 1))
            clear()
            return
          }
          // fall through to text editing for custom answer
        }
      }

      const action = resolveAction(bindings, input, key, ["stream"])

      if (action === "exit") {
        onAbort()
        return
      }

      if (handleSearch(input, key)) return

      if (action === "steer") {
        steer(value)
        return
      }

      if (action === "clearInput") {
        clear()
        reset()
        mentions.clear()
        return
      }

      if (action === "stashInput") {
        if (value) {
          setPromptStash(value)
          clear()
          reset()
        }
        return
      }

      if (action === "unstashInput") {
        if (yank()) return
        if (stash) {
          setValue((v) => v + stash)
          setPromptStash(null)
        }
        return
      }

      if (action === "yankCycle") {
        yankPop()
        return
      }

      if (action === "undoInput") {
        undo()
        reset()
        return
      }

      if (action === "historySearch") {
        startSearch()
        return
      }

      if (action === "externalEditor" && value) {
        void openEditor()
        return
      }

      if (action === "home") {
        home()
        return
      }

      if (action === "end") {
        end()
        return
      }

      if (action === "deleteWord") {
        const next = textDelWord(value, cursor)[0]
        deleteWord()
        mentions.update(next)
        return
      }

      if (action === "killLine") {
        const next = textKillLine(value, cursor)[0]
        killLine()
        mentions.update(next)
        return
      }

      if (action === "submit") {
        submit(value)
        return
      }

      if (action === "backspace") {
        const next = textDelAt(value, cursor)[0]
        del()
        slash.setIdx(0)
        mentions.update(next)
        return
      }

      if (action === "delete") {
        const next = textDelKey(value, cursor)[0]
        deleteKey()
        slash.setIdx(0)
        mentions.update(next)
        return
      }

      if (action === "moveLeft" || action === "moveRight") {
        if (action === "moveLeft") moveLeft()
        else moveRight()
        return
      }

      if (action === "newline") {
        newline()
        return
      }

      if (key.ctrl && input === "v") {
        void pasteImage()
        return
      }

      if (key.ctrl || key.meta) return

      if (input && (input.startsWith("[<") || input.startsWith("[M"))) return

      if (input) {
        const next = textInsertAt(value, cursor, input)[0]
        insert(input)
        slash.setIdx(0)
        if (mentions.trigger(input)) return
        mentions.update(next)
      }
    },
    { isActive: active && generating && !busy },
  )

  // Full editing input — inactive while generating so arrow keys go to MessageList.
  useInput(
    (input, key) => {
      // Question mode: intercept keys for option navigation and custom answer input.
      if (question && currentQ) {
        if (!qInCustom) {
          // Option selection — only allow navigation, confirm, reject
          if (key.upArrow) { setQOptIdx((i) => Math.max(0, i - 1)); return }
          if (key.downArrow) { setQOptIdx((i) => Math.min(qTotal - 1, i + 1)); return }
          if (key.escape) { void rejectQuestion(question.id); return }
          if (key.return) { advanceQ([qOpts[qOptIdx]?.label ?? ""]); return }
          return // consume all other keys
        } else {
          // Custom answer — intercept submit and cancel; let normal text editing through
          if (key.return) {
            const text = value.trim()
            if (text) { advanceQ([text]); clear() }
            return
          }
          if (key.escape || key.upArrow) {
            setQOptIdx(Math.max(0, qOpts.length - 1))
            clear()
            return
          }
          // fall through to normal text editing for all other keys
        }
      }

      // Vim mode: let the state machine handle keys in normal/visual/operator-pending mode.
      // Returns true → key consumed; false → fall through to insert-mode logic below.
      if (vim.vimEnabled && vim.vimMode !== "insert") {
        if (vim.handleVimInput({ value, cursor }, input, key, setAt)) return
      }

      const action = resolveAction(bindings, input, key, ["chat"])

      if (action === "exit") {
        onAbort()
        return
      }

      if (handleSearch(input, key)) return

      if (action === "clearInput") {
        clear()
        reset()
        mentions.clear()
        return
      }

      if (action === "stashInput") {
        if (value) {
          setPromptStash(value)
          clear()
          reset()
        }
        return
      }
      if (action === "unstashInput") {
        if (yank()) return
        if (stash) {
          setValue((v) => v + stash)
          setPromptStash(null)
        }
        return
      }

      if (action === "yankCycle") {
        yankPop()
        return
      }

      if (action === "undoInput") {
        undo()
        reset()
        return
      }

      if (action === "historySearch") {
        startSearch()
        return
      }

      if (action === "externalEditor" && value) {
        void openEditor()
        return
      }

      if (action === "toggleMode") {
        setMode(agent === "plan" ? "build" : "plan")
        return
      }

      if (key.escape) {
        // Vim insert mode: Escape → normal mode (vim hook handles it)
        if (vim.vimEnabled && vim.vimMode === "insert") {
          if (vim.handleVimInput({ value, cursor }, input, key, setAt)) return
        }
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

      if (action === "newline") {
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

      if (action === "historyPrev") {
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
          const idx = 0
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        } else if (histIdx < hist.length - 1) {
          const idx = histIdx + 1
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        }
        return
      }

      if (action === "historyNext") {
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
        if (histIdx > 0) {
          const idx = histIdx - 1
          setHistIdx(idx)
          setValue(hist[idx] ?? "")
        } else {
          setHistIdx(null)
          setValue(draft)
        }
        return
      }

      if (action === "submit") {
        if (slash.visible) {
          const cmd = slash.options[slash.idx]
          if (cmd) slash.select(cmd)
          return
        }
        submit(value)
        return
      }

      if (action === "backspace") {
        // Compute cursor-aware next value for mention tracking before mutating state
        const next = textDelAt(value, cursor)[0]
        del()
        slash.setIdx(0)
        mentions.update(next)
        return
      }

      if (action === "delete") {
        const next = textDelKey(value, cursor)[0]
        deleteKey()
        slash.setIdx(0)
        mentions.update(next)
        return
      }

      if (action === "moveLeft") {
        moveLeft()
        return
      }

      if (action === "moveRight") {
        moveRight()
        return
      }

      if (action === "home") {
        home()
        return
      }

      if (action === "end") {
        end()
        return
      }

      if (action === "deleteWord") {
        const next = textDelWord(value, cursor)[0]
        deleteWord()
        mentions.update(next)
        return
      }

      if (action === "killLine") {
        const next = textKillLine(value, cursor)[0]
        killLine()
        mentions.update(next)
        return
      }

      if (key.ctrl && input === "v") {
        void pasteImage()
        return
      }

      if (key.ctrl || key.meta) return

      // Filter out remaining terminal escape sequences (mouse SGR/X10)
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
    { isActive: active && !generating && !busy },
  )

  const highlights = computeHighlights(value)

  // Split a text substring (starting at absStart in `value`) into styled segments.
  function renderHighlighted(text: string, absStart: number, baseColor: string, bgColor: string | undefined): React.ReactNode {
    if (!text) return null
    const hl = highlights.filter((h) => h.start < absStart + text.length && h.end > absStart)
    if (!hl.length) return <Text color={baseColor} backgroundColor={bgColor}>{text}</Text>
    const pts = [
      ...new Set([
        0,
        text.length,
        ...hl.flatMap((h) => [Math.max(0, h.start - absStart), Math.min(text.length, h.end - absStart)]),
      ]),
    ].sort((a, b) => a - b)
    return (
      <>
        {pts.slice(0, -1).map((s, i) => {
          const e = pts[i + 1]!
          const chunk = text.slice(s, e)
          const abs = absStart + s
          const h = hl.find((h) => h.start <= abs && abs < h.end)
          return (
            <Text key={s} color={h?.color ?? baseColor} bold={h?.bold} backgroundColor={bgColor}>
              {chunk}
            </Text>
          )
        })}
      </>
    )
  }

  const placeholder = generating
    ? `Type to queue... (↑↓ scroll · ${primaryKey(bindings, "steer", ["stream"]) || "ctrl+s"} steer · ${primaryKey(bindings, "exit", ["global"]) || "ctrl+c"} abort)`
    : "Type a message... (/ for commands, @ for files)"

  // Compute visible window for multi-line input.
  const allLines = value.split("\n")
  const curLine = cursorLineIdx(value, cursor)
  const viewStart = Math.max(0, curLine - MAX_VISIBLE + 1)
  const visLines = allLines.slice(viewStart, viewStart + MAX_VISIBLE)
  const field = undefined
  const overlay = theme.surface0
  // Precompute start position of each line in `value`.
  const allStarts = allLines.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + allLines[i - 1]!.length + 1)
    return acc
  }, [])

  return (
    <Box flexDirection="column" flexShrink={0} position="relative">
      {(mentions.attachments.length > 0 || images.length > 0) && (
        <Box flexDirection="row" gap={1} flexWrap="wrap" marginBottom={0} paddingLeft={2}>
          {mentions.attachments.map((a) => (
            <Box key={a} flexDirection="row">
              <Text backgroundColor={theme.mauve} color={theme.base}>
                {" "}
                {a.split("/").pop()}{" "}
              </Text>
            </Box>
          ))}
          {images.map((_, i) => (
            <Box key={i} flexDirection="row">
              <Text backgroundColor={theme.blue} color={theme.base}>
                {" "}
                [Image #{i + 1}]{" "}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {stash && (
        <Box paddingLeft={2} marginBottom={0}>
          <Text color={theme.overlay} dimColor>
            stash: {stash.slice(0, 40)}
            {stash.length > 40 ? "…" : ""} (stashed)
          </Text>
        </Box>
      )}

      <Box flexDirection="column" position="relative">
        {!search.active && mentions.visible && (
          <Box
            position="absolute"
            width={width}
            marginTop={-Math.min(6, mentions.results.length)}
            flexDirection="column"
          >
            {mentions.results.slice(0, 6).map((path, i) => (
              <Text
                key={path}
                backgroundColor={i === mentions.idx ? theme.surface1 : theme.surface0}
                color={i === mentions.idx ? theme.text : theme.subtext}
                wrap="truncate-end"
              >
                {`${i === mentions.idx ? "▶ " : "  "}${path}`.padEnd(width)}
              </Text>
            ))}
          </Box>
        )}
        {/* Slash menu — absolute overlay above the input */}
        {!search.active && slash.visible && <SlashMenu width={width} options={slash.options} focused={slash.idx} />}

        {/* Question UI — replaces context line when a question is active */}
        {question && currentQ && (
          <Box flexDirection="column" paddingX={1}>
            <Box>
              <Text backgroundColor={theme.cyan} color={theme.base}>{" ? "}</Text>
              <Text color={theme.text}>{" "}</Text>
              <Text color={theme.text} wrap="truncate-end">{currentQ.question}</Text>
            </Box>
            {qOpts.map((opt, i) => {
              const sel = i === qOptIdx && !qInCustom
              return (
                <Box key={i}>
                  <Text color={sel ? theme.cyan : theme.overlay}>{sel ? " ▶ " : "   "}</Text>
                  <Text color={sel ? theme.text : theme.subtext} bold={sel}>{opt.label}</Text>
                </Box>
              )
            })}
            {qShowCustom && (
              <Box>
                <Text color={qInCustom ? theme.cyan : theme.overlay}>{qInCustom ? " ▶ " : "   "}</Text>
                <Text color={qInCustom ? theme.text : theme.overlay}>
                  {qInCustom ? "custom:" : "type a custom answer"}
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Context line — generating status or empty; hidden when question/slash/mention overlay is active */}
        <Box height={!question && !search.active && !slash.visible && !mentions.visible ? 1 : 0}>
          {!search.active && !slash.visible && !mentions.visible && (
            generating ? (
              <Spinner
                label={` generating  ↑↓ scroll · ${primaryKey(bindings, "submit", ["stream"]) || "enter"}: queue · ${primaryKey(bindings, "steer", ["stream"]) || "ctrl+s"}: steer · ${primaryKey(bindings, "exit", ["global"]) || "ctrl+c"}: abort`}
              />
            ) : (
              <Text> </Text>
            )
          )}
        </Box>

        {/* Vim mode indicator */}
        {vim.vimEnabled && (
          <Box height={1}>
            <Text color={vim.vimMode === "normal" ? theme.yellow : vim.vimMode === "insert" ? theme.green : theme.mauve} bold>
              {vim.vimMode === "normal"
                ? "-- NORMAL --"
                : vim.vimMode === "insert"
                ? "-- INSERT --"
                : vim.vimMode === "operator-pending"
                ? "-- PENDING --"
                : "-- VISUAL --"}
            </Text>
          </Box>
        )}

        {/* Separator — prominent divider between content and input */}
        <Text color={theme.surface2}>{"─".repeat(width)}</Text>

        {/* Input area — always live (supports typing while generating for queue/steer) */}
        {search.active ? (
          <Box flexDirection="row">
            <Text color={theme.cyan}>{">  "}</Text>
            <Text color={theme.text} wrap="truncate-end">
              {`(reverse-i-search)\`${search.query}': ${search.match || ""}`}
            </Text>
          </Box>
        ) : question && !qInCustom ? (
          <Box paddingLeft={2}>
            <Text color={theme.overlay}>↑↓ select · enter confirm · esc reject</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
          {visLines.map((line, vi) => {
            const absIdx = viewStart + vi
            const lineStart = allStarts[absIdx]!
            const onLine = absIdx === curLine
            const col = onLine ? cursor - lineStart : -1
            const txt = active ? theme.text : theme.subtext
            const glyph = active ? theme.cyan : theme.overlay
            const body = !value ? placeholder : line || " "
            const fill = Math.max(0, width - LEAD - body.length)

            return (
              <Box key={absIdx} flexDirection="row">
                <Text color={glyph} backgroundColor={field}>
                  {vi === 0 && viewStart === 0 ? ">" : " "}
                </Text>
                <Text backgroundColor={field}>{"  "}</Text>
                {onLine ? (
                  <>
                    {col > 0 && renderHighlighted(line.slice(0, col), lineStart, txt, field)}
                    <Text backgroundColor={caretOn ? theme.cyan : field} color={caretOn ? theme.base : txt}>
                      {col < line.length ? line[col] : " "}
                    </Text>
                    {col < line.length && renderHighlighted(line.slice(col + 1), lineStart + col + 1, txt, field)}
                    {!value && (
                      <Text color={theme.subtext} backgroundColor={field}>
                        {placeholder}
                      </Text>
                    )}
                    {fill > 0 ? <Text backgroundColor={field}>{" ".repeat(fill)}</Text> : null}
                  </>
                ) : (
                  <>
                    {line
                      ? renderHighlighted(line, lineStart, txt, field)
                      : <Text color={txt} backgroundColor={field}>{" "}</Text>
                    }
                    {fill > 0 ? <Text backgroundColor={field}>{" ".repeat(fill)}</Text> : null}
                  </>
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
