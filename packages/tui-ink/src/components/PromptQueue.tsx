import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import type { PromptQueueItem } from "../store"

const MAX_VISIBLE = 5
const TRUNCATE = 50

interface Props {
  items: PromptQueueItem[]
  width: number
}

export function PromptQueue({ items, width }: Props) {
  const theme = useTheme()

  const visible = items.slice(0, MAX_VISIBLE)
  const overflow = items.length - MAX_VISIBLE

  return (
    <Box flexDirection="column" flexShrink={0}>
      {/* Header row */}
      <Box paddingLeft={2}>
        <Text color={theme.yellow} bold>
          Queue ({items.length})
        </Text>
      </Box>
      {/* Item rows */}
      {visible.map((item, i) => {
        const preview = item.text.length > TRUNCATE ? item.text.slice(0, TRUNCATE) + "…" : item.text
        const available = Math.max(0, width - 5)
        const truncated = preview.length > available ? preview.slice(0, available - 1) + "…" : preview
        return (
          <Box key={item.id} flexDirection="row" paddingLeft={2}>
            <Text color={theme.overlay}>{i + 1}. </Text>
            <Text color={theme.subtext}>{truncated}</Text>
          </Box>
        )
      })}
      {overflow > 0 && (
        <Box paddingLeft={2}>
          <Text color={theme.overlay} dimColor>
            +{overflow} more
          </Text>
        </Box>
      )}
    </Box>
  )
}

/** Number of rows the queue UI occupies (header + items, capped at MAX_VISIBLE). */
export function queueRows(count: number) {
  return count > 0 ? 1 + Math.min(MAX_VISIBLE, count) : 0
}
