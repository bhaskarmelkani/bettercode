// Pure cursor-movement functions for vim motions.
// Each returns the new cursor position.

// ─── helpers ──────────────────────────────────────────────────────────────────

function isWordChar(ch: string) {
  return /\w/.test(ch)
}
function isWORDChar(ch: string) {
  return ch !== " " && ch !== "\t" && ch !== "\n" && ch !== undefined
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

// Return the start index of the current line (0-indexed byte offset).
function lineStart(text: string, cursor: number): number {
  const prev = text.lastIndexOf("\n", cursor - 1)
  return prev === -1 ? 0 : prev + 1
}

// Return the end index of the current line (exclusive, before newline or EOF).
function lineEnd(text: string, cursor: number): number {
  const next = text.indexOf("\n", cursor)
  return next === -1 ? text.length : next
}

// ─── character motions ────────────────────────────────────────────────────────

export function motionH(text: string, cursor: number, count = 1): number {
  // h — move left, but not before line start
  const ls = lineStart(text, cursor)
  return Math.max(ls, cursor - count)
}

export function motionL(text: string, cursor: number, count = 1): number {
  // l — move right, but not past last char on line (normal-mode: not onto newline)
  const le = lineEnd(text, cursor)
  // In normal mode the cursor sits on a char; max col is le-1 (or le when line is empty)
  const max = le === lineStart(text, cursor) ? le : Math.max(lineStart(text, cursor), le - 1)
  return Math.min(max, cursor + count)
}

// ─── word motions ─────────────────────────────────────────────────────────────

// 'w' — forward to next word start
export function motionW(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const cur = text[c]
    if (cur !== undefined && isWordChar(cur)) {
      // skip current word
      while (c < text.length && text[c] !== "\n" && isWordChar(text[c]!)) c++
    } else if (cur !== undefined && cur !== " " && cur !== "\t" && cur !== "\n") {
      // skip punctuation run
      while (c < text.length && text[c] !== "\n" && !isWordChar(text[c]!) && text[c] !== " " && text[c] !== "\t") c++
    }
    // skip whitespace / newlines
    while (c < text.length && (text[c] === " " || text[c] === "\t" || text[c] === "\n")) c++
  }
  return Math.min(c, text.length - 1)
}

// 'b' — backward to previous word start
export function motionB(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    // skip whitespace backward
    while (c > 0 && (text[c - 1] === " " || text[c - 1] === "\t" || text[c - 1] === "\n")) c--
    if (c === 0) break
    if (isWordChar(text[c - 1]!)) {
      while (c > 0 && isWordChar(text[c - 1]!)) c--
    } else {
      while (c > 0 && !isWordChar(text[c - 1]!) && text[c - 1] !== " " && text[c - 1] !== "\t" && text[c - 1] !== "\n") c--
    }
  }
  return Math.max(0, c)
}

// 'e' — forward to end of current/next word
export function motionE(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    // if already at end of word, step forward first
    c++
    // skip whitespace
    while (c < text.length && (text[c] === " " || text[c] === "\t" || text[c] === "\n")) c++
    if (c >= text.length) { c = text.length - 1; break }
    if (isWordChar(text[c]!)) {
      while (c + 1 < text.length && isWordChar(text[c + 1]!)) c++
    } else {
      while (c + 1 < text.length && !isWordChar(text[c + 1]!) && text[c + 1] !== " " && text[c + 1] !== "\t" && text[c + 1] !== "\n") c++
    }
  }
  return Math.max(0, Math.min(c, text.length - 1))
}

// 'W' — forward to next WORD start (WORD = non-whitespace)
export function motionWW(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    while (c < text.length && isWORDChar(text[c]!)) c++
    while (c < text.length && !isWORDChar(text[c]!)) c++
  }
  return Math.min(c, text.length - 1)
}

// 'B' — backward to previous WORD start
export function motionBB(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    while (c > 0 && !isWORDChar(text[c - 1]!)) c--
    while (c > 0 && isWORDChar(text[c - 1]!)) c--
  }
  return Math.max(0, c)
}

// 'E' — forward to end of WORD
export function motionEE(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    c++
    while (c < text.length && !isWORDChar(text[c]!)) c++
    while (c + 1 < text.length && isWORDChar(text[c + 1]!)) c++
  }
  return Math.max(0, Math.min(c, text.length - 1))
}

// ─── line motions ─────────────────────────────────────────────────────────────

// '0' — hard line start
export function motion0(text: string, cursor: number): number {
  return lineStart(text, cursor)
}

// '^' — first non-blank on line
export function motionCaret(text: string, cursor: number): number {
  const ls = lineStart(text, cursor)
  const le = lineEnd(text, cursor)
  let c = ls
  while (c < le && (text[c] === " " || text[c] === "\t")) c++
  return c
}

// '$' — line end (last char, not newline)
export function motionDollar(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const le = lineEnd(text, c)
    if (i < count - 1) {
      // move to start of next line
      c = le < text.length ? le + 1 : le
    } else {
      // land on last char of line
      c = le > lineStart(text, c) ? le - 1 : le
    }
  }
  return c
}

// 'j' — down one line (same column)
export function motionJ(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const ls = lineStart(text, c)
    const col = c - ls
    const le = lineEnd(text, c)
    if (le >= text.length) break // already on last line
    const nextStart = le + 1
    const nextEnd = lineEnd(text, nextStart)
    c = Math.min(nextStart + col, Math.max(nextStart, nextEnd - 1))
  }
  return c
}

// 'k' — up one line (same column)
export function motionK(text: string, cursor: number, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const ls = lineStart(text, c)
    if (ls === 0) break // already on first line
    const col = c - ls
    const prevEnd = ls - 1
    const prevStart = lineStart(text, prevEnd)
    c = Math.min(prevStart + col, Math.max(prevStart, prevEnd - 1))
  }
  return c
}

// 'g'+'g' — first line, first char
export function motionGG(text: string): number {
  return 0
}

// 'G' — last line, first char
export function motionG(text: string): number {
  const last = text.lastIndexOf("\n")
  return last === -1 ? 0 : last + 1
}

// ─── find character ───────────────────────────────────────────────────────────

// f{ch} — inclusive forward find
export function motionF(text: string, cursor: number, ch: string, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const next = text.indexOf(ch, c + 1)
    if (next === -1 || text[next - 1] === "\n" || (next > cursor && text.slice(cursor, next).includes("\n"))) break
    c = next
  }
  return c
}

// F{ch} — inclusive backward find
export function motionFF(text: string, cursor: number, ch: string, count = 1): number {
  let c = cursor
  for (let i = 0; i < count; i++) {
    const prev = text.lastIndexOf(ch, c - 1)
    if (prev === -1) break
    // don't cross line boundaries
    if (text.slice(prev, c).includes("\n")) break
    c = prev
  }
  return c
}

// t{ch} — exclusive forward find (stops before ch)
export function motionT(text: string, cursor: number, ch: string, count = 1): number {
  const dest = motionF(text, cursor, ch, count)
  return dest !== cursor ? dest - 1 : cursor
}

// T{ch} — exclusive backward find (stops after ch)
export function motionTT(text: string, cursor: number, ch: string, count = 1): number {
  const dest = motionFF(text, cursor, ch, count)
  return dest !== cursor ? dest + 1 : cursor
}

// ─── text object ranges ───────────────────────────────────────────────────────
// Returns [start, end] (end exclusive) or null if no match found.

// 'iw' — inner word (just the word chars)
export function objectIW(text: string, cursor: number): [number, number] | null {
  if (!isWordChar(text[cursor] ?? "")) {
    // on a non-word char — select the non-word run
    let s = cursor, e = cursor
    while (s > 0 && !isWordChar(text[s - 1]!) && text[s - 1] !== " " && text[s - 1] !== "\n") s--
    while (e < text.length && !isWordChar(text[e]!) && text[e] !== " " && text[e] !== "\n") e++
    return [s, e]
  }
  let s = cursor, e = cursor
  while (s > 0 && isWordChar(text[s - 1]!)) s--
  while (e < text.length && isWordChar(text[e]!)) e++
  return [s, e]
}

// 'aw' — around word (word + trailing/leading space)
export function objectAW(text: string, cursor: number): [number, number] | null {
  const inner = objectIW(text, cursor)
  if (!inner) return null
  let [s, e] = inner
  // prefer trailing space
  if (e < text.length && text[e] === " ") {
    while (e < text.length && text[e] === " ") e++
  } else {
    while (s > 0 && text[s - 1] === " ") s--
  }
  return [s, e]
}

// Inner quote/bracket helper
function objectPair(text: string, cursor: number, open: string, close: string, inner: boolean): [number, number] | null {
  // search backward for open
  let s = cursor - 1
  while (s >= 0 && text[s] !== open && text[s] !== "\n") s--
  if (s < 0 || text[s] !== open) return null
  // search forward for close
  let e = cursor
  if (open === close) {
    // for quotes, scan forward from after s
    e = s + 1
    while (e < text.length && text[e] !== close && text[e] !== "\n") e++
    if (e >= text.length || text[e] !== close) return null
  } else {
    let depth = 1
    e = s + 1
    while (e < text.length && depth > 0) {
      if (text[e] === open) depth++
      if (text[e] === close) depth--
      if (depth > 0) e++
    }
    if (depth !== 0) return null
  }
  return inner ? [s + 1, e] : [s, e + 1]
}

export function objectIQ(text: string, cursor: number, q: string): [number, number] | null {
  return objectPair(text, cursor, q, q, true)
}
export function objectAQ(text: string, cursor: number, q: string): [number, number] | null {
  return objectPair(text, cursor, q, q, false)
}
export function objectIB(text: string, cursor: number, open: string, close: string): [number, number] | null {
  return objectPair(text, cursor, open, close, true)
}
export function objectAB(text: string, cursor: number, open: string, close: string): [number, number] | null {
  return objectPair(text, cursor, open, close, false)
}

// Export helpers for tests
export { lineStart, lineEnd, isWordChar, clamp }
