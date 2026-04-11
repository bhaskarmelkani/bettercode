import { Button } from "@opencode-ai/ui/button"
import { Tabs } from "@opencode-ai/ui/tabs"
import { For, Show, createMemo, createSignal } from "solid-js"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"

const time = (value: number) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

const text = (value: unknown) => JSON.stringify(value, null, 2)

const first = <T,>(list: T[], match: (item: T) => boolean) => list.find(match)
const last = <T,>(list: T[], match: (item: T) => boolean) => [...list].reverse().find(match)

export function SessionDebugPanel(props: { sessionID: () => string | undefined }) {
  const sdk = useSDK()
  const sync = useSync()
  const [tab, setTab] = createSignal("timeline")
  const [busy, setBusy] = createSignal(false)

  const sessionID = createMemo(() => props.sessionID())
  const enabled = createMemo(() => {
    const id = sessionID()
    if (!id) return false
    return !!sync.data.debug_enabled[id]
  })
  const trace = createMemo(() => {
    const id = sessionID()
    if (!id) return []
    return (sync.data.debug_trace[id] ?? []).slice().sort((a, b) => a.time - b.time)
  })
  const raw = createMemo(() => {
    const id = sessionID()
    if (!id) return []
    return (sync.data.debug_raw[id] ?? []).slice().sort((a, b) => a.time - b.time)
  })

  const prompt = createMemo(() => {
    const list = trace()
    return {
      received: first(list, (item) => item.stage === "prompt.received"),
      context: last(list, (item) => item.stage === "context.assembled"),
      system: last(list, (item) => item.stage === "hook.system"),
      params: last(list, (item) => item.stage === "hook.params"),
      headers: last(list, (item) => item.stage === "hook.headers"),
      tools: last(list, (item) => item.stage === "tools.exposed"),
      request: last(list, (item) => item.stage === "provider.request"),
    }
  })

  const tools = createMemo(() =>
    trace().filter((item) => item.stage.startsWith("tool.") || item.stage === "tools.exposed"),
  )

  const toggle = async (next: boolean) => {
    const id = sessionID()
    if (!id || busy()) return
    setBusy(true)
    try {
      await sdk.client.session.debugUpdate({
        sessionID: id,
        enabled: next,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="h-full min-h-0 flex flex-col">
      <div class="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border-weaker-base">
        <div class="min-w-0">
          <div class="text-13-medium">Session Debug</div>
          <div class="text-11-regular text-text-weak">
            {enabled() ? "Live trace enabled for this session" : "Enable live tracing to inspect this session"}
          </div>
        </div>
        <Button
          size="small"
          variant={enabled() ? "secondary" : "primary"}
          loading={busy()}
          onClick={() => toggle(!enabled())}
        >
          {enabled() ? "Disable" : "Enable"}
        </Button>
      </div>

      <Show
        when={enabled()}
        fallback={
          <div class="flex-1 min-h-0 overflow-auto p-4">
            <div class="rounded-lg border border-border-weaker-base bg-background-base p-4 text-13-regular text-text-weak">
              Debug mode is off for this session. Turn it on before sending or continuing prompts to capture prompt
              assembly, tools, permissions, model setup, compaction, and raw event payloads.
            </div>
          </div>
        }
      >
        <Tabs value={tab()} onChange={setTab}>
          <div class="shrink-0 px-3 pt-3">
            <Tabs.List>
              <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
              <Tabs.Trigger value="prompt">Prompt</Tabs.Trigger>
              <Tabs.Trigger value="tools">Tools</Tabs.Trigger>
              <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
            </Tabs.List>
          </div>

          <Tabs.Content value="timeline" class="flex-1 min-h-0 overflow-auto p-3">
            <div class="space-y-3">
              <For each={trace()}>
                {(item) => (
                  <div class="rounded-lg border border-border-weaker-base bg-background-base p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-13-medium">{item.title}</div>
                      <div class="text-11-regular text-text-weak">{time(item.time)}</div>
                    </div>
                    <div class="mt-1 text-11-regular text-text-weak">{item.stage}</div>
                    <Show when={Object.keys(item.data ?? {}).length > 0}>
                      <pre class="mt-3 overflow-auto rounded-md bg-background-stronger p-3 text-11-regular">{text(item.data)}</pre>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Tabs.Content>

          <Tabs.Content value="prompt" class="flex-1 min-h-0 overflow-auto p-3">
            <div class="space-y-3">
              <For
                each={[
                  ["Prompt received", prompt().received],
                  ["Context assembled", prompt().context],
                  ["System prompt", prompt().system],
                  ["Params", prompt().params],
                  ["Headers", prompt().headers],
                  ["Tools exposed", prompt().tools],
                  ["Provider request", prompt().request],
                ] as const}
              >
                {([label, item]) => (
                  <div class="rounded-lg border border-border-weaker-base bg-background-base p-3">
                    <div class="text-13-medium">{label}</div>
                    <Show
                      when={item}
                      fallback={<div class="mt-2 text-12-regular text-text-weak">No data captured yet.</div>}
                    >
                      <pre class="mt-3 overflow-auto rounded-md bg-background-stronger p-3 text-11-regular">
                        {text(item?.data ?? {})}
                      </pre>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Tabs.Content>

          <Tabs.Content value="tools" class="flex-1 min-h-0 overflow-auto p-3">
            <div class="space-y-3">
              <For each={tools()}>
                {(item) => (
                  <div class="rounded-lg border border-border-weaker-base bg-background-base p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-13-medium">{item.title}</div>
                      <div class="text-11-regular text-text-weak">{time(item.time)}</div>
                    </div>
                    <div class="mt-1 text-11-regular text-text-weak">{item.stage}</div>
                    <pre class="mt-3 overflow-auto rounded-md bg-background-stronger p-3 text-11-regular">{text(item.data)}</pre>
                  </div>
                )}
              </For>
            </div>
          </Tabs.Content>

          <Tabs.Content value="raw" class="flex-1 min-h-0 overflow-auto p-3">
            <div class="space-y-3">
              <For each={raw()}>
                {(item) => (
                  <div class="rounded-lg border border-border-weaker-base bg-background-base p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-13-medium">{item.type}</div>
                      <div class="text-11-regular text-text-weak">{time(item.time)}</div>
                    </div>
                    <pre class="mt-3 overflow-auto rounded-md bg-background-stronger p-3 text-11-regular">{text(item.properties)}</pre>
                  </div>
                )}
              </For>
            </div>
          </Tabs.Content>
        </Tabs>
      </Show>
    </div>
  )
}
