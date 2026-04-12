import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { theme } from "../theme"

interface InputBarProps {
  onSubmit: (text: string) => void
}

export function InputBar({ onSubmit }: InputBarProps) {
  const [value, setValue] = useState("")

  useInput((input, key) => {
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
    // Ignore control sequences
    if (key.ctrl || key.meta || key.escape) return
    if (input) setValue((v) => v + input)
  })

  return (
    <Box height={3} flexDirection="column" paddingTop={1}>
      <Box>
        <Text color={theme.cyan}>› </Text>
        <Text>{value || <Text color={theme.overlay}>Type a message and press Enter...</Text>}</Text>
      </Box>
    </Box>
  )
}
