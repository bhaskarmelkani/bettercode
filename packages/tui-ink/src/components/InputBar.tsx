import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { SlashMenu, type SlashCommand } from "./SlashMenu"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import { useAppStore } from "../store"

interface Props {
  onSubmit: (text: string) => void
  active?: boolean
  columns?: number
}

export function InputBar({ onSubmit, active = true, columns = 80 }: Props) {
  const theme = useTheme()
  const [value, setValue] = useState("")
  const [caretOn, setCaretOn] = useState(true)
  const [slashIdx, setSlashIdx] = useState(0)

  const regCmds = useCommands()
  const storeCommands = useAppStore((s) => s.commands)

  useEffect(() => {
    const t = setInterval(() => setCaretOn((v) => !v), 530)
    return () => { clearInterval(t); setCaretOn(true) }
  }, [])

  const isSlash = value.startsWith("/")
  const query = isSlash ? value.slice(1).toLowerCase() : ""

  const regSlash: SlashCommand[] = regCmds
    .filter((c) => c.slash && c.enabled !== false)
    .map((c) => ({ name: c.slash!, description: c.description ?? c.label }))

  const allSlash: SlashCommand[] = [
    ...regSlash,
    ...storeCommands
      .filter((c) => c.name && !regSlash.find((r) => r.name === c.name))
      .map((c) => ({ name: c.name, description: c.description ?? "" })),
  ]

  const slashOptions = isSlash ? allSlash.filter((c) => c.name.startsWith(query)).slice(0, 5) : []
  const slashVisible = slashOptions.length > 0

  function handleSlashSelect(cmd: SlashCommand) {
    const reg = regCmds.find((c) => c.slash === cmd.name && c.enabled !== false)
    if (reg) {
      setValue("")
      setSlashIdx(0)
      registry.trigger(reg.id)
      return
    }
    setValue("/" + cmd.name + " ")
    setSlashIdx(0)
  }

  useInput(
    (input, key) => {
      if (key.tab && slashVisible) {
        const cmd = slashOptions[slashIdx]
        if (cmd) handleSlashSelect(cmd)
        return
      }

      if (key.upArrow && slashVisible) {
        setSlashIdx((i) => Math.max(0, i - 1))
        return
      }

      if (key.downArrow && slashVisible) {
        setSlashIdx((i) => Math.min(slashOptions.length - 1, i + 1))
        return
      }

      if (key.return) {
        if (slashVisible) {
          const cmd = slashOptions[slashIdx]
          if (cmd) handleSlashSelect(cmd)
          return
        }
        if (!value.trim()) return
        onSubmit(value)
        setValue("")
        setSlashIdx(0)
        return
      }

      if (key.escape) {
        if (slashVisible) {
          setValue("")
          setSlashIdx(0)
        }
        return
      }

      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1))
        setSlashIdx(0)
        return
      }

      if (key.ctrl || key.meta) return
      // Filter out terminal mouse escape sequences (SGR/X10 format, ESC stripped by Ink)
      if (input && (input.startsWith("[<") || input.startsWith("[M"))) return
      if (input) {
        setValue((v) => v + input)
        setSlashIdx(0)
      }
    },
    { isActive: active },
  )

  return (
    <Box flexDirection="column" position="relative">
      {/* Slash suggestions above separator */}
      {slashVisible && <SlashMenu width={columns} options={slashOptions} focused={slashIdx} />}

      {/* Blank line above separator for breathing space */}
      <Text> </Text>

      {/* Separator */}
      <Text color={theme.surface1}>{"─".repeat(columns)}</Text>

      {/* Input row */}
      <Box flexDirection="row">
        <Text color={theme.cyan}>› </Text>
        {value && <Text color={theme.text}>{value}</Text>}
        <Text backgroundColor={caretOn ? theme.cyan : undefined} color={theme.base}>{" "}</Text>
        {!value && <Text color={theme.overlay}>Type a message and press Enter...</Text>}
      </Box>
    </Box>
  )
}
