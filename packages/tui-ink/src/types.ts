import type { AssistantMessage } from "@opencode-ai/sdk/v2"

// Minimal error shape for display — common subset of all SDK error variants.
// Some variants (e.g. MessageOutputLengthError) don't carry a typed data.message
// field, so we keep it optional here.
export type AssistantError = {
  name: string
  data: { message?: string }
}

export type CapabilitySkill = {
  name: string
  description: string
  location: string
  content: string
}

export type CapabilityPlugin = {
  id: string
  source: "internal" | "file" | "npm"
  spec: string
  target?: string
  active: boolean
  hooks: string[]
  requested?: string
  version?: string
}

export type CapabilityHook = {
  name: string
  plugins: string[]
}

// AssistantMessage with a displayable error type.
// Use this as a named cast in AssistantMessage.tsx instead of `Message & {...}`.
export type AssistantMsg = Omit<AssistantMessage, "error"> & { error?: AssistantError }
