# Changelog

All notable changes to `bettercode` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Work in progress toward v1.0.0.

---

## [1.0.0] — Initial public release

### Summary

BetterCode v1.0.0 is the first public release of the Ink-based terminal UI for the opencode AI coding assistant. It is fully wired to the opencode runtime with zero production mocks.

### Fixed (M1 — Bug Triage)
- **Viewport snug-fit**: terminal content now fills the exact visible area at all sizes (80×24, 120×40, 60×20); no dead rows between content and StatusBar.
- **Mouse drag-to-select**: consolidated SGR mouse enable/disable into a single `useMouseStream` hook; eliminated duplicate stdin listeners that caused missed events.
- **Composer cursor alignment**: fixed off-by-one fill calculation for empty-line cursor position.

### Added (M2 — Stability & Lifecycle)
- `installTerminalCleanup()`: writes `\x1b[?1006l\x1b[?1000l\x1b[?1049l\x1b[?25h` on SIGINT/SIGTERM/SIGHUP/uncaughtException — no more stuck mouse mode or alt-screen residue after crash.
- Atomic prefs write: prefs are written to `~/.config/bettercode/prefs.json.tmp` then renamed, preventing corruption on mid-write crash.
- Prefs write coalescing: rapid preference changes (e.g. fast theme cycling) produce one file write, not N.
- `BETTERCODE_DEBUG=1` debug log: JSON-line log at `~/Library/Logs/bettercode/tui.log` (macOS) or `~/.local/state/bettercode/tui.log` (Linux); rotated at 5 MB; secrets redacted.
- Error boundaries around Sidebar and Composer — crash in one panel does not take down the whole TUI.
- SSE reconnect with exponential backoff (1s → 30s); "Reconnecting…" toast on disconnect > 2s.

### Improved (M3 — Performance)
- Memoized `computeHighlights` in Composer (recomputes only on value change).
- Memoized search matches in MessageList (`partsVersion` key).
- Consolidated 30+ `useAppStore` selectors in SessionScreen into one shallow selector — cuts re-renders on streaming deltas.
- Adaptive SSE flush interval: 16 ms when tail-visible + generating; 50 ms otherwise.
- Debounced `marked.lexer` per part during streaming; final lex on part finalize.

### Added (M4 — Context Pane)
- Three-mode sidebar: **collapsed** (4 col icon strip) / **compact** (32 col) / **expanded** (56 col). Cycle with `Ctrl+]` / `Ctrl+[`. Persisted to prefs.
- Session overview band in sidebar: branch, agent, model, context token bar.
- `/context` slash command: opens sidebar to the `context` tab with a local breakdown of context usage, messages, and recent turns. No LLM call.
- `/summarize` slash command: runs a sub-agent against the transcript and streams bullets into the `insights` tab. Rate-limited to 1/60s, 4/session. 20s timeout. Plain-text output only.
- `/quality` slash command: heuristics + LLM pass on the session quality metrics. Same budget rules as `/summarize`.
- Live indicators in collapsed sidebar: spinner mirrors header, context bar changes color (green → yellow → red).

### Added (M5 — Release Engineering)
- `bettercode` installable CLI via `npm install -g bettercode`.
- CI: GitHub Actions matrix on macOS + Linux; snapshot parity gate; build artifact verification.
- Telemetry: **off by default** in v1.0. `BETTERCODE_TELEMETRY=1` to opt in (no-op in v1.0; infrastructure ready).
- `BETTERCODE_DEBUG=1` env var (replaces `OPENCODE_TUI_DEBUG`, still accepted for compat).

### Added (M6 — Go TUI Parity)
- `/worktree` slash command and `WorktreePicker` dialog — switch between git worktrees; session state scopes correctly to each worktree.
- Concurrent multi-agent: multiple child agents can stream simultaneously; permissions/questions attributed to the correct parent; `Ctrl+abortChild` / `Ctrl+abortAll` keybindings.

### Added (M8 — Open-source Readiness)
- Per-package `LICENSE` (MIT), `CONTRIBUTING.md`, `NOTICE` (third-party attribution).
- GitHub issue templates (bug, feature request) and PR template.
- Public API surface documented in README under "Stability".

### Platform support
- macOS (tested: iTerm2, Terminal.app, Alacritty, Kitty, Ghostty, WezTerm) ✓
- Linux ✓
- Windows: **not supported in v1.0** — tracked for v1.1.

[Unreleased]: https://github.com/opencode-ai/opencode/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/opencode-ai/opencode/releases/tag/v1.0.0
