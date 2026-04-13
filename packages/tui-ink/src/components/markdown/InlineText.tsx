import React from "react"
import { Text } from "ink"
import { useTheme } from "../../theme-context"
import type { Token } from "./types"

interface Props {
  tokens: Token[]
}

function walk(tokens: Token[], key: string, theme: ReturnType<typeof useTheme>): React.ReactNode[] {
  return tokens.reduce<React.ReactNode[]>((out, tok, i) => {
    const id = `${key}-${i}`

    if (tok.type === "strong") {
      out.push(<Text key={id} bold>{walk(tok.tokens ?? [], id, theme)}</Text>)
      return out
    }

    if (tok.type === "em") {
      out.push(<Text key={id} italic>{walk(tok.tokens ?? [], id, theme)}</Text>)
      return out
    }

    if (tok.type === "del") {
      out.push(<Text key={id} strikethrough>{walk(tok.tokens ?? [], id, theme)}</Text>)
      return out
    }

    if (tok.type === "codespan") {
      out.push(
        <Text key={id} backgroundColor={theme.surface0} color={theme.cyan}>
          {" "}
          {tok.text ?? tok.raw ?? ""}
          {" "}
        </Text>,
      )
      return out
    }

    if (tok.type === "link") {
      const text = tok.tokens?.length ? walk(tok.tokens, id, theme) : tok.text ?? tok.raw ?? tok.href ?? ""
      out.push(<Text key={id} color={theme.blue} underline>{text}</Text>)
      return out
    }

    if (tok.type === "br") {
      out.push("\n")
      return out
    }

    if (tok.type === "text" || tok.type === "escape" || tok.type === "html") {
      out.push(tok.raw ?? tok.text ?? "")
      return out
    }

    if (tok.tokens?.length) {
      out.push(...walk(tok.tokens, id, theme))
      return out
    }

    out.push(tok.raw ?? tok.text ?? "")
    return out
  }, [])
}

export function InlineText({ tokens }: Props) {
  const theme = useTheme()
  return <>{walk(tokens, "i", theme)}</>
}
