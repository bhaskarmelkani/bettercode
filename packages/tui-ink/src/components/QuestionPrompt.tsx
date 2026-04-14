import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { textDelKey } from "../hooks/useTextInput"

interface Props {
  request: QuestionRequest
  columns: number
}

export function QuestionPrompt({ request, columns }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyQuestion)
  // Track current question index and answers collected so far
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<string[][]>([])
  const [optIdx, setOptIdx] = useState(0)
  const [custom, setCustom] = useState("")
  const [cursor, setCursor] = useState(0)
  const [typing, setTyping] = useState(false)

  const question = request.questions[qIdx]

  useInput((input, key) => {
    if (!question) return

    if (typing) {
      // Custom text input mode
      if (key.return) {
        advance([custom])
        setCustom("")
        setCursor(0)
        setTyping(false)
        return
      }
      if (key.escape) {
        setTyping(false)
        setCustom("")
        setCursor(0)
        return
      }
      if (key.leftArrow) {
        setCursor((v) => Math.max(0, v - 1))
        return
      }
      if (key.rightArrow) {
        setCursor((v) => Math.min(custom.length, v + 1))
        return
      }
      if (key.ctrl && input === "a") {
        setCursor(0)
        return
      }
      if (key.ctrl && input === "e") {
        setCursor(custom.length)
        return
      }
      if (key.backspace) {
        if (cursor === 0) return
        setCustom((v) => v.slice(0, cursor - 1) + v.slice(cursor))
        setCursor((v) => Math.max(0, v - 1))
        return
      }
      if (key.delete) {
        const [next, pos] = textDelKey(custom, cursor)
        setCustom(next)
        setCursor(pos)
        return
      }
      if (!key.ctrl && !key.meta && input) {
        setCustom((v) => v.slice(0, cursor) + input + v.slice(cursor))
        setCursor((v) => v + input.length)
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
        setCursor(custom.length)
        return
      }
      const selected = opts[optIdx]?.label ?? ""
      advance([selected])
      return
    }
    if (key.escape) {
      // Reject the question
      useAppStore
        .getState()
        .client?.question.reject({ requestID: request.id })
        .catch(() => {})
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
      setCursor(0)
      setTyping(false)
    }
  }

  if (!question) return null

  const opts = question.options ?? []
  const showCustom = question.custom !== false
  const cmd = "question"
  const head = request.questions.length > 1 ? `${cmd} ${qIdx + 1}/${request.questions.length}` : cmd
  const cut = (s: string, n: number) => {
    if (n <= 0) return ""
    if (s.length <= n) return s
    if (n <= 3) return s.slice(0, n)
    return s.slice(0, n - 3) + "..."
  }
  const labelWidth = Math.min(24, Math.max(10, ...opts.map((opt) => opt.label.length + 1), showCustom ? 18 : 0))
  const render = (text: string, pos: number) => {
    const cut = text.slice(0, pos)
    const cur = text[pos] ?? " "
    const tail = text.slice(pos + 1)
    return (
      <Text color={theme.text}>
        {cut}
        <Text backgroundColor={theme.overlay} color={theme.base}>
          {cur}
        </Text>
        {tail}
      </Text>
    )
  }

  return (
    <Box flexDirection="column" width={columns} paddingX={2} paddingY={1} flexShrink={0}>
      <Box marginBottom={1}>
        <Text backgroundColor={theme.cyan} color={theme.base}>
          {` ${head} `}
        </Text>
        <Text color={theme.overlay}> answer below</Text>
      </Box>

      <Text color={theme.text} wrap="wrap">
        {question.question}
      </Text>

      <Box marginTop={1} flexDirection="column">
        {opts.map((opt, i) => {
          const sel = i === optIdx
          const name = cut(opt.label, labelWidth).padEnd(labelWidth, " ")
          const space = Math.max(0, columns - 4 - labelWidth - 2)
          const desc = cut(opt.description ?? "", space)
          return (
            <Text
              key={opt.label}
              backgroundColor={sel ? theme.surface2 : theme.mantle}
              color={sel ? theme.text : theme.subtext}
              wrap="truncate-end"
            >
              {` ${sel ? "▶" : " "} ${name}  ${desc}`.padEnd(Math.max(0, columns), " ")}
            </Text>
          )
        })}
        {showCustom && (
          <Text
            backgroundColor={optIdx === opts.length ? theme.surface2 : theme.mantle}
            color={typing ? theme.text : optIdx === opts.length ? theme.text : theme.overlay}
            wrap="truncate-end"
          >
            {` ${optIdx === opts.length ? "▶" : " "} `}
            {typing ? render(custom, cursor) : "Type a custom answer..."}
          </Text>
        )}
      </Box>

      <Box marginTop={1}>
        {typing ? (
          <Text color={theme.overlay}>←→ move · ctrl+a/e home/end · enter submit · esc cancel</Text>
        ) : (
          <Text color={theme.overlay}>↑↓ navigate · enter select · esc reject</Text>
        )}
      </Box>
    </Box>
  )
}
