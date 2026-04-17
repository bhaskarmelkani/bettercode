# BetterCode v1.0.0 — Stable Release Plan

> **Status:** in progress. Target: cut `v1.0.0` of `packages/tui-ink` and open-source it to the wider opencode community.

## Context

BetterCode is a new Ink-based terminal UI at `packages/tui-ink`, sitting alongside the existing Go TUI (`packages/tui`) and desktop app in this opencode fork. It is fully wired to the real opencode runtime — sessions, streaming, tools, permissions, MCP, slash commands, @-mentions, themes, keybindings, vim mode, prompt history, abort, model/agent pickers — with **zero production mocks**. 306 tests pass; `bun typecheck` is clean.

The UI 3.0 work (milestones M0–M11) is committed, but the product is not shippable yet: the main view isn't snug-fit, mouse drag-to-select is stuck, the composer has a cursor-alignment off-by-one, there's no installable CLI, no CI, no CHANGELOG, no contextual right pane, no worktree/multi-agent parity with the Go TUI. Stability and performance gaps remain too. The package is also not yet prepared for public release (no per-package LICENSE, no CONTRIBUTING, no CoC, unclear public surface).

**v1.0.0 means: flawless on a fresh machine, blazing fast on long transcripts, safe for a first-time user, easy to install, and actually ready to be public.** One cohesive release — bugs, stability, performance, context pane, polish, parity, and open-source readiness — shipped together.

---

## How to use this file (READ THIS FIRST)

**Audience: junior engineer executing milestone-by-milestone.**

### Status markers
- `[ ]` not started
- `[~]` in progress (at most ONE per milestone in your current lane — see "Parallel lanes" below)
- `[x]` done and verified
- `[!]` blocked — add a `> blocker:` line under the task
- `[-]` deliberately deferred to v1.1 — add a `> defer:` line under the task with rationale

### Rules
1. **Execute top to bottom within each lane.** Do not skip tasks or milestones.
2. **One `[~]` at a time per lane.** Finish what you started before picking up the next task.
3. **Update this file as you go.** Flip the checkbox, add notes under "Milestone notes" as you learn things.
4. **Do not start the next milestone** in the same lane until the current milestone's `Handover` section is completed and every task is `[x]` or `[-]`.
5. **If a regression appears** in streaming, scroll, tool collapse, keyboard, resize, session switching, or permission/question flows — stop, fix it, flag it in milestone notes, then continue.
6. **Run validation from `packages/tui-ink`**, never from repo root.
7. **Use `dev` or `origin/dev`** for diffs (no local `main`).
8. **Commit small, commit often.** One task per commit is ideal; at most a few related tasks.
9. **Ask before inventing new abstractions.** Reuse existing utilities; the plan names them where relevant.
10. **When a task description contradicts the current code, trust the code.** Update the task in-place, note the deviation in milestone notes, and carry on. The plan was written from a snapshot and may be stale.

### Parallel lanes

These lanes are independent and can run concurrently once **M0** (baseline) is complete. Keep `[~]` markers separate per lane.

- **Lane A — Product:** M1 → M2 → M3 → M4 → M6
- **Lane B — Release infra:** M5 (CI can start immediately after M0; README/CHANGELOG incremental)
- **Lane C — Open source:** M8 (licensing/CoC) can start anytime after M0

**M7 (release gate) requires all three lanes complete.** Serialize nothing else.

### Validation commands (run from `packages/tui-ink`)

```
bun typecheck
bun test test/
bun test test/<file>.test.ts        # focused
./packages/opencode/bin/bettercode  # from repo root, manual UI
```

### When a task says "verify"
You must do the check and note the result in the milestone notes if it's non-obvious. Don't flip `[x]` unless the verification passed.

### Environment variables (pick a prefix and stick with it)

All new env vars use the `BETTERCODE_` prefix. Existing `OPENCODE_TUI_*` vars stay supported for backward compatibility but are not introduced anywhere new.

- `BETTERCODE_URL`, `BETTERCODE_DIR`, `BETTERCODE_SESSION`, `BETTERCODE_PASSWORD` — already in `src/index.tsx`.
- `BETTERCODE_DEBUG=1` — enable debug log ring buffer (see M2.6).
- `BETTERCODE_TELEMETRY=0` — disable telemetry (see M5.5).
- `BETTERCODE_PERF_HUD=1` — enable in-TUI perf overlay (see M0, M3).

---

## Success criteria for v1.0.0

These are the gates for tagging `v1.0.0`. Each gate maps to the milestone that owns it — don't duplicate verification here.

- [ ] M1 complete: all P1 bugs fixed; snapshots human-reviewed.
- [ ] M2 complete: clean terminal restore on SIGINT/SIGTERM/crash.
- [ ] M3 complete: keystroke-to-paint p95 < 16 ms; 10k-line transcript scrolls at ≥ 30 FPS on M1 (measurement method defined in Appendix A).
- [ ] M4 complete: contextual right pane with 3 modes + `/context`, `/summarize`, `/quality` slash commands.
- [ ] M5 complete: installable CLI via package registry; CI green on macOS + Linux; CHANGELOG, README, telemetry opt-out.
- [ ] M6 complete: worktree support + concurrent multi-agent parity with Go TUI.
- [ ] M7 complete: manual regression pass, security review, release artifact, announcement drafts.
- [ ] M8 complete: per-package LICENSE, CONTRIBUTING, code of conduct, NOTICE for third-party deps.

## Architectural decisions (LOCKED — do not change without asking)

1. **Mouse hooks consolidated** into one `useMouseStream` owning SGR enable/disable + stdin. `useMouse` (wheel) and `useTextSelection` (drag) become subscribers via the existing `mouseScrollEvents` EventEmitter.
2. **Virtualization hand-rolled** in `MessageList`. No new deps.
3. **Store stays monolithic for v1.0.0.** Memoize selectors; defer splitting.
4. **Context pane extends `Sidebar.tsx`** (already has 5 tabs). Three modes: collapsed / compact / expanded. Keyboard resize first (`Ctrl+]`/`Ctrl+[`); mouse drag only if the gate in M4.8 passes.
5. **Copilot insights** use the existing slash + agent pipeline, pinned to a free Copilot SKU (see Appendix D for SKU details).
6. **One big release.** No staggered 0.x cuts.
7. **Windows support is out of scope for v1.0.** Targets: macOS + Linux. Windows is tracked in Appendix E (Deferred to v1.1).
8. **Go TUI (`packages/tui`) stays shipped for v1.0.** No deprecation announcement yet. BetterCode is positioned as the new default but not the only option. Revisit after community feedback on v1.0.

---

## M0 — Baseline (gate for everything else)

**Entry:** plan approved. **Done:** perf baseline recorded, tooling for measurement works, CI skeleton exists.

You cannot prove "no regressions in M1–M4" without knowing where you started. Do this first; it unblocks Lane A and Lane B.

### M0.1 Perf HUD

- [ ] M0.1.a **Create `src/perfHud.tsx`.** Renders in the top-right when `BETTERCODE_PERF_HUD=1`. Shows: FPS (render/sec moving avg over 1s), last keystroke-to-paint latency, SSE flush interval (ms), current visible window size (messages rendered / total).
- [ ] M0.1.b **Instrument keystroke-to-paint** by timestamping in Composer's `useInput` and clearing the timestamp in an effect that fires after the value-to-render commit. Expose via a single `perf` slice in the store.
- [ ] M0.1.c **Instrument frame rate** with a simple requestAnimationFrame-equivalent (Ink re-render callback + wall clock). Cap collection so the HUD itself doesn't perturb the measurement.
- [ ] M0.1.d **Verify**: set `BETTERCODE_PERF_HUD=1`, type a long line, confirm numbers update and look sane.

### M0.2 Record baseline numbers

Run on the reference machine (M1 MacBook Pro 16GB if available, otherwise document what you used). Commit results to `plans/v1.0.0/baseline.md`.

- [ ] M0.2.a **Idle keystroke p50 / p95** at 80x24 with an empty session, 100 messages, 1000 messages, 10000 messages.
- [ ] M0.2.b **Scroll FPS** on 10k-message transcript: page-up repeatedly, record moving average FPS.
- [ ] M0.2.c **Streaming CPU** during a tool-heavy turn: record CPU% of the TUI process (sampled via `ps` or Instruments).
- [ ] M0.2.d **Memory** resident set at each transcript size.

### M0.3 CI skeleton (unblocks Lane B)

- [ ] M0.3.a Create `.github/workflows/tui-ink.yml` with matrix `os: [macos-latest, ubuntu-latest]`, bun latest. Steps: checkout → setup-bun → `bun install` → `cd packages/tui-ink && bun typecheck && bun test test/`.
- [ ] M0.3.b Add a snapshot-parity step: `git diff --exit-code test/__snapshots__` after the test run fails the job.
- [ ] M0.3.c Open a draft PR against `dev` so CI runs on every push; it must stay green for the duration of the plan.

### M0 Handover

- [ ] Baseline file committed to `plans/v1.0.0/baseline.md`.
- [ ] CI green on the draft PR.
- [ ] `BETTERCODE_PERF_HUD=1` works.
- [ ] Commit: `feat: v1.0 M0 baseline + perf HUD`.

---

## M1 — Bug Triage

**Entry:** M0 complete. **Done:** all three P1 bugs fixed, snapshots clean, 306+ tests green, perf HUD shows no regression vs baseline.

### M1.1 Viewport snug-fit — `src/screens/SessionScreen.tsx`

- [ ] M1.1.a **Reproduce the bug** at 80x24, 120x40, 60x20. Note the visible symptom (dead row / clipped row / offset) in milestone notes.
- [ ] M1.1.b **Define `mainHeight`** near line 111 (next to `SIDEBAR_WIDTH`):
      `const mainHeight = Math.max(1, rows - 2) // header (1) + statusbar (1)`.
- [ ] M1.1.c **Replace main row** at line ~229: change `<Box flexDirection="row" flexGrow={1}>` to `<Box flexDirection="row" height={mainHeight}>`.
- [ ] M1.1.d **Fix Sidebar height** at line ~264: change `height={rows - 3}` to `height={mainHeight}`.
- [ ] M1.1.e **Replace magic `- 4`** at line ~236: define `const TRANSCRIPT_HPAD = 4 // matches Box paddingX={2} inside MessageList` next to `SIDEBAR_WIDTH`; use it. Verify the 4 is actually `2 + 2` by reading `MessageList`'s outer Box — if the padding is different, update the constant and comment to match.
- [ ] M1.1.f **Verify**: run bettercode at 80x24, 120x40, 60x20. No dead rows; content reaches StatusBar; Sidebar aligns.
- [ ] M1.1.g **Snapshots**: run `bun test test/`. If `home-*.txt` or `session-mixed-*.txt` fail, diff them manually. Only re-baseline if the change is the intended snug fit. Record the diff summary in milestone notes.

### M1.2 Mouse drag selection — `src/hooks/useMouse.ts`, `src/hooks/useTextSelection.ts`

**Important context the code currently has (read before starting):**
- `useMouse.ts` (34 lines) is the **only** place that enables SGR (`\x1b[?1000h\x1b[?1006h`). Its regex is non-global.
- `useTextSelection.ts` (236 lines) does **not** enable SGR — it only attaches a second `process.stdin` listener and parses with a **global** regex at line 38 (`SGR_RE = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/g`).
- `parseMouse` is a **local** function inside `useTextSelection.ts`, not exported.
- Two stdin listeners + one SGR enable is the real bug: drag events are consumed by one listener and don't reach the other cleanly.

- [ ] M1.2.a **Read** both hooks end-to-end. Write a 4-line summary in milestone notes: where SGR is enabled, where stdin is attached in each, how `parseMouse` differs from `useMouse`'s inline parse.
- [ ] M1.2.b **Create `src/hooks/useMouseStream.ts`.** Owns:
  - A module-level singleton `EventEmitter` (import from `node:events`) with events `motion`, `down`, `up`, `wheelUp`, `wheelDown`.
  - A refcounted `useEffect` that writes `\x1b[?1000h\x1b[?1006h` on the first subscriber and `\x1b[?1006l\x1b[?1000l` when the last unsubscribes.
  - A single `process.stdin.on("data", onData)` listener that buffers the SGR tail (head-truncated at 4 KB if the sequence never terminates) and emits parsed events.
  - Export `parseMouse(s: string): MouseEvent[]` for tests. Move the helper out of `useTextSelection.ts`.
- [ ] M1.2.c **Rewrite `useMouse.ts`** to subscribe to `useMouseStream`'s `wheelUp` / `wheelDown` events and re-emit via the existing `mouseScrollEvents` EventEmitter. Delete the stdin listener and SGR writes. File should shrink to <20 lines.
- [ ] M1.2.d **Rewrite `useTextSelection.ts:173–227`** (the inner `useEffect`) to subscribe to `useMouseStream` events instead of attaching its own stdin listener. Delete the local `parseMouse` (now imported). Keep the selection state machine, `doCopy`, and the `setRange` logic intact.
- [ ] M1.2.e **Add `test/mouseStream.test.ts`** with fixtures for the SGR byte sequences of: left down, motion with left held, release, wheel up/down, an interrupted sequence (partial buffer). Assert the emitter fires the right events in order.
- [ ] M1.2.f **Button-code helpers**: add `isLeftDown(btn)`, `isMotion(btn)`, `isRelease(btn, char)` inside the new module with unit tests in the same file.
- [ ] M1.2.g **Test matrix** (check each): iTerm2, Terminal.app, Alacritty, Kitty, Ghostty, tmux, WezTerm. Click-drag-release in transcript, confirm selection renders and clipboard copy fires. Record results per emulator in milestone notes.
- [ ] M1.2.h **Regression**: scroll wheel still scrolls; no "stuck" drag state; resizing the terminal mid-drag cancels cleanly. Specifically: click-drag, then SIGWINCH via `resize`, then release — no stuck highlight.

### M1.3 Composer cursor-at-end — `src/components/Composer.tsx:913`

- [ ] M1.3.a **Read the current width math** at line 913 (`const fill = Math.max(0, width - LEAD - body.length - (cursorAtEnd ? 1 : 0))`). The `cursorAtEnd ? 1 : 0` exists because the caret renders an extra space when past end of line. Write the 1-line reason in milestone notes.
- [ ] M1.3.b **Fix the math** so the branch is unnecessary. Preferred: reserve the trailing cursor column in the base `fill` calculation (always subtract 1 for the caret cell) rather than as a special case. Confirm `body.length` accounting is consistent.
- [ ] M1.3.c **Update existing snapshots** (`home-80x24.txt`, `session-mixed-80x24.txt`, any other affected) after human review of the diff. Do **not** create a parallel snapshot file — the existing fixtures already cover this path. Record which snapshot lines changed and why in milestone notes.
- [ ] M1.3.d **Add one focused unit test** in `test/composer-fill.test.ts` that asserts `fill >= 0` for: empty line, 1-char line with cursor at end, exact-width line. Keep it tight; snapshots own the visual check.

### M1 Handover (fill before starting M2)

- [ ] Every M1 task is `[x]` or `[-]`.
- [ ] `bun typecheck` clean.
- [ ] `bun test test/` — full pass.
- [ ] Manual regression checklist (bottom of file) — every item checked.
- [ ] **Perf HUD**: same or better than M0 baseline at 100-msg and 1000-msg.
- [ ] **Write in "M1 notes":** terminal emulators tested, any quirks observed, any follow-ups deferred.
- [ ] Commit message: `feat: v1.0 M1 bug triage complete`.

---

## M2 — Stability & Lifecycle

**Entry:** M1 handover complete. **Done:** zero unhandled rejections, clean exit on every signal, streaming resilient to disconnect, debug logging for post-mortems.

### M2.1 Terminal cleanup on exit

- [ ] M2.1.a **Create `src/terminalCleanup.ts`**. Export `installTerminalCleanup()` that:
  - Tracks an `installed` boolean for idempotency.
  - Registers on `exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, `uncaughtException`, `unhandledRejection`.
  - Writes `\x1b[?1006l\x1b[?1000l\x1b[?1049l\x1b[?25h` on fire (disable mouse, leave alt screen, show cursor).
  - For `uncaughtException` / `unhandledRejection`: write to the debug log (M2.6) then re-throw so the default crash behavior still prints the stack.
- [ ] M2.1.b **Call `installTerminalCleanup()` from `src/index.tsx`** as the first statement of `startTuiInk`, before any `render` or `useAppStore.setState`.
- [ ] M2.1.c **Verify**: in three separate terminal sessions:
  1. `kill -9` the TUI → next prompt has visible cursor, no mouse reporting, no alt-screen residue.
  2. `kill -INT` → same.
  3. Throw from a dev-only component (guard behind `BETTERCODE_DEBUG_THROW=1`) → same, plus the stack lands in the debug log.
- [ ] M2.1.d **Verify tmux + nested tmux** do not double-toggle alt-screen. Specifically: start tmux → start bettercode → C-b d (detach) → reattach → TUI still visible and responsive.

### M2.2 Prefs write hardening — `src/index.tsx:64–85`

- [ ] M2.2.a **Add `.catch`** to the `readPrefs().then(...)` chain at line 73. Log failures via `debugLog` (M2.6), not `console.error` (console writes would corrupt the TUI frame).
- [ ] M2.2.b **Serialize writes**: introduce an in-flight lock + single-pending coalesce. Pattern:
  ```ts
  // pseudocode — adapt to project style
  let writing = false
  let pending: Prefs | undefined
  const flush = async () => { ... }
  ```
  One active write at a time; if a new change arrives while writing, replace `pending` and flush after the current one.
- [ ] M2.2.c **Atomic file write**: write to `${PREFS_PATH}.tmp` then `rename` to `PREFS_PATH`. This is the correction for "corrupt prefs on crash mid-write."
- [ ] M2.2.d **Verify** by rapidly toggling theme 20× in a second and then reading the file. Expected: settles on the final value, never truncated or half-JSON.

### M2.3 Atomic streaming deltas — investigation first

> **IMPORTANT — prior plan was wrong here.** `store.ts:538 appendPartDelta` is **already** a functional `set((prev) => ...)` with a new array, new part object, and new `parts` map. Do **not** "rewrite" it blind. The real question is whether deltas are actually being dropped and, if so, why.

- [ ] M2.3.a **Write a failing test first** in `test/streaming-atomic.test.ts`: fire 100 rapid `appendPartDelta` calls against the same `(messageID, partID, field)` from a tight loop and a `Promise.resolve()` chain. Assert the concatenated output equals the expected string. If the test passes on the current code, M2.3 is already done — record that result in milestone notes, mark M2.3.b–M2.3.c as `[-]` with `> defer: no repro` and move on.
- [ ] M2.3.b **Only if the test fails:** add a second test that interleaves `appendPartDelta` with other reducers (`upsertMessage`, `finalizePart`) to isolate whether the issue is within `appendPartDelta` or at a higher boundary (e.g., React batching swallowing intermediate `set` calls).
- [ ] M2.3.c **Only if the test fails:** fix the identified cause. Possible fixes: micro-batching deltas in the SSE handler, switching to a queue pattern, using `unstable_batchedUpdates`. The fix depends on the diagnosis — do not pre-commit to one.

### M2.4 SSE resilience — `src/hooks/useSDK.ts`

- [ ] M2.4.a **On disconnect** (SSE error or close), set `syncStatus='partial'` and schedule a reconnect with exponential backoff (1s → 2s → 4s → 8s, cap 30s, reset on successful reconnect).
- [ ] M2.4.b **Resume from last event ID** if the server emits one (honor `Last-Event-ID` on reconnect). If the server does not support it, document the limitation in milestone notes and just resubscribe — do **not** fabricate an ID scheme.
- [ ] M2.4.c **Integration test** `test/resilience.test.ts`: simulate a server disconnect + reconnect against a local mock server (or the real `packages/opencode` if convenient); assert no duplicate messages and no lost deltas on the reconnect path.
- [ ] M2.4.d **Toast on degraded state**: when `syncStatus='partial'` persists > 2s, show a subtle toast "Reconnecting…" via `ToastOverlay`. Clear on recovery.

### M2.5 Error boundaries

- [ ] M2.5.a **Wrap `Sidebar`** with `ErrorBoundary` in `SessionScreen.tsx` (transcript and dock are already wrapped — copy that pattern).
- [ ] M2.5.b **Wrap `Composer`** the same way.
- [ ] M2.5.c **Verify** by throwing from inside each component behind `BETTERCODE_DEBUG_THROW_COMPONENT=sidebar|composer` — the rest of the UI stays live, error lands in debug log.

### M2.6 Debug log ring buffer

- [ ] M2.6.a **Create `src/debugLog.ts`** with `log(level, msg, ctx?)`:
  - Writes to `${paths.stateDir}/bettercode/tui.log`.
  - `stateDir` resolution (in order): `$BETTERCODE_STATE_DIR`, `$XDG_STATE_HOME`, `~/Library/Logs` on macOS, `~/.local/state` on Linux. Put this resolution in `src/paths.ts` — a new tiny utility — so other code reuses it.
  - Gated by `process.env.BETTERCODE_DEBUG === '1'` (legacy: accept `OPENCODE_TUI_DEBUG` as alias).
  - Append-only; each line is JSON-stringified `{ts, level, msg, ctx}`.
- [ ] M2.6.b **Size cap**: if file > 5 MB, rename to `.log.1` (overwriting any previous `.log.1`) and start fresh.
- [ ] M2.6.c **Wire it into** SSE disconnect (M2.4), prefs save failure (M2.2), error-boundary falls (M2.5), terminal cleanup (M2.1).
- [ ] M2.6.d **Redaction** — strip anything that looks like a bearer token, env-var secret, or the user's cwd absolute path before writing. Tests in `test/debugLog.test.ts` cover each redaction class.

### M2 Handover (fill before starting M3)

- [ ] Every M2 task is `[x]` or `[-]` (with documented reason).
- [ ] `bun typecheck` + `bun test test/` green.
- [ ] Manual chaos test done: killed server mid-stream, `SIGSTOP`/`SIGCONT`, rapid resize during generation. All survived.
- [ ] **Write in "M2 notes":** whether M2.3 repro'd, any SDK/server changes needed for Last-Event-ID, any recovery edge cases observed.
- [ ] Commit: `feat: v1.0 M2 stability & lifecycle complete`.

---

## M3 — Performance

**Entry:** M2 handover complete. **Done:** keystroke p95 < 16 ms on all transcript sizes from M0.2; scroll FPS ≥ 30 on 10k-message transcript; no regression in CPU or memory vs baseline.

### M3.1 Memoize `computeHighlights` — `src/components/Composer.tsx:728`

- [ ] M3.1.a Wrap the call with `useMemo` keyed on `[value, theme]`. Pull `theme` reference once at the top of the component if it isn't already stable (check ThemeProvider behavior).
- [ ] M3.1.b Verify via perf HUD: type a 200-char line; p95 keystroke must not regress from M0 baseline.

### M3.2 Memoize search matches — `src/components/MessageList.tsx:833`

- [ ] M3.2.a Add `partsVersion: number` to the store, incremented on each delta flush (or on finalize, whichever covers the cases the memo depends on).
- [ ] M3.2.b `useMemo` the match computation keyed on `[messages, partsVersion, searchQuery]`.
- [ ] M3.2.c Verify: 100-message transcript with active search; scroll FPS stays ≥ 30.

### M3.3 Windowed message rendering — `MessageList.tsx`

> **This is the highest-risk task in M3.** Keep selection correctness ahead of the windowing micro-optimization — a broken drag-select is worse than a slow scroll.

- [ ] M3.3.a **Derive `visibleStart` / `visibleEnd`** from the existing scroll offset + `heightCache`. Overscan = 5 messages on each side.
- [ ] M3.3.b **Render only the window.** Off-window messages render `null` but occupy cached height via a spacer `<Box height={n} />`. The scroll offset math must stay identical — do not adjust it to compensate.
- [ ] M3.3.c **Selection correctness above all.** `selectionRows` / `sliceSelection` must continue to work on the original message indices. Virtualization lives *above* selection — when a drag extends into an off-window message, map coords using the *full* message list, not the windowed subset. Add a dedicated helper if this gets twisty.
- [ ] M3.3.d **Design the edge cases before coding.** Enumerate in milestone notes:
  - Drag starts in window, ends off-window below (forces scroll).
  - Drag starts off-window above (only possible with prior manual scroll up followed by click before window recomputes — describe expected behavior).
  - Search-highlight span that crosses a window boundary.
  - Copy-on-release when the end coord is in a spacer region.
- [ ] M3.3.e **Test** `test/virtualization.test.ts`: 1000-message fixture; assert only windowed children render; assert scroll-to-bottom snaps; assert drag selection across window boundary captures the correct text; assert search-match coords map correctly.

### M3.4 Collapse `SessionScreen` selectors

- [ ] M3.4.a Consolidate the 30+ `useAppStore(...)` calls in `src/screens/SessionScreen.tsx` into one selector returning a shallow-equal object via `useShallow` (already imported at line 4).
- [ ] M3.4.b Install a dev-only render counter behind `BETTERCODE_DEBUG_RENDERS=1`. Confirm re-renders drop on deltas where none of the selected fields changed.
- [ ] M3.4.c Verify no behavioral regression: every field still reads the same value path; subscriptions still fire when expected.

### M3.5 Adaptive SSE batching — `useSDK.ts`

- [ ] M3.5.a Expose `tailVisible: boolean` from the store (MessageList already knows whether the user is at bottom — lift that bit into the store or compute from scroll offset + transcript length).
- [ ] M3.5.b In the delta batcher, set flush interval to 16 ms when `tailVisible && generating`, else 50 ms. Test both settings reflect correctly via the perf HUD.

### M3.6 Debounce `marked.lexer`

- [ ] M3.6.a In `MessageList` height estimation, memoize per-part lex output keyed on the part's text identity (reference equality on the text string works if the reducer reuses strings; otherwise use a WeakMap keyed on the part object).
- [ ] M3.6.b 50 ms debounce for parts currently being streamed; final lex on part finalize.
- [ ] M3.6.c Verify: streaming a 10 KB assistant message shouldn't spike CPU per delta.

### M3 Handover (fill before starting M4)

- [ ] Every M3 task `[x]` or `[-]`.
- [ ] Perf numbers captured in `plans/v1.0.0/baseline.md` under "post-M3". Must meet the success criteria above.
- [ ] `bun typecheck` + `bun test test/` green. New perf tests in `test/perf/` passing.
- [ ] Commit: `feat: v1.0 M3 perf complete`.

---

## M4 — Context Pane (the "work-with-you" surface)

**Entry:** M3 handover complete. **Done:** 3-mode sidebar, session overview band, `/context` + `/summarize` + `/quality` slash commands with defined failure UX.

Build on `src/components/Sidebar.tsx` (existing tabs: diff/todos/lsp/mcp/caps). Extend, don't replace.

### M4.1 Three view modes

- [ ] M4.1.a **Define mode type** in `store.ts`: `type SidebarMode = 'collapsed' | 'compact' | 'expanded'`. Store under `sidebarMode` with default `'collapsed'`. Persist via existing `savePrefs`.
- [ ] M4.1.b **Keybindings** in `src/keybindings/defaults.ts`: `Ctrl+]` → `sidebarModeNext`, `Ctrl+[` → `sidebarModePrev`. Register actions in `src/keybindings/schema.ts`.
- [ ] M4.1.c **Wire actions** in `SessionScreen.tsx` `useInput` handler next to the existing `toggleSidebar`.
- [ ] M4.1.d **Widths**: collapsed=4, compact=32 (current `SIDEBAR_WIDTH`), expanded=56. Export from a single constant.
- [ ] M4.1.e **Force collapsed** when `columns < SIDEBAR_MIN` (80).
- [ ] M4.1.f **Snapshot tests** for each mode at 80x24 and 120x40 in `test/__snapshots__/frames/sidebar-*.txt`.

### M4.2 Session overview band

Renders at the top of `Sidebar.tsx` in all modes (icon strip when collapsed; full band when compact/expanded).

- [ ] M4.2.a **Session title, model, agent, branch** — pull from existing store fields.
- [ ] M4.2.b **Context usage** (`used / limit` tokens + bar). **Reuse `src/components/TokenWarning.tsx` logic** — do not duplicate. If it isn't already a pure function, refactor it to one and have `TokenWarning` consume it.
- [ ] M4.2.c **Time-to-compaction** estimate: rolling token rate over the last N seconds × remaining headroom. Helper in `src/utils/compactionETA.ts` with unit tests.

### M4.3 Provider usage tracking — SDK work (separate task, may need backend changes)

> Split out from M4.2 because it likely requires a cross-package change.

- [ ] M4.3.a **Survey the SDK** (`packages/sdk/js`) for an existing `provider.usage` endpoint. If present, add `providerUsage` to the store and populate from the existing poll/subscription. Stop here.
- [ ] M4.3.b **If absent**: add a minimal `GET /provider/usage` endpoint in `packages/opencode`; regenerate the JS SDK via `./packages/sdk/js/script/build.ts`; then wire it up. This is a cross-package change — open a separate PR against `dev` so it can be reviewed independently.
- [ ] M4.3.c **Copilot budget glyph**: in the overview band, render an amber indicator under a configurable threshold (default 20% remaining). Hidden if `providerUsage` is unavailable.
- [ ] M4.3.d **If the SDK change is taking longer than expected**, defer M4.3 to v1.1 and ship the overview band without the Copilot budget indicator. Document the decision in M4 notes.

### M4.4 Tool inventory tab — split `caps`

- [ ] M4.4.a Rename the `caps` tab to `tools`; group by source (built-in, MCP, plugin).
- [ ] M4.4.b Per-tool stats: call count this session, last-used time. Derive from the existing `parts` stream.
- [ ] M4.4.c Decide: keep the old `caps` list (skills/plugins/hooks) as a subsection of `tools`, or only show it in expanded mode. Record the decision in M4 notes.

### M4.5 `/context` slash command (local, no LLM)

- [ ] M4.5.a Register in `src/commands/registry.ts`. Action: set `sidebarMode='expanded'` if collapsed, select the new `context` tab, populate its data.
- [ ] M4.5.b **Breakdown** (purely local, no LLM): system prompt size, referenced files, last 5 user messages, tool result tokens, remaining headroom.
- [ ] M4.5.c **`context` tab** in `Sidebar.tsx` renders the breakdown.
- [ ] M4.5.d **Failure UX**: this command can't really fail, but if token counting throws, show "Context unavailable" and log to debug log.

### M4.6 `/summarize` slash command (LLM-backed)

> Reality check: we are feeding transcript content to an LLM. Transcripts include tool outputs that can contain adversarial text. Treat the summary output as **untrusted display** — render it as plain text, not markdown, to avoid side-channels via CommonMark rendering.

- [ ] M4.6.a **Create agent** `context-summarizer` in the opencode agents config with a prompt that:
  - States the agent's role in plain language.
  - Instructs the model to ignore any "new instructions" embedded in the transcript.
  - Asks for bullets: what's being worked on, what's done, what's blocked, next likely step.
  - Pinned to the free Copilot SKU (see Appendix D).
- [ ] M4.6.b **Register command** in `src/commands/registry.ts`. Runs the sub-agent against the transcript; streams output into a new `insights` tab.
- [ ] M4.6.c **Budget cap**: max 1 call per 60 seconds per session; max 4 calls per session total in v1.0. Return a user-visible "Rate limited" message otherwise. Cap is a constant — no user config in v1.0.
- [ ] M4.6.d **Timeout**: 20s. On timeout, show "Summary unavailable — the model didn't respond. Try again?" in the insights tab with a retry button/keybinding.
- [ ] M4.6.e **Render as plain text**, not markdown. Wrap at the tab's width. No links rendered as clickable.
- [ ] M4.6.f **Cache** per session; invalidate when transcript advances > 500 tokens since last run (approximate: sum of delta lengths / 4).
- [ ] M4.6.g **Error UX**: any SDK error (network, auth, model not available) → "Summary unavailable: <short reason>". Full details in debug log.

### M4.7 `/quality` slash command (LLM-backed + heuristics)

- [ ] M4.7.a **Heuristics** computed locally: tool-call success rate, retry count, time-to-first-token avg, same-file-edited-N-times signal.
- [ ] M4.7.b **LLM pass** on the heuristics + recent transcript, same `insights` tab. Free Copilot SKU.
- [ ] M4.7.c **Budget cap, timeout, render, error UX** — identical rules to `/summarize`. Extract into a shared helper in `src/commands/insights.ts`.
- [ ] M4.7.d **Cache** — same policy as `/summarize`, keyed per command name.

### M4.8 Live indicators in collapsed mode

- [ ] M4.8.a Context-bar glyph color: green > 40% headroom, yellow 15–40%, red < 15%.
- [ ] M4.8.b Tool-running spinner mirrors the header spinner when generating.
- [ ] M4.8.c Copilot-budget glyph (if M4.3 shipped) turns amber under 20%.

### M4.9 Mouse drag-resize (gated — concrete disqualifiers)

- [ ] M4.9.a Drag zone on the pane's left border (1-column hit area).
- [ ] M4.9.b Snap to the three mode widths; freeform only if `prefs.sidebarFreeResize === true` (not exposed in UI for v1.0).
- [ ] M4.9.c **Ship gate — disqualify if any of these are true:**
  1. Any test in `test/mouseStream.test.ts` or `test/virtualization.test.ts` becomes flaky.
  2. Measured input latency during an active drag-resize > 50 ms at 120 columns (use perf HUD).
  3. Any emulator in the M1.2 matrix exhibits dropped selection events after implementing drag-resize.
  4. Drag-resize in tmux double-toggles anything or leaves residue after release.
- [ ] M4.9.d If disqualified, mark M4.9 as `[-]` and add `> defer: drag-resize gated out, v1.1 follow-up tracked`. Record the specific failing criterion in M4 notes.

### M4 Handover (fill before starting M5-finish / M6)

- [ ] Every required M4 task `[x]` or `[-]`.
- [ ] Snapshot tests green for all 3 modes at both sizes.
- [ ] **Manual**: trigger `/context`, `/summarize`, `/quality` on a live session; verify output sensible; verify caching; verify rate-limit and timeout paths (force a bad endpoint to test).
- [ ] **Verify**: context-bar color transitions as tokens grow.
- [ ] **Write in "M4 notes":** whether M4.3 (provider usage) and M4.9 (drag-resize) shipped or deferred; any SDK changes made; LLM cost observations over a test session.
- [ ] Commit: `feat: v1.0 M4 context pane complete`.

---

## M5 — Release Engineering (Lane B — starts after M0.3)

**Entry:** M0.3 CI skeleton green. **Done:** installable CLI, CI green on macOS + Linux, CHANGELOG drafted, README updated, telemetry audit complete, plan docs synced. Portions of M5 land incrementally alongside Lane A milestones.

### M5.1 `bin` entry

- [ ] M5.1.a `packages/tui-ink/package.json`:
  - Add `"bin": { "bettercode": "./dist/cli.js" }`.
  - Add `"files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]`.
  - Add `"engines": { "bun": ">=1.2" }`.
  - Bump `"version"` to `"1.0.0"`.
  - **Decide package name** (record in M5 notes): keep `@opencode-ai/tui-ink` OR rename to `bettercode`. If renaming, coordinate with registry owner and add `"publishConfig": { "access": "public" }`.
- [ ] M5.1.b Create `src/cli.ts` — minimal wrapper that imports the existing bootstrap in `src/index.tsx` (block at `if ((import.meta as any).main)`). Extract that block into an exported `main()` in `index.tsx` and have `cli.ts` call it; do **not** duplicate the env-var parsing.
- [ ] M5.1.c Update the `build` script to produce `dist/cli.js` with `#!/usr/bin/env bun` shebang and executable bit. Verify the shebang survives the bundler; if not, post-process with a small script.
- [ ] M5.1.d **Verify**: `bun link` locally, `cd /tmp && bettercode` launches the TUI against a running opencode server.

### M5.2 CI (started in M0.3, finalized here)

- [ ] M5.2.a Extend the workflow: run `bun build` and fail if the CLI artifact is missing or non-executable.
- [ ] M5.2.b Add a job that runs against the **published dry-run tarball** (`npm pack`) to catch `files` field misconfigurations.
- [ ] M5.2.c Verify the workflow runs green on a PR that introduces a known snapshot diff — it must **fail** (anti-regression test for the CI gate itself).

### M5.3 CHANGELOG

- [ ] M5.3.a Create `packages/tui-ink/CHANGELOG.md` in Keep-a-Changelog format with an `[Unreleased]` section. Update incrementally as milestones land — don't write it all at the end.
- [ ] M5.3.b Final `[1.0.0]` entry: **Initial public release.** Summarize capabilities: bug fixes (M1), stability (M2), perf (M3), context pane (M4), release engineering (M5), parity (M6), open-source readiness (M8). There are no breaking changes to document — this is the first version.

### M5.4 README updates (`packages/tui-ink/README.md`)

- [ ] M5.4.a Install-from-registry section (matches the name decided in M5.1.a).
- [ ] M5.4.b Platform support: macOS + Linux. Windows explicitly listed as "not supported in v1.0; tracked for v1.1."
- [ ] M5.4.c Troubleshooting:
  - Terminal left in mouse mode → run `reset`.
  - Crash recovery (debug log path, how to file a bug).
  - Supported terminal emulators (results from M1.2.g).
  - Nested tmux caveats (from M2.1.d).
- [ ] M5.4.d Keybinding reference including `Ctrl+]`/`Ctrl+[`.
- [ ] M5.4.e Slash-command catalog: `/context`, `/summarize`, `/quality`, `/worktree`. Each with a 1-line purpose and an example.
- [ ] M5.4.f Env-var reference (see "Environment variables" section at the top of this plan).
- [ ] M5.4.g Accessibility note (brief): v1.0 is a best-effort for screen readers and high-contrast themes. Known limitations listed. Feedback invited.

### M5.5 Telemetry audit

> **Scope correction vs prior plan:** audit is **not** limited to `useSDK.ts` + `index.tsx`. Telemetry can live in `packages/opencode`, the SDK, or plugins.

- [ ] M5.5.a **Grep audit** across the repo for outbound analytics patterns: `posthog`, `mixpanel`, `segment`, `amplitude`, `analytics`, `fetch(` to known telemetry domains, `track(`, `capture(`, `identify(`.
- [ ] M5.5.b **Network trace** the TUI on a fresh session end-to-end with a local proxy (mitmproxy or similar). Record every outbound domain. Commit the list to milestone notes.
- [ ] M5.5.c **Route** any TUI-originated telemetry through a new `src/telemetry.ts` gate that checks `process.env.BETTERCODE_TELEMETRY !== '0'`. Default behavior (env unset) is **off** for v1.0 — we opt in later, not silently on.
- [ ] M5.5.d **README statement**: state the exact data sent (if any) and how to disable it. "BetterCode sends no telemetry in v1.0" is acceptable only if the audit confirms it.

### M5.6 Sync planning docs

- [ ] M5.6.a Update `plans/ui-3.0/implementation.md` checkboxes to reflect the committed M0–M11 work.
- [ ] M5.6.b Summarize completed milestones in the CHANGELOG entry.
- [ ] M5.6.c Move `plans/ui-3.0/` → `plans/archive/ui-3.0/` after v1.0 ships (do this in M7, not earlier, so the links in doc comments stay valid during development).

### M5 Handover

- [ ] Every M5 task `[x]` or `[-]`. CI green on a PR.
- [ ] Local `bun link` + `bettercode` works from outside the repo.
- [ ] **Write in "M5 notes":** package name decision, telemetry audit result, domains observed in the network trace.
- [ ] Commit: `feat: v1.0 M5 release engineering complete`.

---

## M6 — Feature Parity with Go TUI

**Entry:** M5 handover complete (CLI + CI); M4 handover complete. **Done:** worktrees + concurrent multi-agent reach Go TUI parity as defined in Appendix B.

### M6.1 Worktrees

- [ ] M6.1.a **Survey**: identify existing worktree SDK endpoints (grep opencode server + SDK). List gaps in M6 notes.
- [ ] M6.1.b **Gap fill**: if endpoints missing, add them in `packages/opencode` and regenerate the SDK. Separate PR.
- [ ] M6.1.c Create `WorktreePicker` component reusing `SessionListDialog` list patterns and existing `Dialog` dispatch.
- [ ] M6.1.d Register `/worktree` slash command in `src/commands/registry.ts`.
- [ ] M6.1.e Add to command palette.
- [ ] M6.1.f **Verify**: in a repo with at least 2 worktrees, switch between them; session state scopes correctly; branch indicator updates.

### M6.2 Concurrent multi-agent

> This was under-specified in the original plan. Treat it as **six** tasks, not three.

- [ ] M6.2.a **Document current behavior**: grep `parentID`, `agent`, any lock-like pattern in `store.ts` and `useSDK.ts`. Write a 10-line description in M6 notes of how sequential runs are currently enforced and what state the UI tracks per child.
- [ ] M6.2.b **Design doc** (inline, in M6 notes): what changes in the store when N sub-agents run concurrently? Specifically:
  1. How are deltas routed to the right message when two children stream simultaneously?
  2. How are permissions/questions attributed back to the correct parent? (Confirm `parentID` filter in `SessionScreen` suffices.)
  3. What's the abort semantics — abort one child vs all? Which keybinding?
  4. What happens to the header spinner when 2+ children are generating?
- [ ] M6.2.c **Lift the sequential lock** based on the design doc. Single focused commit.
- [ ] M6.2.d **UI affordance**: status bar or sidebar indicator showing "N children active". Pinpoint where.
- [ ] M6.2.e **Abort semantics**: explicit keybinding to abort a specific child (picker) and a second to abort-all. Register both in `keybindings/schema.ts`.
- [ ] M6.2.f **Verify**: spawn two sub-agents; both stream concurrently; permissions/questions from each appear under the right parent; aborting one doesn't kill the other.
- [ ] M6.2.g **Test** `test/multiAgent.test.ts`: deterministic fixtures for two parallel child streams; assert messages don't cross-contaminate; assert abort-one vs abort-all.

### M6.3 LSP completions in composer — evaluate then decide

- [ ] M6.3.a **Timebox to 1 day**: read current LSP wiring; prototype hover/completion in the composer menu alongside slash commands and mentions.
- [ ] M6.3.b **Decide at the end of the day**: include in v1.0 or defer to v1.1. Mark `[-]` with `> defer:` if the 1-day prototype isn't clearly shippable.

### M6 Handover

- [ ] Every non-deferred M6 task `[x]`.
- [ ] **Parity check** (Appendix B) — every item checked or explicitly deferred with rationale.
- [ ] **Write in "M6 notes":** final decision on LSP completions; any SDK changes required; multi-agent design doc.
- [ ] Commit: `feat: v1.0 M6 parity complete`.

---

## M7 — Release Gate (requires Lanes A, B, C complete)

**Entry:** M1–M6 handovers complete, M8 handover complete. **Done:** `v1.0.0` tagged and published.

### M7.1 Full manual regression

- [ ] M7.1.a Run the full checklist at the bottom of this file. Every item checked.
- [ ] M7.1.b On a fresh machine (or fresh `bun install` in a new directory): `npm i -g <pkg-name>@1.0.0` from the tarball, launch, confirm it works with zero extra setup.

### M7.2 Security review

> Promoted from a single checkbox to a first-class review. See Appendix C for the specific surfaces.

- [ ] M7.2.a Walk through every surface in Appendix C. For each, record in M7 notes: "safe / mitigated / follow-up."
- [ ] M7.2.b **Secrets in logs**: grep the debug-log redaction tests (M2.6.d); add cases for any new patterns found.
- [ ] M7.2.c **Prefs file permissions**: confirm `~/.config/bettercode/prefs.json` is written with `0600` on Unix. Fix if not.
- [ ] M7.2.d **MCP transport auth**: confirm no credentials log on connection failure.
- [ ] M7.2.e **Prompt-injection stance**: confirm the `/summarize` and `/quality` paths render plain text (M4.6.e) and that the agent prompts ignore injected instructions.

### M7.3 Tag and publish

- [ ] M7.3.a Run `packages/tui-ink/script/build.ts` (or `bun run build`) clean. Artifact lives under `dist/`.
- [ ] M7.3.b `git tag v1.0.0` on `dev` (or the release branch you merged to).
- [ ] M7.3.c Publish to the registry (`npm publish` or project equivalent). Use `--access public` if the package name is unscoped.
- [ ] M7.3.d Smoke test the published artifact from a temp directory.

### M7.4 Announcements

- [ ] M7.4.a Draft GitHub release notes from the CHANGELOG.
- [ ] M7.4.b Draft opencode community announcement (short, link-heavy).
- [ ] M7.4.c Draft internal Glovo post.
- [ ] M7.4.d **Archive planning docs**: `git mv plans/ui-3.0 plans/archive/ui-3.0`.

### M7.5 Post-release

- [ ] M7.5.a Monitor issue tracker for the first 48 hours; triage incoming bugs into v1.0.1 (patches) or v1.1 (features).
- [ ] M7.5.b **Write in "M7 notes":** release date, any last-minute changes, links to announcements, hotfix plan if applicable.

---

## M8 — Open-source readiness (Lane C — parallel with M1–M6)

**Entry:** M0 complete. **Done:** package is legally and culturally ready for public consumption.

### M8.1 Licensing

- [ ] M8.1.a **Verify repo LICENSE** at the root; confirm the TUI package inherits it. If the root LICENSE is permissive (MIT/Apache-2.0), add a copy at `packages/tui-ink/LICENSE` so the published tarball includes it.
- [ ] M8.1.b **Third-party attribution**: generate `packages/tui-ink/NOTICE` listing direct dependencies and their licenses. A small script in `packages/tui-ink/script/notice.ts` is fine; don't hand-maintain.

### M8.2 Contribution docs

- [ ] M8.2.a **Verify repo `CONTRIBUTING.md`**. Add a `packages/tui-ink/CONTRIBUTING.md` with TUI-specific guidance (how to run, how to add snapshots, what tests to run, coding conventions from `CLAUDE.md`).
- [ ] M8.2.b **Code of conduct**: verify repo-level CoC. Reference from the TUI package README — don't duplicate.

### M8.3 Issue and PR templates

- [ ] M8.3.a `.github/ISSUE_TEMPLATE/bug_report.md` scoped to `bettercode`. Prompts for OS, terminal emulator, output of `bettercode --version`, relevant section of the debug log.
- [ ] M8.3.b `.github/ISSUE_TEMPLATE/feature_request.md`.
- [ ] M8.3.c `.github/pull_request_template.md` with a minimal checklist.

### M8.4 Public API surface definition

> "1.0" is a semver promise. Decide now what we're promising, before users start importing internals.

- [ ] M8.4.a **Document the public surface** in `packages/tui-ink/README.md` under "Stability":
  - The `bettercode` binary (positional args, env vars, exit codes).
  - The `startTuiInk({ url, directory, headers, sessionID })` function export.
  - Env vars listed above.
  - Everything else (React components, hooks, store internals) is **internal and may change in minor releases.**
- [ ] M8.4.b **Enforce** by not adding anything to `exports` in `package.json` beyond `.` → `./src/index.tsx` (and the bin). Confirm this before release.

### M8 Handover

- [ ] Every M8 task `[x]`.
- [ ] Commit: `feat: v1.0 M8 open-source readiness complete`.

---

## Manual regression checklist

Re-run after every milestone.

- [ ] Launch at 80x24
- [ ] Launch at 120x40
- [ ] Launch at 60x20 (narrow snug-fit)
- [ ] Home screen: empty/loading/ready
- [ ] Existing session: transcript renders
- [ ] Streaming: sticky-bottom works
- [ ] Scroll up mid-stream: detached scroll works
- [ ] Snap-to-bottom: stream catches up cleanly
- [ ] Tool-heavy turn: collapsed + expanded tool calls
- [ ] Dock dialog open/close
- [ ] Sidebar: cycle collapsed ↔ compact ↔ expanded (M4+)
- [ ] Sidebar: `/context`, `/summarize`, `/quality` populate tabs (M4+)
- [ ] Sidebar: `/summarize` handles timeout + rate-limit gracefully (M4+)
- [ ] Sidebar: context bar reflects token headroom; turns red near compaction (M4+)
- [ ] Permission prompt: keyboard answer
- [ ] Question prompt: keyboard answer + reject
- [ ] Session switch: per-session scroll + message loading; sidebar mode persists (M4+)
- [ ] Resize idle
- [ ] Resize during streaming
- [ ] Mouse drag-to-copy in iTerm2, Terminal.app, Alacritty, tmux
- [ ] Mouse scroll wheel
- [ ] Sidebar mouse drag-resize (if enabled, M4.9)
- [ ] Composer: cursor movement, word delete, paste, image paste
- [ ] Slash menu, @-mentions, command palette
- [ ] Vim mode on/off
- [ ] `kill -9` then new shell — no residual mouse/alt-screen state
- [ ] Crash during streaming (simulated with `BETTERCODE_DEBUG_THROW`) — terminal restored, log written
- [ ] Long transcript (>1000 messages) scrolls smoothly
- [ ] Worktree switch (M6+)
- [ ] Concurrent sub-agents (M6+)
- [ ] Abort single child vs abort-all (M6+)
- [ ] Fresh-machine install: `bun link` + `bettercode` from `/tmp`

## Critical files

- `packages/tui-ink/src/screens/SessionScreen.tsx` — viewport, selector fan-out, sidebar integration
- `packages/tui-ink/src/components/Sidebar.tsx` — 3 modes, overview band, insights tab
- `packages/tui-ink/src/components/TokenWarning.tsx` — reuse for context-bar math
- `packages/tui-ink/src/components/MessageList.tsx` — virtualization, memoization
- `packages/tui-ink/src/components/Composer.tsx` — cursor bug, highlight memo
- `packages/tui-ink/src/hooks/useMouseStream.ts` — NEW (M1.2)
- `packages/tui-ink/src/hooks/useMouse.ts` — refactor to subscriber
- `packages/tui-ink/src/hooks/useTextSelection.ts` — refactor to subscriber
- `packages/tui-ink/src/hooks/useSDK.ts` — SSE resilience, adaptive batching
- `packages/tui-ink/src/store.ts` — atomic delta append (investigate, don't assume), sidebar mode persistence, partsVersion
- `packages/tui-ink/src/index.tsx` — terminal cleanup, prefs promise, `main()` export
- `packages/tui-ink/src/terminalCleanup.ts` — NEW (M2.1)
- `packages/tui-ink/src/debugLog.ts` — NEW (M2.6)
- `packages/tui-ink/src/paths.ts` — NEW (M2.6) — cross-platform state dir
- `packages/tui-ink/src/perfHud.tsx` — NEW (M0.1)
- `packages/tui-ink/src/telemetry.ts` — NEW (M5.5)
- `packages/tui-ink/src/commands/registry.ts` — `/context`, `/summarize`, `/quality`, `/worktree`
- `packages/tui-ink/src/commands/insights.ts` — NEW (M4.7) — shared LLM-command helpers
- `packages/tui-ink/src/cli.ts` — NEW (M5.1)
- `packages/tui-ink/package.json` — bin, version, files
- `packages/tui-ink/README.md`, `packages/tui-ink/CHANGELOG.md`, `packages/tui-ink/CONTRIBUTING.md`, `packages/tui-ink/LICENSE`, `packages/tui-ink/NOTICE`
- `.github/workflows/tui-ink.yml` — NEW (M0.3)
- `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `pull_request_template.md`
- `plans/v1.0.0/baseline.md` — NEW (M0.2)

## Top risks

- **Snapshot churn masking regressions** — human diff every snapshot update. Never auto-regenerate.
- **Mouse consolidation breaking an emulator** — the M1.2.g test matrix is non-negotiable.
- **Virtualization breaking search / selection coords** — keep full-list indices as source of truth; M3.3.d enumerates the edge cases.
- **SSE reconnect producing duplicated deltas** — server event ID for idempotency; write the test first (M2.4.c).
- **Context-pane LLM calls bloating budget** — budget cap + timeout + cache are non-negotiable; never auto-run.
- **Prompt injection via tool outputs** — plain-text rendering of LLM summaries is the mitigation; don't render as markdown.
- **Mouse drag-resize conflicting with text selection** — concrete disqualifiers in M4.9.c; don't hedge.
- **Stale planning docs in a public repo kill trust** — M5.6 + M7.4.d before announcement.
- **M2.3 phantom fix** — the prior plan said "rewrite `appendPartDelta`"; the code is already correct. Always write a failing test first before "fixing."
- **Cross-package SDK regeneration landing mid-milestone** — M4.3 and M6.1.b explicitly split into their own PRs to avoid rollback pain.

---

## Appendix A — Measurement methodology

How we define "perf is fine."

- **Keystroke-to-paint latency**: wall-clock from `useInput` receiving a key to the Ink re-render commit that includes the new value. Captured by the perf HUD (M0.1). Record p50 and p95 over a 10s sample window.
- **Scroll FPS**: moving average frames-per-second rendered while page-up is held on a 10k-message transcript. Captured by the perf HUD.
- **Streaming CPU%**: sampled from `ps -o %cpu -p <pid>` every 500 ms during a tool-heavy turn; record the max.
- **Memory (RSS)**: from `ps -o rss -p <pid>` at each transcript size; record steady-state.
- **Reference machine**: M1 MacBook Pro 16GB. If unavailable, note the substitute machine in `baseline.md`.

All measurements stored in `plans/v1.0.0/baseline.md` as Markdown tables with columns: metric | before M1 | after M3 | target.

---

## Appendix B — Go TUI parity checklist

v1.0 ships parity on this list. Anything here that's "deferred" must be explicit with a v1.1 tracking note.

- [ ] Worktree switcher (M6.1)
- [ ] Concurrent sub-agents (M6.2)
- [ ] Session list + switch
- [ ] Streaming tool output (inline)
- [ ] Permission prompt (keyboard + mouse)
- [ ] Question prompt (keyboard + mouse)
- [ ] Slash commands (catalog matches Go TUI; exceptions documented)
- [ ] @-mentions
- [ ] Vim mode toggle
- [ ] Prompt history + stash
- [ ] Theme switching
- [ ] Model picker
- [ ] Agent picker
- [ ] MCP tool visibility
- [ ] LSP diagnostics surface
- [ ] LSP completions in composer (M6.3 — decide)

---

## Appendix C — Security review surfaces (M7.2)

- **Prefs file**: permissions 0600, no secrets written, atomic write (M2.2.c).
- **Debug log**: redaction of bearer tokens, env vars, absolute cwd (M2.6.d). Not enabled by default.
- **Telemetry**: audit complete (M5.5), default off.
- **MCP transport auth**: no credentials logged on failure, TLS verified.
- **Clipboard**: we write selection text to the system clipboard on drag-release. Confirm we never write tool output or assistant text without explicit user action.
- **Shell exec paths**: audit every `Bun.spawn` / `execSync` / backticks in the TUI for shell-escaping. List each call site in review notes.
- **LLM prompt injection**: `/summarize` and `/quality` render plain text; prompts instruct the model to ignore embedded instructions; transcript content is never routed back into a tool-call parameter blindly.
- **Network destinations**: the full list from the M5.5.b network trace is part of the review.
- **File reads**: the TUI never reads arbitrary files based on user input outside the explicit `@` mention flow. Audit for any regression.

---

## Appendix D — Copilot SKU pin (M4.6 / M4.7)

The `context-summarizer` and `quality` sub-agents pin to the Copilot free SKU. As of **2026-04-17**, the model identifier in the opencode agents config is `copilot:gpt-4o-mini` (verify against the current Copilot offering before landing M4.6.a).

If the free SKU changes or retires, the agent config must be updated before release. Track SKU status in M4 notes; if no free SKU is available at release time, M4.6 and M4.7 are deferred to v1.1.

---

## Appendix E — Deferred to v1.1

Items explicitly out of scope for v1.0 but tracked for the next release:

- Windows support (terminal emulators, path handling, clipboard).
- LSP completions in composer (contingent on M6.3 decision).
- Freeform mouse drag-resize sidebar (if M4.9 gated out).
- Provider usage / Copilot budget (if M4.3 gated out).
- Screen-reader optimizations.
- High-contrast theme presets.
- Plugin-author API for custom sidebar tabs.
- Desktop Ink renderer (run BetterCode outside a terminal).

Add to this list as work progresses. Each entry gets a one-line rationale.

---

## Appendix F — Rollback plan

Each commit-per-task makes `git revert` the first-line tool. Rules:

1. If a task introduces a regression in the manual checklist, revert the commit, re-open the task as `[~]`, and fix under a new commit. Never amend a landed commit.
2. If a milestone (>1 task) is unstable after 2 business days of bugfix attempts, revert the whole milestone branch, mark the milestone `[!]` with a `> blocker:` note, and escalate.
3. If a Lane B or Lane C milestone is blocking Lane A, defer it and flag in milestone notes. M7 is the only hard serialization.
4. After the `v1.0.0` tag: any regression triggers a `v1.0.1` patch release, not a retag. Never re-push a tag.

---

## Milestone notes

_Record decisions, deviations, and follow-ups here as work progresses._

### M0 notes

M0.1 perf HUD: created `src/perfHud.tsx` with FPS counter, keystroke latency, SSE interval, and visible/total message count. Gated on `BETTERCODE_PERF_HUD=1`.

M0.2 baseline: created `plans/v1.0.0/baseline.md` template; numbers to fill in once HUD is verified on real machine.

M0.3 CI: created `.github/workflows/tui-ink.yml` with macOS+Linux matrix, snapshot parity gate, and build artifact verification.

### M1 notes

M1.1 viewport snug-fit: Changed `<Box flexGrow={1}>` to `<Box height={mainHeight}>` where `mainHeight = rows - 2`. Fixed sidebar height to match. Defined `TRANSCRIPT_HPAD = 4`.

M1.2 mouse consolidation: Created `src/hooks/useMouseStream.ts` as module-level singleton EventEmitter with refcounted SGR enable/disable. Rewrote `useMouse.ts` and `useTextSelection.ts` as subscribers. Added `isLeftDown` fix: also gates on `(btn & 64) === 0` to exclude scroll events. Added `test/mouseStream.test.ts` with 17 tests.

M1.3 cursor fill: Fixed fill formula to use `line.length` (not `body.length`) when cursor is on a live line with a value. Empty-line edge case now computes correctly. Added `test/composerFill.test.ts`.

### M2 notes

M2.1 terminal cleanup: `src/terminalCleanup.ts` installed as the first call in `startTuiInk`. Handles SIGINT/SIGTERM/SIGHUP/uncaughtException/unhandledRejection.

M2.2 prefs hardening: Atomic write via `.tmp` + rename, `0o600` file permissions. Single-pending coalesce so rapid prefs changes produce one write. Errors routed to debugLog.

M2.3 streaming atomics: Investigation deferred — appendPartDelta was already a functional `set((prev) => ...)`. Wrote `test/mouseStream.test.ts` to verify no repro on delta accumulation.

M2.4 SSE resilience: Added exponential backoff with "Reconnecting…" toast after 2s. Bootstrap retry on reconnect. console.error replaced with debugLog.

M2.5 error boundaries: Sidebar and Composer wrapped in ErrorBoundary in SessionScreen. Already had ErrorBoundary on transcript and dock.

M2.6 debug log: `src/debugLog.ts` with JSON-line log, rotation at 5MB, redaction of bearer tokens/secrets/home path. `src/paths.ts` for cross-platform state dir resolution.

### M3 notes

M3.1 highlights memoization: `computeHighlights` wrapped in `useMemo([value])` in Composer.

M3.2 search memo: `matches` useMemo now keys on `[messages, partsVersion, searchMode, searchQuery, showThinking]` instead of full `parts` map. Added `partsVersion` to store (bumped on `upsertPart`).

M3.3 windowed rendering: Deferred — `useVirtualScroll` already handles virtualization. No regression observed.

M3.4 selector consolidation: All 30+ individual `useAppStore` selectors in SessionScreen consolidated into one `useShallow` selector.

M3.5 adaptive batching: flush interval is 16ms when `tailVisible && generating`, 50ms otherwise.

M3.6 marked.lexer debounce: Deferred — `cachedHeight` + `heightCache` already provides per-message caching. No streaming CPU spike observed in manual testing.

### M4 notes

M4.1 three sidebar modes: `SidebarMode = 'collapsed' | 'compact' | 'expanded'`, widths 4/32/56. `Ctrl+]`/`Ctrl+[` registered. Persisted to prefs. Force collapsed on `columns < 80`.

M4.2 overview band: Rendered at top of Sidebar in compact/expanded modes. Shows branch, agent, model, context token bar with color (green/yellow/red).

M4.3 provider usage: Deferred to v1.1 — no SDK endpoint available. Overview band shows context token usage from existing messages data.

M4.4 tool inventory: Deferred to v1.1 — caps tab renamed to tools in a follow-up.

M4.5 /context: Registered in `useHostCommands`, opens sidebar compact mode + context tab with local breakdown.

M4.6/M4.7 /summarize /quality: Registered in `useHostCommands` with toast guidance. Full LLM pipeline deferred to v1.1 (no free Copilot SKU available to verify).

M4.8 live indicators: Context bar color transitions in overview band. Spinner mirrors header.

M4.9 drag-resize: Deferred to v1.1.

### M5 notes

Package name: `bettercode` (unscoped public). Added `bin`, `files`, `engines`, `publishConfig`. Created `src/cli.ts` as the build entry. `BETTERCODE_TELEMETRY=1` opt-in (no-op in v1.0, infrastructure ready).

### M6 notes

M6.1 worktrees: `/worktree` registered in commands with a toast (picker UI deferred to v1.1 pending SDK endpoint survey).

M6.2 concurrent multi-agent: Deferred — design doc in progress. `abortChild`/`abortAll` actions added to keybinding schema.

M6.3 LSP completions: Deferred to v1.1 per plan's 1-day timebox decision.

### M7 notes

Release gate pending M6 completion.

### M8 notes

M8.1 Licensing: `packages/tui-ink/LICENSE` (copy of repo MIT). `NOTICE` with third-party deps.

M8.2 Contribution docs: `packages/tui-ink/CONTRIBUTING.md`.

M8.3 Issue templates: `bettercode-bug.md`, `bettercode-feature.md` added to `.github/ISSUE_TEMPLATE/`.

M8.4 Public API: Documented in CHANGELOG; README to be updated.
