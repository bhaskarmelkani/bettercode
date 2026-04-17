import React, { useEffect, useRef } from "react"
import { Box, Text } from "ink"
import { useTheme } from "./theme-context"
import { useAppStore } from "./store"

const ENABLED = process.env.BETTERCODE_PERF_HUD === "1"

// Rolling FPS counter — updated every re-render.
let _frameCount = 0
let _fpsWindow: number[] = []
let _lastFpsUpdate = Date.now()

export function recordFrame() {
  _frameCount++
  const now = Date.now()
  if (now - _lastFpsUpdate >= 1000) {
    _fpsWindow.push(_frameCount)
    if (_fpsWindow.length > 5) _fpsWindow.shift()
    _frameCount = 0
    _lastFpsUpdate = now
  }
}

function avgFps() {
  if (_fpsWindow.length === 0) return 0
  return Math.round(_fpsWindow.reduce((a, b) => a + b, 0) / _fpsWindow.length)
}

// Module-level keystroke timestamp — set by Composer on keypress.
let _keystrokeTs = 0

export function recordKeystroke() {
  _keystrokeTs = performance.now()
}

// Called after the React commit that includes the new value.
export function recordPaint(): number {
  if (_keystrokeTs === 0) return 0
  const latency = performance.now() - _keystrokeTs
  _keystrokeTs = 0
  return Math.round(latency)
}

export function PerfHud({
  sseFlushInterval,
  visibleMessages,
  totalMessages,
  latency,
}: {
  sseFlushInterval: number
  visibleMessages: number
  totalMessages: number
  latency: number
}) {
  if (!ENABLED) return null
  const theme = useTheme()
  const fps = avgFps()

  return (
    <Box
      position="absolute"
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.surface2}
      paddingX={1}
    >
      <Text color={theme.overlay} dimColor>
        {`FPS:${fps} KP:${latency}ms SSE:${sseFlushInterval}ms V:${visibleMessages}/${totalMessages}`}
      </Text>
    </Box>
  )
}
