import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  request: QuestionRequest
}

export function QuestionPrompt({ request }: Props) {
  const theme = useTheme()
  const reply = useAppStore((s) => s.replyQuestion)
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
      // Custom text input mode
      if (key.return) {
        advance([custom])
        setCustom("")
        setTyping(false)
        return
      }
      if (key.escape) {
        setTyping(false)
        setCustom("")
        return
      }
      if (key.backspace || key.delete) {
        setCustom((v) => v.slice(0, -1))
        return
      }
      if (!key.ctrl && !key.meta && input) setCustom((v) => v + input)
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
    }
  }

  if (!question) return null

  const opts = question.options ?? []
  const showCustom = question.custom !== false

  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
      borderStyle="single"
      borderLeft={true}
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      borderColor={theme.cyan}
      marginBottom={1}
      flexShrink={0}
    >
      <Text color={theme.cyan} bold>
        Question {request.questions.length > 1 ? `(${qIdx + 1}/${request.questions.length})` : ""}
      </Text>
      <Text color={theme.text}>{question.question}</Text>

      <Box marginTop={1} flexDirection="column">
        {opts.map((opt, i) => (
          <Box key={opt.label} flexDirection="row" gap={1}>
            <Text color={i === optIdx ? theme.cyan : theme.overlay}>{i === optIdx ? "▶" : " "}</Text>
            <Text color={i === optIdx ? theme.text : theme.subtext}>{opt.label}</Text>
            {opt.description && <Text color={theme.overlay}>{opt.description}</Text>}
          </Box>
        ))}
        {showCustom && (
          <Box flexDirection="row" gap={1}>
            <Text color={optIdx === opts.length ? theme.cyan : theme.overlay}>
              {optIdx === opts.length ? "▶" : " "}
            </Text>
            {typing ? (
              <Text color={theme.text}>
                {custom}
                <Text backgroundColor={theme.overlay} color={theme.base}>
                  {" "}
                </Text>
              </Text>
            ) : (
              <Text color={optIdx === opts.length ? theme.subtext : theme.overlay}>
                {typing ? custom : "Type a custom answer..."}
              </Text>
            )}
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.surface2} dimColor>
          ↑↓ navigate · enter select · esc reject
        </Text>
      </Box>
    </Box>
  )
}
