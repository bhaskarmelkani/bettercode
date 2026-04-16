/**
 * useVimMode — vim state machine for the Composer input.
 *
 * Integrates with useTextInput by intercepting key presses in normal mode
 * and delegating to insert-mode handling when mode==="insert".
 *
 * Returns { vimMode, handleVimInput } where handleVimInput(input, key, input)
 * returns true if the key was consumed (normal/visual mode), false if it should
 * fall through to the standard insert-mode handler.
 */
import { useRef, useState } from "react"
import {
  initialVimState,
  type VimMode,
  type VimState,
} from "../vim/types"
import {
  motionH, motionL,
  motionW, motionB, motionE,
  motionWW, motionBB, motionEE,
  motion0, motionCaret, motionDollar,
  motionJ, motionK, motionGG, motionG,
  motionF, motionFF, motionT, motionTT,
  objectIW, objectAW,
  objectIQ, objectAQ,
  objectIB, objectAB,
} from "../vim/motions"
import {
  applyDelete, applyChange, applyYank,
  applyLineDelete, applyLineYank,
  applyPaste, applyPasteAfter,
} from "../vim/operators"

// Re-export so callers only import from here
export type { VimMode }

type Key = {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  return?: boolean
  escape?: boolean
  backspace?: boolean
  delete?: boolean
  upArrow?: boolean
  downArrow?: boolean
  leftArrow?: boolean
  rightArrow?: boolean
}

type StateCtx = {
  value: string
  cursor: number
}

type Setter = (value: string, cursor: number) => void

export function useVimMode(enabled: boolean) {
  const [vimState, setVimState] = useState<VimState>(initialVimState)

  // Keep a ref for synchronous reads inside handlers
  const ref = useRef<VimState>(vimState)
  ref.current = vimState

  function update(patch: Partial<VimState>) {
    setVimState((s) => {
      const next = { ...s, ...patch }
      ref.current = next
      return next
    })
  }

  function countN(): number {
    const n = parseInt(ref.current.count || "1", 10)
    return isNaN(n) || n < 1 ? 1 : n
  }

  function clearCount() {
    update({ count: "" })
  }

  // Resolve motion key to a new cursor, or return null if not a motion.
  function resolveMotion(text: string, cursor: number, input: string, key: Key, count: number): number | null {
    if (!key.ctrl && !key.meta) {
      switch (input) {
        case "h": return motionH(text, cursor, count)
        case "l": return motionL(text, cursor, count)
        case "j": return motionJ(text, cursor, count)
        case "k": return motionK(text, cursor, count)
        case "w": return motionW(text, cursor, count)
        case "b": return motionB(text, cursor, count)
        case "e": return motionE(text, cursor, count)
        case "W": return motionWW(text, cursor, count)
        case "B": return motionBB(text, cursor, count)
        case "E": return motionEE(text, cursor, count)
        case "0": return motion0(text, cursor)
        case "^": return motionCaret(text, cursor)
        case "$": return motionDollar(text, cursor, count)
        case "G": return motionG(text)
      }
    }
    return null
  }

  /**
   * Main entry point.
   *
   * Returns true if the key was fully handled in vim normal/visual mode
   * (caller should NOT pass it on to insert-mode logic).
   * Returns false if in insert mode (caller handles it normally).
   */
  function handleVimInput(
    ctx: StateCtx,
    input: string,
    key: Key,
    set: Setter,
  ): boolean {
    if (!enabled) return false
    const state = ref.current

    // ── insert mode ─────────────────────────────────────────────────────────
    if (state.mode === "insert") {
      if (key.escape) {
        // Escape → normal mode; also save inserted text for dot-repeat
        const inserted = state.insertCapture
        update({
          mode: "normal",
          count: "",
          operator: null,
          findPending: null,
          insertCapture: "",
          lastEdit: state.lastEdit
            ? { ...state.lastEdit, inserted }
            : null,
        })
        // Move cursor back one position (vim convention) unless at line start
        const { value, cursor } = ctx
        const ls = value.lastIndexOf("\n", cursor - 1)
        const lineStartPos = ls === -1 ? 0 : ls + 1
        if (cursor > lineStartPos) {
          set(value, cursor - 1)
        }
        return true
      }
      // capture for dot-repeat
      if (!key.ctrl && !key.meta && !key.escape && !key.return && !key.backspace && !key.delete) {
        update({ insertCapture: state.insertCapture + input })
      }
      return false // let insert-mode handler process it
    }

    // ── operator-pending mode ────────────────────────────────────────────────
    if (state.mode === "operator-pending") {
      return handleOperatorPending(ctx, input, key, set, state)
    }

    // ── find-char pending ────────────────────────────────────────────────────
    if (state.findPending) {
      const ft = state.findPending
      const ch = input
      update({ findPending: null, lastFind: { ch, type: ft }, count: "" })
      const { value, cursor } = ctx
      const count = countN()
      let dest = cursor
      if (ft === "f") dest = motionF(value, cursor, ch, count)
      else if (ft === "F") dest = motionFF(value, cursor, ch, count)
      else if (ft === "t") dest = motionT(value, cursor, ch, count)
      else if (ft === "T") dest = motionTT(value, cursor, ch, count)
      set(value, dest)
      return true
    }

    // ── normal mode ──────────────────────────────────────────────────────────
    return handleNormal(ctx, input, key, set, state)
  }

  function handleNormal(
    ctx: StateCtx,
    input: string,
    key: Key,
    set: Setter,
    state: VimState,
  ): boolean {
    const { value, cursor } = ctx

    // Arrow keys work as h/j/k/l in normal mode
    if (key.leftArrow) { set(value, motionH(value, cursor)); return true }
    if (key.rightArrow) { set(value, motionL(value, cursor)); return true }
    if (key.upArrow) { set(value, motionK(value, cursor)); return true }
    if (key.downArrow) { set(value, motionJ(value, cursor)); return true }

    if (key.ctrl || key.meta) return false

    // Digit accumulation
    if (/^[1-9]$/.test(input) || (input === "0" && state.count !== "")) {
      update({ count: state.count + input })
      return true
    }

    const count = countN()

    // ── motions ──────────────────────────────────────────────────────────────
    const dest = resolveMotion(value, cursor, input, key, count)
    if (dest !== null && !state.operator) {
      clearCount()
      set(value, dest)
      return true
    }

    // 'g' + 'g' → top
    if (input === "g") {
      update({ count: "", operator: null })
      // peek: wait for second 'g' — encode via a temporary operator-pending variant
      // Use operator='g' as sentinel
      update({ operator: "g", mode: "operator-pending" })
      return true
    }

    // find chars
    if (input === "f" || input === "F" || input === "t" || input === "T") {
      update({ findPending: input as "f" | "F" | "t" | "T" })
      return true
    }

    // ; repeat last find
    if (input === ";") {
      if (state.lastFind) {
        const { ch, type } = state.lastFind
        let d = cursor
        if (type === "f") d = motionF(value, cursor, ch, count)
        else if (type === "F") d = motionFF(value, cursor, ch, count)
        else if (type === "t") d = motionT(value, cursor, ch, count)
        else if (type === "T") d = motionTT(value, cursor, ch, count)
        clearCount(); set(value, d)
      }
      return true
    }

    // , reverse last find
    if (input === ",") {
      if (state.lastFind) {
        const { ch, type } = state.lastFind
        const rev: Record<string, "f" | "F" | "t" | "T"> = { f: "F", F: "f", t: "T", T: "t" }
        const revType = rev[type]!
        let d = cursor
        if (revType === "f") d = motionF(value, cursor, ch, count)
        else if (revType === "F") d = motionFF(value, cursor, ch, count)
        else if (revType === "t") d = motionT(value, cursor, ch, count)
        else if (revType === "T") d = motionTT(value, cursor, ch, count)
        clearCount(); set(value, d)
      }
      return true
    }

    // ── operators ────────────────────────────────────────────────────────────
    if (input === "d" || input === "c" || input === "y") {
      update({ operator: input, mode: "operator-pending", count: state.count })
      return true
    }

    // ── dd / cc / yy (line-wise doubled operator) handled in operator-pending ─

    // ── p / P ────────────────────────────────────────────────────────────────
    if (input === "p") {
      if (state.register) {
        const { text, cursor: c } = applyPasteAfter(value, cursor, state.register)
        clearCount(); set(text, c)
      }
      return true
    }
    if (input === "P") {
      if (state.register) {
        const { text, cursor: c } = applyPaste(value, cursor, state.register)
        clearCount(); set(text, c)
      }
      return true
    }

    // ── x — delete char under cursor ─────────────────────────────────────────
    if (input === "x") {
      const { text, cursor: c, yanked } = applyDelete(value, cursor, cursor + count)
      update({ register: yanked, count: "" })
      set(text, c)
      return true
    }

    // ── X — delete char before cursor ────────────────────────────────────────
    if (input === "X") {
      if (cursor === 0) return true
      const { text, cursor: c, yanked } = applyDelete(value, cursor - count, cursor)
      update({ register: yanked, count: "" })
      set(text, c)
      return true
    }

    // ── r{ch} — replace char under cursor ────────────────────────────────────
    // (handled via a two-keystroke approach; use operator='r' sentinel)
    if (input === "r") {
      update({ operator: "r", mode: "operator-pending" })
      return true
    }

    // ── s — substitute char (delete + insert) ────────────────────────────────
    if (input === "s") {
      const { text, cursor: c } = applyDelete(value, cursor, cursor + count)
      update({
        register: value.slice(cursor, cursor + count),
        count: "",
        mode: "insert",
        operator: null,
        insertCapture: "",
        lastEdit: { operator: "s", motion: "", extra: "", inserted: "" },
      })
      set(text, c)
      return true
    }

    // ── S — substitute line ───────────────────────────────────────────────────
    if (input === "S") {
      const lineS = value.lastIndexOf("\n", cursor - 1)
      const lineE = value.indexOf("\n", cursor)
      const ls = lineS === -1 ? 0 : lineS + 1
      const le = lineE === -1 ? value.length : lineE
      const { text, cursor: c } = applyDelete(value, ls, le)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "S", motion: "", extra: "", inserted: "" } })
      set(text, c)
      return true
    }

    // ── mode transitions ─────────────────────────────────────────────────────
    if (input === "i") {
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "i", motion: "", extra: "", inserted: "" } })
      return true
    }
    if (input === "a") {
      // insert after cursor
      const newCursor = Math.min(cursor + 1, value.length)
      set(value, newCursor)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "a", motion: "", extra: "", inserted: "" } })
      return true
    }
    if (input === "I") {
      // insert at first non-blank of line
      const dest = motionCaret(value, cursor)
      set(value, dest)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "I", motion: "", extra: "", inserted: "" } })
      return true
    }
    if (input === "A") {
      // insert at end of line
      const dest = lineEndPos(value, cursor)
      set(value, dest)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "A", motion: "", extra: "", inserted: "" } })
      return true
    }
    if (input === "o") {
      // open line below
      const le = value.indexOf("\n", cursor)
      const pos = le === -1 ? value.length : le
      const next = value.slice(0, pos) + "\n" + value.slice(pos)
      set(next, pos + 1)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "o", motion: "", extra: "", inserted: "" } })
      return true
    }
    if (input === "O") {
      // open line above
      const prev = value.lastIndexOf("\n", cursor - 1)
      const pos = prev === -1 ? 0 : prev + 1
      const next = value.slice(0, pos) + "\n" + value.slice(pos)
      set(next, pos)
      update({ mode: "insert", count: "", operator: null, insertCapture: "", lastEdit: { operator: "O", motion: "", extra: "", inserted: "" } })
      return true
    }

    // ── dot-repeat ───────────────────────────────────────────────────────────
    if (input === ".") {
      replayLastEdit(ctx, set, state)
      return true
    }

    // ── tilde — toggle case ──────────────────────────────────────────────────
    if (input === "~") {
      const ch = value[cursor]
      if (ch) {
        const toggled = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
        const next = value.slice(0, cursor) + toggled + value.slice(cursor + 1)
        const nc = Math.min(cursor + 1, next.length - 1)
        clearCount(); set(next, Math.max(0, nc))
      }
      return true
    }

    // ── ctrl+r — redo (placeholder, currently just clears count) ─────────────
    if (key.ctrl && input === "r") {
      clearCount()
      return true
    }

    // ── u — undo (delegate to useTextInput.undo via false return) ────────────
    // We return false so the Composer's undo handler fires.
    if (input === "u" && !key.ctrl) {
      clearCount()
      return false // let normal undo run
    }

    // anything else in normal mode: consume silently
    clearCount()
    return true
  }

  function handleOperatorPending(
    ctx: StateCtx,
    input: string,
    key: Key,
    set: Setter,
    state: VimState,
  ): boolean {
    const { value, cursor } = ctx
    const op = state.operator
    const count = countN()

    // Escape — cancel operator
    if (key.escape) {
      update({ mode: "normal", operator: null, count: "" })
      return true
    }

    // 'g' sentinel: waiting for second 'g'
    if (op === "g") {
      if (input === "g") {
        const dest = motionGG(value)
        update({ mode: "normal", operator: null, count: "" })
        set(value, dest)
      } else {
        update({ mode: "normal", operator: null, count: "" })
      }
      return true
    }

    // 'r' sentinel: waiting for replacement char
    if (op === "r") {
      if (!key.ctrl && !key.meta && input.length === 1) {
        let next = value
        for (let i = 0; i < count; i++) {
          if (cursor + i < next.length) {
            next = next.slice(0, cursor + i) + input + next.slice(cursor + i + 1)
          }
        }
        set(next, cursor)
      }
      update({ mode: "normal", operator: null, count: "" })
      return true
    }

    if (!op) {
      update({ mode: "normal", operator: null, count: "" })
      return true
    }

    // Line-wise doubled operator (dd, cc, yy)
    if (input === op) {
      if (op === "d" || op === "c") {
        let v = value, c = cursor
        for (let i = 0; i < count; i++) {
          const res = applyLineDelete(v, c)
          v = res.text; c = res.cursor
        }
        const yanked = value // rough yank
        update({ register: yanked, mode: op === "c" ? "insert" : "normal", operator: null, count: "" })
        set(v, c)
      } else if (op === "y") {
        const res = applyLineYank(value, cursor)
        update({ register: res.yanked, mode: "normal", operator: null, count: "" })
      }
      return true
    }

    // Text object motions: iw, aw, i", a", i(, a(, etc.
    if (input === "i" || input === "a") {
      update({ operator: op + input }) // accumulate 'di', 'ci', etc.
      return true
    }

    // Second char of text object
    const twoKey = op.length === 2 ? op[1] : null
    if (twoKey === "i" || twoKey === "a") {
      const inner = twoKey === "i"
      const baseOp = op[0]!
      let range: [number, number] | null = null
      if (input === "w") range = inner ? objectIW(value, cursor) : objectAW(value, cursor)
      else if (input === '"' || input === "'" || input === "`") range = inner ? objectIQ(value, cursor, input) : objectAQ(value, cursor, input)
      else if (input === "(") range = inner ? objectIB(value, cursor, "(", ")") : objectAB(value, cursor, "(", ")")
      else if (input === ")") range = inner ? objectIB(value, cursor, "(", ")") : objectAB(value, cursor, "(", ")")
      else if (input === "{") range = inner ? objectIB(value, cursor, "{", "}") : objectAB(value, cursor, "{", "}")
      else if (input === "}") range = inner ? objectIB(value, cursor, "{", "}") : objectAB(value, cursor, "{", "}")
      else if (input === "[") range = inner ? objectIB(value, cursor, "[", "]") : objectAB(value, cursor, "[", "]")
      else if (input === "]") range = inner ? objectIB(value, cursor, "[", "]") : objectAB(value, cursor, "[", "]")

      if (range) {
        const [from, to] = range
        if (baseOp === "d") {
          const res = applyDelete(value, from, to)
          update({ register: res.yanked, mode: "normal", operator: null, count: "" })
          set(res.text, res.cursor)
        } else if (baseOp === "c") {
          const res = applyChange(value, from, to)
          update({ register: res.yanked, mode: "insert", operator: null, count: "", insertCapture: "", lastEdit: { operator: "c", motion: twoKey + input, extra: "", inserted: "" } })
          set(res.text, res.cursor)
        } else if (baseOp === "y") {
          const res = applyYank(value, from, to, cursor)
          update({ register: res.yanked, mode: "normal", operator: null, count: "" })
        }
      } else {
        update({ mode: "normal", operator: null, count: "" })
      }
      return true
    }

    // Motion-based operators
    const dest = resolveMotion(value, cursor, input, key, count)
    if (dest !== null) {
      const [from, to] = dest < cursor ? [dest, cursor + 1] : [cursor, dest]
      if (op === "d") {
        const res = applyDelete(value, from, to)
        update({ register: res.yanked, mode: "normal", operator: null, count: "", lastEdit: { operator: "d", motion: input, extra: "", inserted: "" } })
        set(res.text, res.cursor)
      } else if (op === "c") {
        const res = applyChange(value, from, to)
        update({ register: res.yanked, mode: "insert", operator: null, count: "", insertCapture: "", lastEdit: { operator: "c", motion: input, extra: "", inserted: "" } })
        set(res.text, res.cursor)
      } else if (op === "y") {
        const res = applyYank(value, from, to, cursor)
        update({ register: res.yanked, mode: "normal", operator: null, count: "" })
      }
      return true
    }

    // find chars with operator
    if (input === "f" || input === "F" || input === "t" || input === "T") {
      update({ findPending: input as "f" | "F" | "t" | "T" })
      return true
    }

    // unrecognised — cancel
    update({ mode: "normal", operator: null, count: "" })
    return true
  }

  function replayLastEdit(ctx: StateCtx, set: Setter, state: VimState) {
    const last = state.lastEdit
    if (!last) return
    const { value, cursor } = ctx
    const { operator, motion, extra, inserted } = last
    const count = countN()

    if (operator === "i" || operator === "a" || operator === "I" || operator === "A") {
      // Re-enter insert mode and type the captured text
      // For dot-repeat, just insert the text at current position
      if (inserted) {
        const next = value.slice(0, cursor) + inserted + value.slice(cursor)
        clearCount()
        set(next, cursor + inserted.length)
      }
      return
    }

    if (operator === "d" && motion) {
      const dest = resolveMotion(value, cursor, motion, {}, count)
      if (dest !== null) {
        const [from, to] = dest < cursor ? [dest, cursor + 1] : [cursor, dest]
        const res = applyDelete(value, from, to)
        update({ register: res.yanked, count: "" })
        set(res.text, res.cursor)
      }
    }
  }

  function lineEndPos(text: string, cursor: number): number {
    const nl = text.indexOf("\n", cursor)
    return nl === -1 ? text.length : nl
  }

  return {
    vimMode: vimState.mode,
    vimEnabled: enabled,
    handleVimInput,
    enterInsert: () => update({ mode: "insert", insertCapture: "" }),
    enterNormal: () => update({ mode: "normal" }),
  }
}
