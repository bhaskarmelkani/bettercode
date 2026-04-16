# BetterCode TUI

A feature-rich terminal UI for BetterCode, built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals).

## Quick Start

```bash
# From the repo root
bun install

# Run the TUI
bun run dev

# Type-check
bun typecheck

# Run tests
bun test test/
```

---

## Features

### Composer

#### Editing Power
The message composer supports a full set of power-user editing shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Ctrl+_` | Undo (up to 50 snapshots, debounced 800 ms) |
| `Ctrl+G` | Open current input in `$EDITOR` / `$VISUAL` / `vi` |
| `Ctrl+R` | Reverse history search — type a substring to find a previous prompt |
| `Ctrl+W` | Delete word backward |
| `Ctrl+K` | Kill to end of line (saved to kill ring) |
| `Ctrl+Y` | Yank from kill ring |
| `Alt+Y` | Cycle through kill ring entries after a yank |
| `Ctrl+A` / `Ctrl+E` | Jump to line start / end |
| `Alt+Enter` | Insert a newline (multi-line input) |
| `↑` / `↓` | Navigate prompt history (or move cursor between lines in multi-line input) |
| `Escape` | Clear input / close overlays |

History search (`Ctrl+R`) shows a reverse-i-search prompt:
```
>  (reverse-i-search)`query': matched prompt preview
```
Press `Ctrl+R` again to cycle to the next match, `Enter` to accept, `Escape` or `Ctrl+G` to cancel.

#### Syntax Highlighting
The composer highlights special tokens as you type:

- `/commands` — rendered **blue bold**
- `@mentions` — rendered **cyan bold**
- Regular text — default color

#### Slash Commands
Type `/` to open the command palette. All registered commands, MCP tools, and skills appear with their source badge (`[LOCAL]`, `[MCP]`, `[SKILL]`, `[CMD]`). Navigate with `↑`/`↓`, select with `Tab` or `Enter`.

#### File Mentions
Type `@` followed by a path fragment to attach a file. A fuzzy dropdown shows matches from the workspace. Select with `Tab` or `Enter`. Attached files appear as pills above the input and are sent as file parts with the submission.

#### Image Paste
Press `Ctrl+V` when an image is in the clipboard to attach it.

- **macOS**: reads clipboard via AppleScript (no external dependencies)
- **Linux**: reads clipboard via `xclip` (requires `xclip` package)

Attached images appear as `[Image #1]`, `[Image #2]`, … pills and are sent to the model as base64 PNG file parts.

#### Vim Mode
Opt-in full vim editing mode for the composer.

**Enable** via config (`~/.config/opencode/config.json`):
```json
{ "vim": true }
```
Or set the env var `OPENCODE_VIM=1`.

**Supported features:**

| Category | Keys |
|----------|------|
| Modes | `i` `a` `I` `A` `o` `O` (insert), `Escape` (normal) |
| Motions | `h` `l` `w` `b` `e` `W` `B` `E` `0` `^` `$` `j` `k` `gg` `G` |
| Find | `f{c}` `F{c}` `t{c}` `T{c}` `;` `,` |
| Operators | `d` `c` `y` (with motion or text object) |
| Line ops | `dd` `cc` `yy` |
| Paste | `p` `P` |
| Other | `x` `X` `r{c}` `s` `S` `~` `.` (dot-repeat) |
| Text objects | `iw` `aw` `i"` `a"` `i'` `a'` `i(` `a(` `i[` `a[` `i{` `a{` |

A mode indicator is shown above the separator:
```
-- NORMAL --   -- INSERT --   -- PENDING --
```

---

### Message List

#### Virtual Scrolling
The message list uses true virtual scrolling — only items in the viewport plus an overscan region are mounted in React. This keeps rendering fast even with hundreds of messages.

- Binary search on a Float64Array offset cache for O(log n) visible-range lookup
- Scroll quantization (40-row steps) to batch fast wheel events
- Deferred value mounting to avoid jank when large ranges enter the viewport

#### Pager Mode
When scrolled up (detached from sticky scroll), vim-style pager keys are active:

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll one line down / up |
| `Ctrl+D` / `Ctrl+U` | Half page down / up |
| `Ctrl+F` / `Ctrl+B` | Full page down / up |
| `Space` | Page down |
| `g` | Jump to top |
| `G` (Shift+G) | Jump to bottom |
| `q` | Return to bottom and re-attach sticky scroll |

#### Unseen Messages
When new messages arrive while you are scrolled up:
- A `── N new messages ──` divider appears at the scroll-away point
- A jump-to-bottom pill shows at the bottom of the list
- Pressing `G` or `q` clears the indicator and re-attaches

#### Message Actions
Navigate between messages with `Shift+↑` / `Shift+↓`. The selected message is highlighted with a left border.

| Key | Action |
|-----|--------|
| `Shift+↑` / `Shift+↓` | Move selection between messages |
| `c` | Copy selected message to clipboard |
| `e` | Load selected user message into the composer for editing/resubmit |
| `Escape` | Clear selection |

#### Text Selection & Copy
Click and drag to select text. On release the selection is automatically copied to the clipboard.

- **macOS**: `pbcopy`
- **Linux Wayland**: `wl-copy`
- **Linux X11**: `xclip`
- **Fallback**: OSC-52 escape sequence (works in most terminal multiplexers)

---

### Status & Feedback

#### Token / Context Warning
When context usage crosses 75%, a warning bar appears above the status line:

- **75–90%** → yellow: `Context low — X% remaining [████████░░░░░░░░░░░░]`
- **90%+** → red: `Context critical — X% remaining [...] Use /compact to free space`

The bar uses sub-character unicode block precision.

#### Rich Spinner
During generation the spinner shows:
- **Shimmer** — a brightness wave sweeps across the label text
- **Stall detection** — turns red after 3 seconds with no new tokens
- **Thinking timer** — shows elapsed seconds after 2 seconds (`Thinking... (4.2s)`)

---

### Configurable Keybindings

All keybindings can be customized in `~/.config/opencode/keybindings.json` (global) or `$OPENCODE_CONFIG_DIR/keybindings.json` (project-level override).

**Format:**
```json
{
  "scrollDown": [{ "key": "j", "context": "scroll" }],
  "submit":     [{ "key": "return", "context": "chat" }]
}
```

Each entry maps an **action** to a list of `{ key, context }` bindings. User-defined entries merge with the defaults; unspecified actions keep their defaults.

**Available contexts:** `global`, `chat`, `stream`, `scroll`, `search`, `dialog`

**All actions and their defaults:**

| Action | Default | Context |
|--------|---------|---------|
| `submit` | `Enter` | `chat` |
| `steer` | `Ctrl+S` | `stream` |
| `exit` | `Ctrl+C` | `global` |
| `newline` | `Alt+Enter` | `chat` |
| `backspace` | `Backspace` | `chat` |
| `delete` | `Delete` | `chat` |
| `moveLeft` | `←` | `chat` |
| `moveRight` | `→` | `chat` |
| `home` | `Ctrl+A` | `chat` |
| `end` | `Ctrl+E` | `chat` |
| `deleteWord` | `Ctrl+W` | `chat` |
| `killLine` | `Ctrl+K` | `chat` |
| `undoInput` | `Ctrl+Z` | `chat` |
| `historyPrev` | `↑` | `chat` |
| `historyNext` | `↓` | `chat` |
| `historySearch` | `Ctrl+R` | `chat` |
| `externalEditor` | `Ctrl+G` | `chat` |
| `stashInput` | `Ctrl+X` | `chat` |
| `unstashInput` | `Ctrl+Y` | `chat` |
| `yankCycle` | `Alt+Y` | `chat` |
| `clearInput` | `Ctrl+C` | `chat` |
| `toggleMode` | `Shift+Tab` | `chat` |
| `scrollUp` | `↑`, `k` | `scroll` |
| `scrollDown` | `↓`, `j` | `scroll` |
| `scrollPageUp` | `PageUp`, `Ctrl+B` | `scroll` |
| `scrollPageDown` | `PageDown`, `Ctrl+F` | `scroll` |
| `scrollHalfUp` | `Ctrl+U` | `scroll` |
| `scrollHalfDown` | `Ctrl+D` | `scroll` |
| `scrollTop` | `g` | `scroll` |
| `scrollBottom` | `G` | `scroll` |
| `quit` | `q` | `scroll` |
| `search` | `Ctrl+F` | `global` |
| `cancelSearch` | `Escape` | `search` |

---

### Design System

Reusable primitives live in `src/components/design-system/`:

| Component | Usage |
|-----------|-------|
| `Pane` | Bordered box with title |
| `Dialog` | Modal overlay with title and actions |
| `FuzzyPicker` | Filterable list with fuzzy search |
| `ProgressBar` | Unicode sub-character progress bar |
| `Divider` | Horizontal rule with optional centered label |
| `ListItem` | Selectable item with icon, label, description |
| `KeyboardShortcutHint` | Styled key hint display |

---

## Architecture

```
src/
├── app.tsx                  # Root component, global key handlers
├── index.tsx                # Entry point, bootstrap (keybindings, vim, prefs)
├── store.ts                 # Zustand store (sessions, messages, UI state)
├── theme-context.tsx        # Catppuccin theme provider
│
├── screens/
│   ├── HomeScreen.tsx       # Session picker
│   └── SessionScreen.tsx    # Active chat session
│
├── components/
│   ├── Composer.tsx         # Message input (highlights, vim, image paste, history)
│   ├── MessageList.tsx      # Virtual scroll, pager keys, message actions
│   ├── BottomDock.tsx       # Composer + token warning container
│   ├── StatusBar.tsx        # Bottom status line
│   ├── Spinner.tsx          # Rich animated spinner
│   ├── TokenWarning.tsx     # Context usage warning
│   ├── MessageActions.tsx   # Per-message copy/edit helpers
│   ├── OffscreenFreeze.tsx  # Freeze offscreen components
│   └── design-system/      # Reusable UI primitives
│
├── hooks/
│   ├── useTextInput.ts      # Cursor-aware text editing primitives
│   ├── useUndoBuffer.ts     # Debounced undo stack
│   ├── useHistorySearch.ts  # Reverse history search
│   ├── useMentions.ts       # @mention autocomplete
│   ├── useSlashCommands.ts  # /command picker
│   ├── useVimMode.ts        # Vim state machine
│   ├── useHighlights.ts     # Syntax highlight computation
│   └── useVirtualScroll.ts  # Virtual scroll engine
│
├── vim/
│   ├── types.ts             # VimMode, VimState
│   ├── motions.ts           # Cursor movement functions
│   ├── operators.ts         # Delete / change / yank
│   └── index.ts             # Barrel export
│
├── keybindings/
│   ├── schema.ts            # Context and Action types
│   ├── defaults.ts          # Default binding map
│   ├── resolve.ts           # resolveAction(), mergeBindings(), JSON loader
│   └── index.ts             # readKeybindings() bootstrap
│
└── utils/
    ├── imagePaste.ts        # Clipboard image detection (macOS / Linux)
    ├── clipboard.ts         # Copy to clipboard (pbcopy / wl-copy / xclip / OSC-52)
    └── promptEditor.ts      # $EDITOR integration
```

---

## Development

```bash
# From packages/tui-ink/
bun typecheck        # TypeScript — must be 0 errors
bun test test/       # 306 tests — must be all green
```

**Regression checklist before merging:**
- [ ] Streaming sessions (queue, steer, abort)
- [ ] Sticky scroll and detached scroll
- [ ] Collapsed/expanded tool calls
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+R, Ctrl+G, Ctrl+V, vim mode)
- [ ] Permission/question flows
- [ ] Terminal resize while idle and while streaming
- [ ] Session switching with per-session scroll state
- [ ] Long transcripts (500+ messages, virtual scroll stays smooth)
- [ ] Token warning at 75%+ context usage

---

## Platform Notes

| Feature | macOS | Linux (X11) | Linux (Wayland) | Windows |
|---------|-------|-------------|-----------------|---------|
| Image paste | ✅ native | ✅ requires `xclip` | ⚠️ not supported | — |
| Clipboard copy | ✅ `pbcopy` | ✅ `xclip` | ✅ `wl-copy` | — |
| External editor | ✅ | ✅ | ✅ | — |
| Vim mode | ✅ | ✅ | ✅ | — |
