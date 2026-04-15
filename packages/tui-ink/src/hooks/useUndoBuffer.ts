import { useEffect, useRef } from "react"

type Snap = {
  text: string
  cursor: number
}

function same(a: Snap | undefined, b: Snap) {
  return a?.text === b.text && a.cursor === b.cursor
}

export function undoState(stack: Snap[], text: string, cursor: number) {
  const snap = { text, cursor }
  const list = same(stack.at(-1), snap) ? stack.slice(0, -1) : [...stack]
  const prev = list.at(-1)
  return {
    prev: prev ?? (!text && cursor === 0 ? undefined : { text: "", cursor: 0 }),
    stack: prev ? list.slice(0, -1) : [],
  }
}

export function useUndoBuffer(text: string, cursor: number, wait = 800) {
  const stack = useRef<Snap[]>([{ text, cursor }])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const snap = { text, cursor }
      if (same(stack.current.at(-1), snap)) return
      stack.current = [...stack.current, snap].slice(-50)
    }, wait)

    return () => {
      clearTimeout(timer.current)
    }
  }, [text, cursor, wait])

  const undo = () => {
    clearTimeout(timer.current)
    const next = undoState(stack.current, text, cursor)
    stack.current = next.stack
    return next.prev
  }

  return { undo }
}
