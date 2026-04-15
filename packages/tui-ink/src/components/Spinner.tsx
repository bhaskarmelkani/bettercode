import React, { useEffect, useMemo, useState } from "react"
import { Text } from "ink"
import { useTheme } from "../theme-context"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const STALL_MS = 3000
const TIMER_MS = 2000

interface SpinnerProps {
  label?: string
  backgroundColor?: string
  pulse?: number
  thinkingSince?: number | null
}

export function isStalled(now: number, pulse: number | undefined) {
  if (pulse === undefined) return false
  return now - pulse > STALL_MS
}

export function spinnerText(label: string | undefined, now: number, thinkingSince: number | null | undefined) {
  if (!label) return ""
  if (thinkingSince === null || thinkingSince === undefined) return label
  const span = now - thinkingSince
  if (span < TIMER_MS) return label
  return `${label} (${(span / 1000).toFixed(1)}s)`
}

export function glow(len: number, tick: number) {
  if (len <= 0) return []
  const pos = tick % len
  return Array.from({ length: len }, (_, i) => {
    const raw = Math.abs(pos - i)
    const dist = Math.min(raw, len - raw)
    if (dist === 0) return 2
    if (dist <= 2) return 1
    return 0
  })
}

export function Spinner({ label, backgroundColor, pulse, thinkingSince }: SpinnerProps) {
  const theme = useTheme()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((frame) => frame + 1)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const now = Date.now()
  const text = spinnerText(label, now, thinkingSince)
  const tone = isStalled(now, pulse) ? theme.red : theme.yellow
  const mask = useMemo(() => glow(text.length, tick), [text, tick])
  const frame = FRAMES[tick % FRAMES.length]

  return (
    <>
      <Text color={tone} backgroundColor={backgroundColor}>
        {frame}
      </Text>
      {text ? (
        <Text backgroundColor={backgroundColor}>
          {[...text].map((ch, i) => (
            <Text
              key={`${i}-${ch}`}
              color={tone}
              backgroundColor={backgroundColor}
              bold={mask[i] === 2}
              dimColor={mask[i] === 0}
            >
              {ch}
            </Text>
          ))}
        </Text>
      ) : null}
    </>
  )
}
