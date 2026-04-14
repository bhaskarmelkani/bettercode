import React, { useState, useEffect } from "react"
import { Text } from "ink"
import { useTheme } from "../theme-context"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface SpinnerProps {
  label?: string
  backgroundColor?: string
}

export function Spinner({ label, backgroundColor }: SpinnerProps) {
  const theme = useTheme()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 120)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color={theme.yellow} backgroundColor={backgroundColor}>
      {FRAMES[frame]}
      {label}
    </Text>
  )
}
