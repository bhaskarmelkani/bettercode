import { type RGBA, type ScrollBoxRenderable } from "@opentui/core"
import type { JSX } from "solid-js"
import { Brand } from "@/fork/brand"

type MouseEvt = {
  button: number
  preventDefault: () => void
  stopPropagation: () => void
}

type ScrollAccel = {
  tick: (now?: number) => number
  reset: () => void
}

type AppProps = {
  width: number
  height: number
  bg: RGBA
  onMouseDown?: (evt: MouseEvt) => void
  onMouseUp?: (evt: MouseEvt) => void
  children: JSX.Element
}

type SessionProps = {
  sidebar: boolean
  wide: boolean
  main: JSX.Element
  side: JSX.Element
}

type BodyProps = {
  footer: JSX.Element
  toast: JSX.Element
  timeline: JSX.Element
}

type HomeProps = {
  logo: JSX.Element
  prompt: JSX.Element
  bottom: JSX.Element
  footer: JSX.Element
  toast: JSX.Element
  text: RGBA
  muted: RGBA
  panel: RGBA
  border: RGBA
}

type TimelineProps = {
  ref: (view: ScrollBoxRenderable) => void
  right: number
  scrollbar: boolean
  track: RGBA
  border: RGBA
  accel: ScrollAccel
  children: JSX.Element
}

export const Surface = {
  app(props: AppProps) {
    return (
      <box
        width={props.width}
        height={props.height}
        backgroundColor={props.bg}
        onMouseDown={props.onMouseDown}
        onMouseUp={props.onMouseUp}
      >
        {props.children}
      </box>
    )
  },
  body(props: BodyProps) {
    return (
      <box flexGrow={1} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
        {props.timeline}
        {props.footer}
        {props.toast}
      </box>
    )
  },
  home(props: HomeProps) {
    if (Brand.slug === Brand.legacySlug) {
      return (
        <>
          <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
            <box flexGrow={1} minHeight={0} />
            <box height={4} minHeight={0} flexShrink={1} />
            <box flexShrink={0}>{props.logo}</box>
            <box height={1} minHeight={0} flexShrink={1} />
            {props.prompt}
            {props.bottom}
            <box flexGrow={1} minHeight={0} />
            {props.toast}
          </box>
          <box width="100%" flexShrink={0}>{props.footer}</box>
        </>
      )
    }

    return (
      <>
        <box flexGrow={1} alignItems="center" justifyContent="center" paddingLeft={2} paddingRight={2}>
          {props.prompt}
          {props.toast}
        </box>
      </>
    )
  },
  layout(props: SessionProps) {
    return (
      <box flexDirection="row">
        {props.main}
        {props.sidebar ? props.side : null}
      </box>
    )
  },
  side(props: { wide: boolean; bg: RGBA; children: JSX.Element }) {
    if (props.wide) return props.children
    return (
      <box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="flex-end"
        backgroundColor={props.bg}
      >
        {props.children}
      </box>
    )
  },
  timeline(props: TimelineProps) {
    return (
      <scrollbox
        ref={props.ref}
        viewportOptions={{
          paddingRight: props.right,
        }}
        verticalScrollbarOptions={{
          paddingLeft: 1,
          visible: props.scrollbar,
          trackOptions: {
            backgroundColor: props.track,
            foregroundColor: props.border,
          },
        }}
        stickyScroll={true}
        stickyStart="bottom"
        flexGrow={1}
        scrollAcceleration={props.accel}
      >
        {props.children}
      </scrollbox>
    )
  },
}
