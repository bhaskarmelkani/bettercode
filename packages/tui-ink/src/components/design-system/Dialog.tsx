import React from "react"
import { Text } from "ink"
import { useTheme } from "../../theme-context"
import { Pane } from "./Pane"

interface Props {
  title: string
  rows?: number
  columns?: number
  meta?: React.ReactNode
  footer?: string
  children: React.ReactNode
}

export function Dialog({ title, rows, columns, meta, footer, children }: Props) {
  const theme = useTheme()

  return (
    <Pane
      title={title}
      rows={rows}
      columns={columns}
      meta={meta}
      footer={footer ? <Text color={theme.overlay}>{footer}</Text> : undefined}
    >
      {children}
    </Pane>
  )
}
