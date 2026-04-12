import React, { useState, useEffect } from "react"
import { Text } from "ink"
import { theme } from "../theme"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface SpinnerProps {
  label?: string
}

export function Spinner({ label }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color={theme.yellow}>
      {FRAMES[frame]}
      {label}
    </Text>
  )
}
