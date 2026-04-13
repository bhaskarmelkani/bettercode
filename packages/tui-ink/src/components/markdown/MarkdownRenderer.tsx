import React, { useMemo } from "react"
import { Box, Text } from "ink"
import { marked } from "marked"
import { useTheme } from "../../theme-context"
import { CodeBlock } from "./CodeBlock"
import { InlineText } from "./InlineText"
import type { Token } from "./types"

const opts = { gfm: true, breaks: true } as const

export function lex(text: string) {
  return marked.lexer(text, opts) as Token[]
}

interface Props {
  text: string
}

function isText(tok: Token) {
  return tok.type === "text" || tok.type === "escape" || tok.type === "html"
}

export function MarkdownRenderer({ text }: Props) {
  const theme = useTheme()
  const tokens = useMemo(() => lex(text), [text])

  const walk = (items: Token[], key: string): React.ReactNode[] => {
    return items.reduce<React.ReactNode[]>((out, tok, i) => {
      const id = `${key}-${i}`

      if (tok.type === "space") {
        return out
      }

      if (tok.type === "heading") {
        out.push(
          <Box key={id} marginTop={1}>
            <Text bold color={theme.lavender}>
              <InlineText tokens={tok.tokens ?? []} />
            </Text>
          </Box>,
        )
        return out
      }

      if (tok.type === "paragraph") {
        out.push(
          <Box key={id} marginTop={0}>
            <Text color={theme.text} wrap="wrap">
              <InlineText tokens={tok.tokens ?? []} />
            </Text>
          </Box>,
        )
        return out
      }

      if (tok.type === "code") {
        out.push(<CodeBlock key={id} lang={tok.lang} code={tok.text ?? ""} />)
        return out
      }

      if (tok.type === "list") {
        const items = tok.items ?? []
        out.push(
          <Box key={id} marginTop={1} flexDirection="column" flexShrink={0}>
            {items.map((item, idx) => {
              const mark = tok.ordered ? `${idx + 1}.` : "•"
              const body = item.tokens?.length ? (
                <Text color={theme.text} wrap="wrap">
                  <InlineText tokens={item.tokens} />
                </Text>
              ) : (
                <Text color={theme.text} wrap="wrap">
                  {item.raw ?? item.text ?? ""}
                </Text>
              )

              return (
                <Box key={`${id}-${idx}`} flexDirection="row" gap={1} marginTop={idx === 0 ? 0 : 1}>
                  <Text color={tok.ordered ? theme.mauve : theme.cyan}>{mark}</Text>
                  <Box flexDirection="column" flexShrink={1}>
                    {body}
                  </Box>
                </Box>
              )
            })}
          </Box>,
        )
        return out
      }

      if (tok.type === "blockquote") {
        out.push(
          <Box
            key={id}
            marginTop={1}
            paddingLeft={1}
            flexDirection="column"
            borderLeft={true}
            borderColor={theme.surface2}
            flexShrink={0}
          >
            {walk(tok.tokens ?? [], id)}
          </Box>,
        )
        return out
      }

      if (tok.type === "hr") {
        out.push(
          <Box key={id} marginTop={1}>
            <Text color={theme.surface2}>· · ·</Text>
          </Box>,
        )
        return out
      }

      if (isText(tok)) {
        out.push(tok.raw ?? tok.text ?? "")
        return out
      }

      if (tok.tokens?.length) {
        out.push(...walk(tok.tokens, id))
        return out
      }

      if (tok.items?.length) {
        out.push(...walk(tok.items, id))
        return out
      }

      out.push(tok.raw ?? tok.text ?? "")
      return out
    }, [])
  }

  if (tokens.length === 0) {
    return null
  }

  return <Box flexDirection="column">{walk(tokens, "m")}</Box>
}
