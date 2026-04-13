# TUI UX Improvement Plan

## Context

The Ink-based TUI at `packages/tui-ink/` is functional but visually raw. Assistant text renders as plain monochrome strings — no markdown, no code blocks, no visual hierarchy. Tool calls are flat identical-looking rows with truncated output and no collapsing. The goal is to make this a modern, high-signal daily-driver UI for software engineers.

**Scope**: Phases 1-5 (markdown, tool overhaul, visual hierarchy, header/statusbar). Tool grouping and full focus-cursor mode deferred to a follow-up.

**Interaction model**: Auto-collapse for completed tools, single `e` keybind to expand/collapse all tools in last message.

**Role labels**: Icon-only (`●` for user, `◆` for assistant) — compact, not noisy.

---

## Design Principles

1. **Clean** — whitespace is a feature. Use spacing, borders, and color to create structure — not clutter.
2. **Modern** — consistent theme-aware colors, rounded borders, subtle contrast. No ASCII art decorations.
3. **Practical** — every pixel of screen real estate earns its place. If it doesn't help the engineer understand or act, remove it.
4. **Fast** — rendering must keep up with streaming. Memoize expensive operations. No layout jank.

### Icon Usage Rules

Icons are a UX tool, not decoration. Apply these rules before adding any icon:

1. **Use icons only when they encode information faster than text** — a `✓` is faster to scan than "completed". A colored dot `●` is faster than "ready". These earn their place.
2. **Use icons to differentiate items in a list** — tool calls in a sequence need type icons (`◇` read, `✎` edit, `$` bash) so engineers can scan and find the tool they care about without reading every label.
3. **Don't use icons that duplicate adjacent text** — if the label says "Thinking:", don't also put a brain icon. The text is enough.
4. **Don't use icons for one-off elements** — the header, statusbar, and footer don't need icons for items that appear once and are already labeled.
5. **Prefer Unicode symbols over emoji** — emoji render inconsistently across terminals and take 2 columns. Unicode symbols (`✓ ✗ ◇ ◎ ●`) are single-width and predictable.
6. **Status icons must be color-coded** — the icon alone isn't enough; pair with theme color so colorblind users can still distinguish by shape, and sighted users can scan by color.

---

## Phase 1: Markdown Renderer

**Goal**: Parse assistant (and user) text as markdown. Render code blocks, bold, italic, lists, inline code, headings, blockquotes.

### Files to create

**`packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`**
- Accept `text: string` and optional `width: number`
- Call `marked.lexer(text)` (synchronous) to get token array
- Memoize lexer output with `useMemo` keyed on `text`
- Map each token to Ink components:

| Token type | Rendering |
|---|---|
| `heading` | `<Text bold color={theme.text}>` (no `#` prefix — clean) |
| `paragraph` | `<Box marginTop={1}><InlineText tokens={...} /></Box>` |
| `code` | `<CodeBlock lang={lang} code={text} />` |
| `list` | `<Box flexDirection="column">` with `•` or number prefixes |
| `blockquote` | `<Box borderLeft borderColor={theme.surface1} paddingLeft={1}>` |
| `hr` | `<Text color={theme.surface1}>{"─".repeat(width)}</Text>` |
| `space` | `null` |

**`packages/tui-ink/src/components/markdown/CodeBlock.tsx`**
```
  ╭ typescript ─────────────────────────╮
  │ const x = 1                         │
  │ console.log(x)                      │
  ╰─────────────────────────────────────╯
```
- `<Box borderStyle="round" borderColor={theme.surface1} paddingX={1}>`
- Language label: `<Text color={theme.overlay} dimColor>{lang}</Text>` as first line inside box
- Code: `<Text color={theme.subtext} wrap="wrap">{code}</Text>`
- No syntax highlighting in v1

**`packages/tui-ink/src/components/markdown/InlineText.tsx`**
- Recursively render inline tokens:

| Inline token | Rendering |
|---|---|
| `strong` | `<Text bold>` |
| `em` | `<Text italic>` |
| `codespan` | `<Text backgroundColor={theme.surface0} color={theme.cyan}> {code} </Text>` |
| `link` | `<Text color={theme.blue} underline>{text}</Text>` |
| `del` | `<Text strikethrough>` |
| `text`/`escape` | `<Text>{raw}</Text>` |

### Files to modify

- **`packages/tui-ink/src/components/parts/TextPart.tsx`** — replace `<Text wrap="wrap">{text}</Text>` with `<MarkdownRenderer text={text} />`
- **`packages/tui-ink/package.json`** — add `"marked": "catalog:"` to dependencies

### Notes
- `marked.lexer()` handles unclosed fences gracefully during streaming (treats as paragraph)

---

## Phase 2: Tool Call Overhaul

**Goal**: Type-specific icons (justified — they differentiate items in a scannable list), timing, auto-collapse, expandable output.

### Files to modify

**`packages/tui-ink/src/store.ts`** — add collapse state:
```typescript
collapsedTools: Record<string, boolean>  // partId -> collapsed
toggleToolCollapse: (partId: string) => void
expandAllTools: (sessionID: string) => void
collapseAllTools: (sessionID: string) => void
```

**`packages/tui-ink/src/components/parts/ToolPart.tsx`** — major rewrite:

**Why icons here**: Tool calls appear in sequences of 5-20+. Engineers scan the list to find a specific action (the file read, the bash command, the edit). Type icons let them find it visually in <1 second vs reading every label.

Type-specific icon mapping (extract as `toolMeta()` helper):

| Tool pattern | Icon | Color | Rationale |
|---|---|---|---|
| read, file_read | `◇` | theme.cyan | Diamond = inspect/view |
| write, edit, file_write | `✎` | theme.yellow | Pen = modification |
| bash, shell, execute | `$` | theme.green | Shell prompt convention |
| glob, grep, search | `⊕` | theme.lavender | Crosshair = search/find |
| mcp__* | `⬡` | theme.pink | Hexagon = external/plugin |
| default | `◎` | theme.blue | Neutral circle |

**Status icons** (already exist, just refining — these encode state faster than text):

| Status | Icon | Color |
|---|---|---|
| pending | `◌` | theme.overlay |
| running | `◎` | theme.yellow |
| completed | `✓` | theme.green |
| error | `✗` | theme.red |

**Collapsed layout** (one line, default for completed):
```
  ✓ ◇ Read src/App.tsx                                   45ms
```
- `<Box justifyContent="space-between">` for right-aligned timing
- Duration from `state.time`, formatted as `45ms` / `2.3s`

**Expanded layout** (default for running/error, toggled for completed):
```
  ✓ ◇ Read src/App.tsx                                   45ms
    ╭─────────────────────────────────────────────────────╮
    │ import React from "react"                           │
    │ export function App() { ... }                       │
    ╰─────────────────────────────────────────────────────╯
```
- Output in `<Box borderStyle="round" borderColor={theme.surface0} paddingX={1}>`
- Truncate to 30 lines with `"… N more lines"` indicator

**Error layout**:
```
  ✗ $ npm test                                           error
    │ FAIL src/utils.test.ts
    │ Error: expected 3, received 4
```
- Red left-border: `<Box borderLeft borderColor={theme.red} paddingLeft={1}>`

**Auto-collapse**: Completed tools default collapsed. Running/error stay expanded.

**`packages/tui-ink/src/components/MessageList.tsx`** — add `e` keybind:
- Toggle expand/collapse all tools in the last assistant message

---

## Phase 3: Visual Hierarchy

**Goal**: Clear visual distinction between user, assistant, and metadata.

### Files to modify

**`packages/tui-ink/src/components/UserMessage.tsx`**:
- Add `●` icon: this differentiates user from assistant at a glance when scanning a long conversation. The icon works with the mauve left border to create a distinct "user block" visual pattern.
- Render text through `<MarkdownRenderer>` (inline code etc.)

```
 ┃ ● Can you fix the bug in `utils.ts`?
```

**`packages/tui-ink/src/components/AssistantMessage.tsx`**:
- Add `◆` icon before first text part: pairs with user's `●` for quick role scanning
- Enrich footer — **no icons in footer** (single occurrence, text is clearer):
  ```
  build · claude-sonnet-4-20250514 · 2.3s · 1.2k tokens
  ```
  Remove the `▣` icon — it doesn't convey information. Use `·` dot separators between metadata items.
- Duration: `msg.time.completed - msg.time.created`
- Tokens: `msg.tokens.input + msg.tokens.output`, format as `1.2k`

**`packages/tui-ink/src/components/parts/ReasoningPart.tsx`**:
- Switch from full-border box to left-border-only blockquote style
- `theme.surface2` border, `theme.overlay` text — clearly secondary
- No icon — "Thinking:" label is sufficient for a single block
```
  │ Thinking:
  │ The user wants me to fix...
```

---

## Phase 4: Header Polish

**File**: `packages/tui-ink/src/components/Header.tsx`

After:
```
bettercode ─ main ─ 3 sessions                            ● ready
```

- `─` separators between items (visual rhythm, not clutter)
- Session count from store
- Status dot `●` — **justified**: it's a persistent status indicator that needs to be glanceable. Color alone (green/yellow/red) encodes the state. The word after it ("ready"/"generating") is for clarity.
- During generation: replace dot+text with the existing spinner

---

## Phase 5: StatusBar Polish

**File**: `packages/tui-ink/src/components/StatusBar.tsx`

After:
```
 build │ claude-sonnet-4-20250514 │ e: tools · shift+tab: mode
```

- Mode as inverse badge: `<Text inverse> {mode} </Text>` — stands out without an icon
- No icons in statusbar — each item appears once and has a text label. Icons would be redundant.
- `│` pipe separators
- 2-3 contextual key hints

---

## Critical Files Summary

| File | Phase | Change |
|---|---|---|
| `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx` | 1 | **New** |
| `packages/tui-ink/src/components/markdown/CodeBlock.tsx` | 1 | **New** |
| `packages/tui-ink/src/components/markdown/InlineText.tsx` | 1 | **New** |
| `packages/tui-ink/src/components/parts/TextPart.tsx` | 1 | Modify |
| `packages/tui-ink/package.json` | 1 | Add marked dep |
| `packages/tui-ink/src/store.ts` | 2 | Add collapse state |
| `packages/tui-ink/src/components/parts/ToolPart.tsx` | 2 | Major rewrite |
| `packages/tui-ink/src/components/MessageList.tsx` | 2 | Add `e` keybind |
| `packages/tui-ink/src/components/UserMessage.tsx` | 3 | Icon + markdown |
| `packages/tui-ink/src/components/AssistantMessage.tsx` | 3 | Icon + footer |
| `packages/tui-ink/src/components/parts/ReasoningPart.tsx` | 3 | Restyle |
| `packages/tui-ink/src/components/Header.tsx` | 4 | Enrich |
| `packages/tui-ink/src/components/StatusBar.tsx` | 5 | Restyle |

## Verification

After each phase:
1. `cd packages/tui-ink && bun install && bun run dev`
2. Send prompts that exercise: code-heavy responses, multi-tool calls, errors, long conversations
3. `bun run typecheck` for type safety
4. Check scroll behavior still works (height estimation may need tuning after markdown changes)

