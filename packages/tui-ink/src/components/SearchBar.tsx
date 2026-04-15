import React, { useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { useTextInput } from "../hooks/useTextInput"

interface Props {
  matchCount: number
  active: boolean
}

export function SearchBar({ matchCount, active }: Props) {
  const theme = useTheme()
  const { value, cursor, insert, del, clear, home, end, moveLeft, moveRight } = useTextInput()
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const matchIdx = useAppStore((s) => s.searchMatchIdx)
  const closeSearch = useAppStore((s) => s.closeSearch)
  const nextMatch = useAppStore((s) => s.nextSearchMatch)
  const prevMatch = useAppStore((s) => s.prevSearchMatch)

  useEffect(() => {
    setSearchQuery(value)
  }, [setSearchQuery, value])

  useInput(
    (input, key) => {
      if (key.escape) {
        closeSearch()
        clear()
        return
      }
      if (key.return) {
        nextMatch()
        return
      }
      if (key.ctrl && input === "n") {
        nextMatch()
        return
      }
      if (key.ctrl && input === "p") {
        prevMatch()
        return
      }
      if (key.ctrl && input === "a") {
        home()
        return
      }
      if (key.ctrl && input === "e") {
        end()
        return
      }
      if (key.leftArrow) {
        moveLeft()
        return
      }
      if (key.rightArrow) {
        moveRight()
        return
      }
      if (key.backspace) {
        del()
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

  return (
    <Box height={1} flexDirection="row" paddingLeft={1}>
      <Text color={theme.cyan}>{"/ "}</Text>
      <Text color={theme.text}>{before}</Text>
      <Text backgroundColor={theme.cyan} color={theme.base}>
        {at}
      </Text>
      <Text color={theme.text}>{after}</Text>
      <Text color={matchCount === 0 ? theme.red : theme.overlay}>{label}</Text>
      <Text color={theme.overlay}>{" · enter/ctrl+n: next · ctrl+p: prev · esc: close"}</Text>
    </Box>
  )
}
