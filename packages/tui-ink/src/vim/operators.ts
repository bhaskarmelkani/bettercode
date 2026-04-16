// Operator helpers — each returns [newText, newCursor, yanked] where yanked
// is the deleted/yanked text for the register.

export type OpResult = { text: string; cursor: number; yanked: string }

// Apply a deletion over [from, to) (to exclusive).
// cursor lands at from (clamped to text bounds).
export function applyDelete(text: string, from: number, to: number): OpResult {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const yanked = text.slice(lo, hi)
  const next = text.slice(0, lo) + text.slice(hi)
  const cursor = Math.min(lo, Math.max(0, next.length - 1))
  return { text: next, cursor, yanked }
}

// Change = delete + transition to insert.  Same as delete but caller must switch mode.
export function applyChange(text: string, from: number, to: number): OpResult {
  return applyDelete(text, from, to)
}

// Yank: no text mutation, just capture the range.
export function applyYank(text: string, from: number, to: number, cursor: number): OpResult {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return { text, cursor, yanked: text.slice(lo, hi) }
}

// Line-wise delete (dd / yy): removes the full current line including newline.
export function applyLineDelete(text: string, cursor: number): OpResult {
  const start = text.lastIndexOf("\n", cursor - 1)
  const ls = start === -1 ? 0 : start + 1
  const end = text.indexOf("\n", cursor)
  if (end === -1) {
    // last line — also remove the preceding newline if any
    const yanked = text.slice(ls)
    const next = ls > 0 ? text.slice(0, ls - 1) : ""
    return { text: next, cursor: Math.max(0, ls - 1), yanked }
  }
  const yanked = text.slice(ls, end + 1)
  const next = text.slice(0, ls) + text.slice(end + 1)
  return { text: next, cursor: Math.min(ls, Math.max(0, next.length - 1)), yanked }
}

export function applyLineYank(text: string, cursor: number): OpResult {
  const start = text.lastIndexOf("\n", cursor - 1)
  const ls = start === -1 ? 0 : start + 1
  const end = text.indexOf("\n", cursor)
  const yanked = end === -1 ? text.slice(ls) : text.slice(ls, end + 1)
  return { text, cursor, yanked }
}

// Paste before cursor
export function applyPaste(text: string, cursor: number, yanked: string): { text: string; cursor: number } {
  const next = text.slice(0, cursor) + yanked + text.slice(cursor)
  return { text: next, cursor: cursor + yanked.length - 1 }
}

// Paste after cursor
export function applyPasteAfter(text: string, cursor: number, yanked: string): { text: string; cursor: number } {
  const pos = cursor + 1
  const next = text.slice(0, pos) + yanked + text.slice(pos)
  return { text: next, cursor: pos + yanked.length - 1 }
}
