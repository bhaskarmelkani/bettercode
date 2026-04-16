import React, { useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { useTextInput } from "../hooks/useTextInput"
import { primaryKey, resolveAction } from "../keybindings"

interface Props {
  matchCount: number
  active: boolean
}

export function SearchBar({ matchCount, active }: Props) {
  const theme = useTheme()
  const { value, cursor, insert, del, deleteKey, clear, home, end, moveLeft, moveRight } = useTextInput()
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const matchIdx = useAppStore((s) => s.searchMatchIdx)
  const closeSearch = useAppStore((s) => s.closeSearch)
  const nextMatch = useAppStore((s) => s.nextSearchMatch)
  const prevMatch = useAppStore((s) => s.prevSearchMatch)
  const bindings = useAppStore((s) => s.keybindings)

  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  useInput(
    (input, key) => {
      const action = resolveAction(bindings, input, key, ["search"])

      if (action === "searchClose") {
        closeSearch()
        clear()
        return
      }
      if (action === "searchNext") {
        nextMatch()
        return
      }
      if (action === "searchPrev") {
        prevMatch()
        return
      }
      if (action === "home") {
        home()
        return
      }
      if (action === "end") {
        end()
        return
      }
      if (action === "moveLeft") {
        moveLeft()
        return
      }
      if (action === "moveRight") {
        moveRight()
        return
      }
      if (action === "backspace") {
        del()
        return
      }
      if (action === "delete") {
        deleteKey()
        return
      }
      if (key.ctrl || key.meta) return
      if (input) insert(input)
    },
    { isActive: active },
  )

  const label = matchCount === 0 ? " no matches" : ` ${Math.min(matchIdx + 1, matchCount)}/${matchCount}`
  const before = value.slice(0, cursor)
  const at = value[cursor] ?? " "
  const after = value.slice(cursor + 1)
  const next = primaryKey(bindings, "searchNext", ["search"])
  const prev = primaryKey(bindings, "searchPrev", ["search"])
  const close = primaryKey(bindings, "searchClose", ["search"])

  return (
    <Box height={1} flexDirection="row" paddingLeft={1}>
      <Text color={theme.cyan}>{"/ "}</Text>
      <Text color={theme.text}>{before}</Text>
      <Text backgroundColor={theme.cyan} color={theme.base}>
        {at}
      </Text>
      <Text color={theme.text}>{after}</Text>
      <Text color={matchCount === 0 ? theme.red : theme.overlay}>{label}</Text>
      <Text color={theme.overlay}>{` · ${next}: next · ${prev}: prev · ${close}: close`}</Text>
    </Box>
  )
}
