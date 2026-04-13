type Direction = "up" | "down"
type Handler = (direction: Direction) => void

const handlers = new Set<Handler>()

export const mouseScrollEvents = {
  emit(direction: Direction) {
    for (const h of handlers) h(direction)
  },
  on(handler: Handler): () => void {
    handlers.add(handler)
    return () => handlers.delete(handler)
  },
}
