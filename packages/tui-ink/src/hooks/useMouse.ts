import { useEffect } from "react"
import { mouseScrollEvents } from "../mouseScrollEvents"
import { mouseStream, useMouseStream } from "./useMouseStream"

export function useMouse() {
  useMouseStream()

  useEffect(() => {
    const onUp = () => mouseScrollEvents.emit("up")
    const onDown = () => mouseScrollEvents.emit("down")
    mouseStream.on("wheelUp", onUp)
    mouseStream.on("wheelDown", onDown)
    return () => {
      mouseStream.off("wheelUp", onUp)
      mouseStream.off("wheelDown", onDown)
    }
  }, [])
}
