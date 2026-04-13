import { useEffect, useRef } from "react"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { Event } from "@opencode-ai/sdk/v2"
import { useAppStore } from "../store"
import { registry } from "../commands/registry"
import { resolve } from "../model"

interface Opts {
  url: string
  directory?: string
  headers?: Record<string, string>
}

const BACKOFF_BASE = 1000
const BACKOFF_MAX = 30_000

function backoff(attempt: number) {
  return Math.min(BACKOFF_BASE * 2 ** attempt, BACKOFF_MAX)
}

// ---------------------------------------------------------------------------
// Delta batching
//
// Text deltas arrive at LLM streaming speed (~30–100/sec). Applying each one
// immediately causes a React re-render (and full Ink repaint) per character.
// Instead, accumulate deltas for 50 ms and flush them in a single store
// update, capping repaints at ~20/sec without losing any content.
// ---------------------------------------------------------------------------
type DeltaKey = string // `${messageID}:${partID}:${field}`
const _deltaBuffer = new Map<DeltaKey, string>()
let _flushTimer: ReturnType<typeof setTimeout> | null = null

function flushDeltas() {
  _flushTimer = null
  if (_deltaBuffer.size === 0) return
  const store = useAppStore.getState()
  for (const [key, text] of _deltaBuffer) {
    const colonA = key.indexOf(":")
    const colonB = key.indexOf(":", colonA + 1)
    const messageID = key.slice(0, colonA)
    const partID = key.slice(colonA + 1, colonB)
    const field = key.slice(colonB + 1)
    store.appendPartDelta(messageID, partID, field, text)
  }
  _deltaBuffer.clear()
}

function bufferDelta(messageID: string, partID: string, field: string, delta: string) {
  const key = `${messageID}:${partID}:${field}`
  _deltaBuffer.set(key, (_deltaBuffer.get(key) ?? "") + delta)
  if (_flushTimer === null) {
    _flushTimer = setTimeout(flushDeltas, 50)
  }
}
// ---------------------------------------------------------------------------

function dispatch(e: Event) {
  const store = useAppStore.getState()

  switch (e.type) {
    case "session.created":
    case "session.updated":
      store.upsertSession(e.properties.info)
      break

    case "session.deleted":
      store.removeSession(e.properties.info.id)
      break

    case "session.status":
      store.setSessionStatus(e.properties.sessionID, e.properties.status)
      break

    case "session.idle":
      // Flush any buffered deltas before marking idle so the final chunk renders
      flushDeltas()
      store.setSessionStatus(e.properties.sessionID, { type: "idle" })
      store.setComposerStatus("idle")
      break

    case "session.error":
      flushDeltas()
      store.setComposerStatus("error")
      break

    case "session.diff":
      store.setSessionDiff(e.properties.sessionID, e.properties.diff)
      break

    case "message.updated":
      store.upsertMessage(e.properties.info)
      break

    case "message.removed":
      store.removeMessage(e.properties.sessionID, e.properties.messageID)
      break

    case "message.part.updated":
      // Upsert the part skeleton. Do NOT set composerStatus here — sessionStatus
      // already tracks the busy/idle lifecycle; redundant composerStatus updates
      // caused SessionScreen to re-render on every streamed part.
      store.upsertPart(e.properties.part)
      break

    case "message.part.removed":
      store.removePart(e.properties.messageID, e.properties.partID)
      break

    case "message.part.delta":
      // Buffer instead of applying immediately — prevents per-character repaints.
      bufferDelta(e.properties.messageID, e.properties.partID, e.properties.field, e.properties.delta)
      break

    case "permission.asked":
      store.upsertPermission(e.properties)
      break

    case "permission.replied":
      store.removePermission(e.properties.sessionID, e.properties.requestID)
      break

    case "question.asked":
      store.upsertQuestion(e.properties)
      break

    case "question.replied":
    case "question.rejected":
      store.removeQuestion(e.properties.sessionID, e.properties.requestID)
      break

    case "vcs.branch.updated":
      useAppStore.setState({ vcs: { branch: e.properties.branch } })
      break

    case "tui.command.execute":
      registry.trigger(e.properties.command)
      break

    case "tui.toast.show":
      useAppStore.getState().addToast({
        title: e.properties.title,
        message: e.properties.message,
        variant: e.properties.variant,
        duration: e.properties.duration ?? 4000,
      })
      break

    case "tui.prompt.append":
      useAppStore.getState().setComposerAppend(e.properties.text)
      break

    case "tui.session.select":
      useAppStore.setState({ currentSessionID: e.properties.sessionID })
      useAppStore.getState().navigate({ type: "session", sessionID: e.properties.sessionID })
      break

    case "server.instance.disposed":
      // Trigger re-bootstrap when server disposes an instance
      useAppStore.setState({ syncStatus: "loading" })
      break
  }
}

async function bootstrap(client: ReturnType<typeof createOpencodeClient>, directory: string | undefined) {
  const q = directory ? { directory } : {}

  // Parallel non-blocking fetch of all bootstrap data
  const [providerList, agents, commands, config, sessions, lsp, mcp, vcs, providerAuth] = await Promise.all([
    client.provider.list(q).then((r) => r.data ?? { all: [], default: {}, connected: [] }),
    client.app.agents(q).then((r) => r.data ?? []),
    client.command.list(q).then((r) => r.data ?? []),
    client.config.get(q).then((r) => r.data ?? {}),
    client.session
      .list({ start: Date.now() - 30 * 24 * 60 * 60 * 1000 })
      .then((r) => (r.data ?? []).toSorted((a, b) => a.id.localeCompare(b.id))),
    client.lsp.status(q).then((r) => r.data ?? []),
    client.mcp.status(q).then((r) => r.data ?? {}),
    client.vcs.get(q).then((r) => r.data),
    client.provider.auth(q).then((r) => r.data ?? {}),
  ])

  useAppStore.setState({
    providers: providerList.all,
    providerDefaults: providerList.default,
    providerConnected: providerList.connected,
    providerAuth,
    agents,
    commands,
    config,
    sessions,
    lsp,
    mcp,
    vcs,
    syncStatus: "complete",
  })

  // Auto-select a model using config, then saved state, then sensible fallbacks.
  const state = useAppStore.getState()
  const next = resolve({
    cfg: config,
    saved: state.currentModel,
    recent: state.recentModels,
    providers: providerList.all,
    connected: providerList.connected,
    defaults: providerList.default,
  })
  if (next && (state.currentModel?.providerID !== next.providerID || state.currentModel.modelID !== next.modelID)) {
    state.setCurrentModel(next)
  }
}

export function useSDK({ url, directory, headers }: Opts) {
  const setClient = useAppStore((s) => s.setClient)
  const setSyncStatus = useAppStore((s) => s.setSyncStatus)

  // Keep a ref so the inner async loop can check liveness without stale closure
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!url) return

    const abort = new AbortController()
    abortRef.current = abort

    const client = createOpencodeClient({
      baseUrl: url,
      headers,
      directory,
    })

    setClient(client)

    // Bootstrap all data then start streaming events
    let bootstrapDone = false

    ;(async () => {
      // Bootstrap first
      try {
        await bootstrap(client, directory)
        bootstrapDone = true
      } catch (err) {
        if (abort.signal.aborted) return
        console.error("[tui-ink] bootstrap failed", err)
        setSyncStatus("partial")
      }

      // Stream events with exponential backoff on drop
      let attempt = 0
      while (!abort.signal.aborted) {
        try {
          const res = await client.global.event({ signal: abort.signal })
          attempt = 0 // reset on success
          for await (const event of res.stream) {
            if (abort.signal.aborted) break
            dispatch(event.payload)
          }
        } catch {
          if (abort.signal.aborted) break
          const delay = backoff(attempt++)
          await new Promise((r) => setTimeout(r, delay))

          // Re-bootstrap after a disconnect if we haven't succeeded yet
          if (!bootstrapDone) {
            try {
              await bootstrap(client, directory)
              bootstrapDone = true
            } catch {
              // will retry on next loop iteration
            }
          }
        }
      }
    })()

    return () => {
      abort.abort()
      abortRef.current = null
    }
  }, [url, directory])
}
