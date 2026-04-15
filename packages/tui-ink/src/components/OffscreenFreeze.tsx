import React, { useRef } from "react"

interface Props {
  visible: boolean
  children: React.ReactNode
}

export function hold(prev: React.ReactNode | undefined, visible: boolean, children: React.ReactNode) {
  if (visible || prev === undefined) return children
  return prev
}

export function OffscreenFreeze({ visible, children }: Props) {
  const cache = useRef<React.ReactNode>()
  const node = hold(cache.current, visible, children)
  cache.current = node
  return <>{node}</>
}
