export interface Highlight {
  start: number
  end: number
  color: string
  bold?: boolean
}

export function computeHighlights(text: string): Highlight[] {
  const result: Highlight[] = []

  // /command at start of input — blue bold
  const slash = text.match(/^(\/\S+)/)
  if (slash) result.push({ start: 0, end: slash[1]!.length, color: "blue", bold: true })

  // @mentions anywhere — cyan bold
  for (const match of text.matchAll(/@(\S+)/g)) {
    result.push({ start: match.index!, end: match.index! + match[0].length, color: "cyan", bold: true })
  }

  return result
}
