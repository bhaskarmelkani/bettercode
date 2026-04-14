import React from "react"
import { Box, Text } from "ink"

interface Props {
  label?: string
  children: React.ReactNode
}

interface State {
  err: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err: Error): State {
    return { err }
  }

  override render() {
    if (!this.state.err) return this.props.children
    const label = this.props.label ?? "component"
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="red" bold>
          ✗ {label} error
        </Text>
        <Text color="gray" wrap="truncate">
          {this.state.err.message}
        </Text>
        <Text color="gray">Reload the session to recover (ctrl+n → reopen).</Text>
      </Box>
    )
  }
}
