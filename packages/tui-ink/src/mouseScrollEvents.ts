type Direction = "up" | "down"
type Handler = (direction: Direction, rows: number) => void

const handlers = new Set<Handler>()

let last = 0
let dir: Direction | null = null
let mult = 1
let frac = 0

const isXterm = process.env.TERM_PROGRAM === "vscode"

const RAMP_STEP = 0.5
const RAMP_WINDOW_MS = 80
const RAMP_MAX = 6
const IDLE_RESET_MS = 1500

const DECAY_HALFLIFE_MS = 150
const DECAY_STEP = 5
const DECAY_CAP = 6
const BURST_MS = 5

export const mouseScrollEvents = {
  emit(direction: Direction) {
    const now = Date.now()
    const gap = now - last
    last = now

    let rows: number

    if (isXterm) {
      if (gap < BURST_MS) {
        rows = 1
      } else {
        const momentum = Math.pow(0.5, gap / DECAY_HALFLIFE_MS)
        mult = Math.min(DECAY_CAP, 1 + (mult - 1) * momentum + DECAY_STEP * (1 - momentum))
        frac += mult
        rows = Math.floor(frac)
        frac -= rows
      }
    } else {
      if (gap > IDLE_RESET_MS || direction !== dir) {
        mult = 1
        frac = 0
      } else if (gap < RAMP_WINDOW_MS) {
        mult = Math.min(RAMP_MAX, mult + RAMP_STEP)
      }
      rows = Math.max(1, Math.round(mult))
    }

    dir = direction

    for (const h of handlers) h(direction, Math.max(1, rows))
  },
  on(handler: Handler): () => void {
    handlers.add(handler)
    return () => handlers.delete(handler)
  },
}
