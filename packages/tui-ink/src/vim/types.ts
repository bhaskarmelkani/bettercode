export type VimMode = "normal" | "insert" | "visual" | "operator-pending"

export interface VimState {
  mode: VimMode
  // Accumulate digit prefix (e.g., "3" before "w" → move 3 words)
  count: string
  // Pending operator: 'd', 'c', 'y' (operator-pending mode)
  operator: string | null
  // Awaiting a find target character after f/F/t/T
  findPending: "f" | "F" | "t" | "T" | null
  // Last successful find for ; (repeat) and , (reverse)
  lastFind: { ch: string; type: "f" | "F" | "t" | "T" } | null
  // Content of the unnamed register (yank/delete)
  register: string
  // Last change operation for dot-repeat: { operator, motion, extra, inserted }
  lastEdit: {
    operator: string
    motion: string
    extra: string
    inserted: string
  } | null
  // Characters inserted since entering insert mode (for dot-repeat)
  insertCapture: string
}

export function initialVimState(): VimState {
  return {
    mode: "insert",
    count: "",
    operator: null,
    findPending: null,
    lastFind: null,
    register: "",
    lastEdit: null,
    insertCapture: "",
  }
}
