import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"

interface Props {
  onSubmit: (text: string) => void
  active?: boolean
}

export function InputBar({ onSubmit, active = true }: Props) {
  const theme = useTheme()
  const [value, setValue] = useState("")
  const [caretOn, setCaretOn] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setCaretOn((v) => !v), 530)
    return () => { clearInterval(t); setCaretOn(true) }
  }, [])

  useInput(
    (input, key) => {
      if (key.return) {
        if (!value.trim()) return
        onSubmit(value)
        setValue("")
        return
      }
      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1))
        return
      }
      if (key.ctrl || key.meta || key.escape) return
      if (input) setValue((v) => v + input)
    },
    { isActive: active },
  )

  return (
    <Box flexDirection="row">
      <Text color={theme.cyan}>› </Text>
      {value && <Text color={theme.text}>{value}</Text>}
      <Text backgroundColor={caretOn ? theme.cyan : undefined} color={theme.base}>{" "}</Text>
      {!value && <Text color={theme.overlay}>Type a message and press Enter...</Text>}
    </Box>
  )
}
