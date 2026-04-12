import { useEffect } from "react"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { GlobalEvent } from "@opencode-ai/sdk/v2"
import { useAppStore } from "../store"

interface UseSDKOpts {
  url: string
  directory?: string
  headers?: Record<string, string>
}

export function useSDK({ url, directory, headers }: UseSDKOpts) {
  const appendStream = useAppStore((s) => s.appendStream)
  const setStatus = useAppStore((s) => s.setStatus)

  useEffect(() => {
    if (!url) return

    const abort = new AbortController()

    const client = createOpencodeClient({
      baseUrl: url,
      signal: abort.signal,
      directory,
      headers,
    })

    useAppStore.setState({ sdkClient: client })

    function handle(event: GlobalEvent) {
      const e = event.payload
      switch (e.type) {
        case "message.part.delta": {
          if (e.properties.field === "text" && e.properties.delta) {
            setStatus("generating")
            appendStream(e.properties.delta)
          }
          break
        }
        case "session.idle": {
          setStatus("idle")
          break
        }
        case "session.status": {
          const status = e.properties.status
          if (status.type === "busy") setStatus("generating")
          else if (status.type === "idle") setStatus("idle")
          break
        }
        case "session.error": {
          setStatus("error")
          break
        }
      }
    }

    ;(async () => {
      while (true) {
        if (abort.signal.aborted) break
        try {
          const events = await client.global.event({ signal: abort.signal })
          for await (const event of events.stream) {
            if (abort.signal.aborted) break
            handle(event)
          }
        } catch {
          if (abort.signal.aborted) break
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    })()

    return () => {
      abort.abort()
    }
  }, [url, directory])
}
