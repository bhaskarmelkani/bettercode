import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { TextInput } from "@inkjs/ui"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  request: QuestionRequest
  columns: number
  rows: number
}

export function wraps(text: string, width: number) {
  if (width <= 0) return 1
  return text.split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / width)), 0)
}

export function questionWin(hs: number[], idx: number, rows: number) {
  if (hs.length === 0 || rows <= 0) return { start: 0, end: 0 }
  const focus = Math.max(0, Math.min(hs.length - 1, idx))
  let start = 0
  let used = 0

  for (let i = 0; i <= focus; i++) {
    used += hs[i] ?? 0
    while (used > rows && start < i) {
      used -= hs[start] ?? 0
      start += 1
    }
  }

  let end = focus + 1
  while (end < hs.length && used + (hs[end] ?? 0) <= rows) {
    used += hs[end] ?? 0
    end += 1
  }

  return { start, end }
}

export function QuestionPrompt({ request, columns, rows }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyQuestion)
  const reject = useAppStore((s) => s.rejectQuestion)
  // Track current question index and answers collected so far
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<string[][]>([])
  const [optIdx, setOptIdx] = useState(0)
  const [custom, setCustom] = useState("")
  const [typing, setTyping] = useState(false)

  const question = request.questions[qIdx]

  useInput((input, key) => {
    if (!question) return

    if (typing) {
      if (key.escape) {
        setTyping(false)
        setCustom("")
      }
      return
    }

    if (key.upArrow) {
      setOptIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setOptIdx((i) => Math.min((question.options?.length ?? 0) - 1 + (question.custom !== false ? 1 : 0), i + 1))
      return
    }
    if (key.return) {
      const opts = question.options ?? []
      const isCustomSlot = question.custom !== false && optIdx === opts.length
      if (isCustomSlot) {
        setTyping(true)
        return
      }
      const selected = opts[optIdx]?.label ?? ""
      advance([selected])
      return
    }
    if (key.escape) {
      reject(request.id)
    }
  })

  function advance(ans: string[]) {
    const next = [...answers, ans]
    const nextIdx = qIdx + 1
    if (nextIdx >= request.questions.length) {
      reply(request.id, next)
    } else {
      setAnswers(next)
      setQIdx(nextIdx)
      setOptIdx(0)
      setCustom("")
      setTyping(false)
    }
  }

  if (!question) return null

  const opts = question.options ?? []
  const showCustom = question.custom !== false
  const cmd = "question"
  const head = request.questions.length > 1 ? `${cmd} ${qIdx + 1}/${request.questions.length}` : cmd
  const text = Math.max(1, columns - 4)
  const label = Math.max(1, columns - 8)
  const desc = Math.max(1, columns - 10)
  const items = [
    ...opts.map((opt) => ({
      key: opt.label,
      label: opt.label,
      description: opt.description,
      custom: false,
    })),
    ...(showCustom
      ? [
          {
            key: "__custom__",
            label: typing ? "Custom answer" : "Type a custom answer",
            description: undefined,
            custom: true,
          },
        ]
      : []),
  ]
  // Height per item: label + description only for focused item + custom input row
  const hs = items.map((item, i) => {
    const isFocused = i === (typing && showCustom ? opts.length : optIdx)
    const lead = wraps(item.label, label)
    const tail = isFocused && item.description ? wraps(item.description, desc) : 0
    const input = item.custom && typing ? 1 : 0
    return lead + tail + input
  })
  const top = 1 + 1 + wraps(question.question, text) + 1 + 1
  const list = Math.max(1, rows - top)
  const focus = typing && showCustom ? opts.length : optIdx
  const win = questionWin(hs, focus, list)
  const pick = (text: string) => {
    const next = text.trim()
    if (!next) return
    advance([next])
    setCustom("")
    setTyping(false)
  }

  return (
    <Box flexDirection="column" width={columns} paddingX={2} paddingTop={1} paddingBottom={1} flexShrink={0}>
      <Box marginBottom={1}>
        <Text backgroundColor={theme.cyan} color={theme.base}>
          {` ${head} `}
        </Text>
        <Text color={theme.overlay}> answer below</Text>
      </Box>

      <Text color={theme.text} wrap="wrap">
        {question.question}
      </Text>

      <Box marginTop={1} height={list} flexDirection="column">
        {items.slice(win.start, win.end).map((item, off) => {
          const i = win.start + off
          const sel = i === optIdx && !typing
          const own = item.custom
          const active = own && (optIdx === opts.length || typing)
          const focused = sel || active
          return (
            <Box key={item.key} flexDirection="column" paddingLeft={2}>
              <Box>
                <Text color={focused ? theme.cyan : theme.overlay}>{focused ? "> " : "  "}</Text>
                <Text color={focused ? theme.text : own ? theme.overlay : theme.subtext} bold={focused} wrap="wrap">
                  {item.label}
                </Text>
              </Box>
              {focused && item.description && (
                <Box paddingLeft={4}>
                  <Text color={theme.subtext} wrap="wrap">
                    {item.description}
                  </Text>
                </Box>
              )}
              {own && typing ? (
                <Box paddingLeft={4}>
                  <TextInput
                    key={`${request.id}:${qIdx}`}
                    defaultValue={custom}
                    placeholder="Type your answer..."
                    onChange={setCustom}
                    onSubmit={pick}
                  />
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>

    </Box>
  )
}
