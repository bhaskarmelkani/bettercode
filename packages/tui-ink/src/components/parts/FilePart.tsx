import React from "react"
import { Box, Text } from "ink"
import type { FilePart } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"

interface Props {
  parts: FilePart[]
}

const MIME_BADGE: Record<string, string> = {
  "text/plain": "txt",
  "image/png": "img",
  "image/jpeg": "img",
  "image/gif": "img",
  "image/webp": "img",
  "application/pdf": "pdf",
  "application/x-directory": "dir",
}

function badge(mime: string) {
  return MIME_BADGE[mime] ?? mime.split("/")[1] ?? mime
}

export function FileParts({ parts }: Props) {
  const theme = useTheme()
  if (parts.length === 0) return null
  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap" marginTop={1}>
      {parts.map((f) => (
        <Box key={f.id} flexDirection="row">
          <Text backgroundColor={theme.mauve} color={theme.base}>
            {" "}
            {badge(f.mime)}{" "}
          </Text>
          <Text backgroundColor={theme.surface0} color={theme.subtext}>
            {" "}
            {f.filename}{" "}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
