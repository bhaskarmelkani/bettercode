import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import type { Provider, ProviderAuthMethod, ProviderAuthAuthorization } from "@opencode-ai/sdk/v2"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"

interface Props {
  rows: number
  columns: number
}

const PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

type Step =
  | { type: "list" }
  | { type: "method-select"; provider: Provider; methods: ProviderAuthMethod[] }
  | {
      type: "prompts"
      provider: Provider
      method: ProviderAuthMethod
      methodIndex: number
      idx: number
      collected: Record<string, string>
      input: string
    }
  | {
      type: "api-key"
      provider: Provider
      methodIndex: number
      metadata?: Record<string, string>
      input: string
      error: string | null
    }
  | { type: "oauth-auto"; provider: Provider; methodIndex: number; auth: ProviderAuthAuthorization; waiting: boolean }
  | {
      type: "oauth-code"
      provider: Provider
      methodIndex: number
      auth: ProviderAuthAuthorization
      input: string
      error: boolean
    }

export function ProviderDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const providers = useAppStore((s) => s.providers)
  const providerAuth = useAppStore((s) => s.providerAuth)
  const providerConnected = useAppStore((s) => s.providerConnected)
  const providerDefaults = useAppStore((s) => s.providerDefaults)
  const popDialog = useAppStore((s) => s.popDialog)
  const setProviderApiKey = useAppStore((s) => s.setProviderApiKey)
  const oauthAuthorize = useAppStore((s) => s.oauthAuthorize)
  const oauthCallback = useAppStore((s) => s.oauthCallback)

  const [step, setStep] = useState<Step>({ type: "list" })
  const [listIdx, setListIdx] = useState(0)
  const [methodIdx, setMethodIdx] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)

  const sorted = [...providers].sort((a, b) => (PRIORITY[a.id] ?? 99) - (PRIORITY[b.id] ?? 99))
  const maxVisible = Math.max(1, rows - 8)
  const start = Math.max(0, listIdx - Math.floor(maxVisible / 2))
  const visible = sorted.slice(start, start + maxVisible)

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  async function selectProvider(provider: Provider) {
    const methods = providerAuth[provider.id] ?? [{ type: "api" as const, label: "API key" }]
    if (methods.length === 1) {
      startMethod(provider, methods, 0)
    } else {
      setStep({ type: "method-select", provider, methods })
      setMethodIdx(0)
    }
  }

  function startMethod(provider: Provider, methods: ProviderAuthMethod[], idx: number) {
    const method = methods[idx]
    if (!method) return
    if (method.prompts?.length) {
      setStep({ type: "prompts", provider, method, methodIndex: idx, idx: 0, collected: {}, input: "" })
    } else if (method.type === "api") {
      setStep({ type: "api-key", provider, methodIndex: idx, input: "", error: null })
    } else {
      // OAuth with no prompts
      startOAuth(provider, idx, {})
    }
  }

  async function startOAuth(provider: Provider, methodIndex: number, inputs: Record<string, string>) {
    const auth = await oauthAuthorize(provider.id, methodIndex, inputs)
    if (!auth) {
      showFeedback("Failed to start OAuth flow")
      setStep({ type: "list" })
      return
    }
    if (auth.method === "auto") {
      setStep({ type: "oauth-auto", provider, methodIndex, auth, waiting: true })
    } else {
      setStep({ type: "oauth-code", provider, methodIndex, auth, input: "", error: false })
    }
  }

  // OAuth auto: trigger callback poll on mount
  useEffect(() => {
    if (step.type !== "oauth-auto" || !step.waiting) return
    let cancelled = false
    oauthCallback(step.provider.id, step.methodIndex).then((ok) => {
      if (cancelled) return
      if (ok) {
        showFeedback(`${step.provider.name} connected!`)
        setStep({ type: "list" })
      } else {
        showFeedback("OAuth failed")
        setStep({ type: "list" })
      }
    })
    return () => {
      cancelled = true
    }
  }, [step.type === "oauth-auto" ? step.auth.url : ""])

  useInput(
    (input, key) => {
      if (key.escape) {
        if (step.type === "list") {
          popDialog()
          return
        }
        setStep({ type: "list" })
        return
      }

      // ── list ──
      if (step.type === "list") {
        if (key.upArrow) {
          setListIdx((i) => Math.max(0, i - 1))
          return
        }
        if (key.downArrow) {
          setListIdx((i) => Math.min(sorted.length - 1, i + 1))
          return
        }
        if (key.return && sorted[listIdx]) {
          selectProvider(sorted[listIdx]!)
          return
        }
        return
      }

      // ── method-select ──
      if (step.type === "method-select") {
        if (key.upArrow) {
          setMethodIdx((i) => Math.max(0, i - 1))
          return
        }
        if (key.downArrow) {
          setMethodIdx((i) => Math.min(step.methods.length - 1, i + 1))
          return
        }
        if (key.return) {
          startMethod(step.provider, step.methods, methodIdx)
          return
        }
        return
      }

      // ── prompts ──
      if (step.type === "prompts") {
        const prompts = step.method.prompts!
        const prompt = prompts[step.idx]
        if (!prompt) return

        if (key.return) {
          const val = step.input.trim()
          if (!val) return
          const next = { ...step.collected, [prompt.key]: val }
          const nextIdx = step.idx + 1
          if (nextIdx >= prompts.length) {
            // All prompts collected — start the actual method
            if (step.method.type === "api") {
              setStep({
                type: "api-key",
                provider: step.provider,
                methodIndex: step.methodIndex,
                metadata: next,
                input: "",
                error: null,
              })
            } else {
              startOAuth(step.provider, step.methodIndex, next)
            }
          } else {
            setStep({ ...step, idx: nextIdx, collected: next, input: "" })
          }
          return
        }
        if (key.backspace || key.delete) {
          setStep({ ...step, input: step.input.slice(0, -1) })
          return
        }
        if (!key.ctrl && !key.meta && input) {
          setStep({ ...step, input: step.input + input })
        }
        return
      }

      // ── api-key ──
      if (step.type === "api-key") {
        if (key.return) {
          const val = step.input.trim()
          if (!val) return
          setProviderApiKey(step.provider.id, val, step.metadata)
            .then(() => {
              showFeedback(`${step.provider.name} connected!`)
              setStep({ type: "list" })
            })
            .catch(() => {
              setStep({ ...step, error: "Failed to save key" })
            })
          return
        }
        if (key.backspace || key.delete) {
          setStep({ ...step, input: step.input.slice(0, -1) })
          return
        }
        if (!key.ctrl && !key.meta && input) {
          setStep({ ...step, input: step.input + input, error: null })
        }
        return
      }

      // ── oauth-code ──
      if (step.type === "oauth-code") {
        if (key.return) {
          const code = step.input.trim()
          if (!code) return
          oauthCallback(step.provider.id, step.methodIndex, code).then((ok) => {
            if (ok) {
              showFeedback(`${step.provider.name} connected!`)
              setStep({ type: "list" })
            } else {
              setStep({ ...step, error: true })
            }
          })
          return
        }
        if (key.backspace || key.delete) {
          setStep({ ...step, input: step.input.slice(0, -1), error: false })
          return
        }
        if (!key.ctrl && !key.meta && input) {
          setStep({ ...step, input: step.input + input, error: false })
        }
        return
      }

      // ── oauth-auto: any key cancels ──
      if (step.type === "oauth-auto") {
        setStep({ type: "list" })
      }
    },
    { isActive: true },
  )

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          {step.type === "list"
            ? "Providers"
            : step.type === "method-select"
              ? `${step.provider.name} — Auth Method`
              : step.type === "prompts"
                ? `${step.provider.name} — Setup`
                : step.type === "api-key"
                  ? `${step.provider.name} — API Key`
                  : step.type === "oauth-auto"
                    ? `${step.provider.name} — OAuth`
                    : `${step.provider.name} — Authorization Code`}
        </Text>
        <Text color={theme.overlay}> esc back</Text>
      </Box>

      {/* ── list view ── */}
      {step.type === "list" && (
        <>
          {sorted.length === 0 && <Text color={theme.overlay}>No providers available.</Text>}
          {visible.map((p, i) => {
            const real = start + i
            const selected = real === listIdx
            const connected = providerConnected.includes(p.id)
            const defaultModel = providerDefaults[p.id]
            return (
              <Box key={p.id} flexDirection="column">
                <Box>
                  <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
                  <Text color={connected ? theme.green : selected ? theme.text : theme.subtext} bold={selected}>
                    {p.name}
                  </Text>
                  {connected && <Text color={theme.green}>{" ✓"}</Text>}
                </Box>
                {selected && defaultModel && (
                  <Box paddingLeft={4}>
                    <Text color={theme.subtext}>Default: {defaultModel}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
          <Box marginTop={1}>
            <Text color={feedback ? theme.yellow : theme.overlay} wrap="truncate">
              {feedback ?? "↑↓ navigate · enter configure · esc close"}
            </Text>
          </Box>
        </>
      )}

      {/* ── method select ── */}
      {step.type === "method-select" && (
        <>
          {step.methods.map((m, i) => (
            <Box key={i}>
              <Text color={i === methodIdx ? theme.cyan : theme.overlay}>{i === methodIdx ? "▶ " : "  "}</Text>
              <Text color={i === methodIdx ? theme.text : theme.subtext}>{m.label}</Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text color={theme.overlay}>↑↓ navigate · enter select · esc back</Text>
          </Box>
        </>
      )}

      {/* ── prompts ── */}
      {step.type === "prompts" &&
        (() => {
          const prompt = step.method.prompts![step.idx]
          if (!prompt) return null
          return (
            <>
              <Text color={theme.subtext}>{prompt.message}</Text>
              <Box marginTop={1} borderStyle="single" borderColor={theme.cyan} paddingX={1}>
                <Text color={theme.cyan}>{"› "}</Text>
                <Text color={theme.text}>
                  {step.input}
                  <Text backgroundColor={theme.overlay} color={theme.base}>
                    {" "}
                  </Text>
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text color={theme.overlay}>enter confirm · esc back</Text>
              </Box>
            </>
          )
        })()}

      {/* ── api-key ── */}
      {step.type === "api-key" && (
        <>
          <Text color={theme.subtext}>Enter your API key for {step.provider.name}:</Text>
          <Box marginTop={1} borderStyle="single" borderColor={step.error ? theme.red : theme.cyan} paddingX={1}>
            <Text color={theme.cyan}>{"› "}</Text>
            <Text color={theme.text}>
              {"•".repeat(step.input.length)}
              <Text backgroundColor={theme.overlay} color={theme.base}>
                {" "}
              </Text>
            </Text>
          </Box>
          {step.error && <Text color={theme.red}>{step.error}</Text>}
          <Box marginTop={1}>
            <Text color={theme.overlay}>enter save · esc back</Text>
          </Box>
        </>
      )}

      {/* ── oauth-auto ── */}
      {step.type === "oauth-auto" && (
        <>
          <Text color={theme.subtext}>{step.auth.instructions}</Text>
          <Box marginTop={1}>
            <Text color={theme.blue}>{step.auth.url}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.yellow}>Waiting for authorization...</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.overlay}>any key to cancel</Text>
          </Box>
        </>
      )}

      {/* ── oauth-code ── */}
      {step.type === "oauth-code" && (
        <>
          <Text color={theme.subtext}>{step.auth.instructions}</Text>
          <Box marginTop={1}>
            <Text color={theme.blue}>{step.auth.url}</Text>
          </Box>
          <Box marginTop={1} borderStyle="single" borderColor={step.error ? theme.red : theme.cyan} paddingX={1}>
            <Text color={theme.cyan}>{"code › "}</Text>
            <Text color={theme.text}>
              {step.input}
              <Text backgroundColor={theme.overlay} color={theme.base}>
                {" "}
              </Text>
            </Text>
          </Box>
          {step.error && <Text color={theme.red}>Invalid code, try again</Text>}
          <Box marginTop={1}>
            <Text color={theme.overlay}>enter submit · esc back</Text>
          </Box>
        </>
      )}
    </Box>
  )
}
