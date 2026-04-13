import type { Config, Provider } from "@opencode-ai/sdk/v2"

export type ModelRef = { providerID: string; modelID: string }

function valid(providers: Provider[], connected: string[], ref: ModelRef) {
  if (!connected.includes(ref.providerID)) return false
  const provider = providers.find((p) => p.id === ref.providerID)
  return !!provider?.models[ref.modelID]
}

export function read(input: unknown) {
  if (!input || typeof input !== "object") return undefined
  const value = input as Partial<ModelRef>
  if (typeof value.providerID !== "string" || typeof value.modelID !== "string") return undefined
  return { providerID: value.providerID, modelID: value.modelID }
}

export function parse(input?: string) {
  if (!input) return undefined
  const idx = input.indexOf("/")
  if (idx <= 0 || idx >= input.length - 1) return undefined
  return { providerID: input.slice(0, idx), modelID: input.slice(idx + 1) }
}

export function resolve(input: {
  cfg?: Config
  saved?: ModelRef
  recent?: ModelRef[]
  providers: Provider[]
  connected: string[]
  defaults: Record<string, string>
}) {
  const cfg = parse(input.cfg?.model)
  if (cfg && valid(input.providers, input.connected, cfg)) return cfg

  if (input.saved && valid(input.providers, input.connected, input.saved)) return input.saved

  for (const ref of input.recent ?? []) {
    if (valid(input.providers, input.connected, ref)) return ref
  }

  const mini = input.providers
    .filter((p) => input.connected.includes(p.id))
    .map((p) => ({ providerID: p.id, modelID: "gpt-5-mini" }))
    .find((ref) => valid(input.providers, input.connected, ref))
  if (mini) return mini

  const first = input.connected[0]
  if (!first) return undefined
  const modelID = input.defaults[first] ?? Object.keys(input.providers.find((p) => p.id === first)?.models ?? {})[0]
  if (!modelID) return undefined
  return { providerID: first, modelID }
}
