import React from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { pluginRoutes } from "../plugins/routes"

interface Props {
  name: string
  params?: Record<string, unknown>
  rows: number
  columns: number
  active: boolean
}

export function PluginScreen({ name, params, rows, columns, active }: Props) {
  const theme = useTheme()
  const navigate = useAppStore((s) => s.navigate)
  const render = pluginRoutes.get(name)

  useInput(
    (_input, key) => {
      if (key.escape || (key.ctrl && _input === "h")) {
        navigate({ type: "home" })
      }
    },
    { isActive: active && !render },
  )

  if (render) {
    return (
      <Box width={columns} height={rows} flexDirection="column">
        {render(params ?? {})}
      </Box>
    )
  }

  return (
    <Box width={columns} height={rows} justifyContent="center" alignItems="center" flexDirection="column">
      <Text color={theme.red}>Unknown route: {name}</Text>
      <Text color={theme.subtext} dimColor>
        No plugin has registered this route.
      </Text>
      <Text color={theme.overlay}>Press Escape to go home.</Text>
    </Box>
  )
}
