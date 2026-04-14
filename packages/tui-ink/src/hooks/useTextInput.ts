import { useState } from "react"

// Pure helpers — exported for testing.
// M5 will add cursor-aware variants; these are the append-only baseline.

export function textInsert(value: string, input: string): string {
  return value + input
}

export function textDel(value: string): string {
  return value.slice(0, -1)
}

/**
 * Minimal text-editing state for the Composer.
 * Owns only `value` + the three primitive mutations.
 * Mention, slash, stash, history, and submit logic stay in Composer.
 */
export function useTextInput(initial = "") {
  const [value, setValue] = useState(initial)

  const insert = (input: string) => setValue((v) => textInsert(v, input))
  const del = () => setValue((v) => textDel(v))
  const clear = () => setValue("")

  return { value, setValue, insert, del, clear }
}
