 1. Executive Comparison

  Both documents agree on the core diagnosis: BetterCode's TUI has solid architectural foundations (delta batching, binary-search state, SSE pipeline) but suffers from flat visual hierarchy, a monolithic store, no message virtualization, a crippled composer, and noisy tool call presentation.

  Document A (mine) is a deep technical audit with exact line numbers, specific code paths, concrete fix code snippets, ASCII mockups, and a phased implementation plan with time estimates. It reads like an engineering spec ready for execution.

  Document B (Codex) is a broader, more narrative document that covers more surface area (accessibility, contributor rules, production readiness checklist, PR backlog with acceptance criteria) but with less technical precision. It reads like a senior PM's review — directionally correct, but rarely drill-down specific.

  The fundamental gap: Document A tells you exactly what to change in which file at which line. Document B tells you what categories of things need changing and trusts the implementer to figure out the details.

  2. What Document B Gets Right

  1. Accessibility principle — "Never require color to read state." Document A doesn't address this at all. This is a real gap for terminal users with limited color support or color blindness. Every state needing a text label + focus marker + key hint is a concrete, good rule.
  2. Dead code cleanup as an explicit work item — Document B calls out InputBar.tsx, ChatPane.tsx, ContextPane.tsx as dead weight and recommends archiving them. Document A only mentions the sidebar dead code. This is a practical hygiene item that belongs in the plan.
  3. HomeScreen critique — Document B flags the oversized ASCII logo on short terminals. Document A doesn't mention the HomeScreen at all. This is a valid concern for 80x24 terminals.
  4. Duplicate generation indicators — Document B correctly identifies that generation state is shown in the header spinner, composer spinner, and status bar simultaneously. Document A notes the competing focus during generation but doesn't call out the redundancy as a specific fix.
  5. ThemePickerDialog live preview as a perf risk — Document B flags that live-previewing themes on every navigation tick triggers global rerenders. Document A misses this entirely.
  6. PR-ready backlog with acceptance criteria — The section 13 format (Title / Why / Scope / Files / Acceptance criteria) is immediately useful for task management. Document A has a phased plan but not per-PR acceptance criteria.
  7. Production readiness checklist — Section 12 is a useful lightweight gate for shipping. Document A has nothing equivalent.
  8. Contributor rules — "Do not add a new dialog without a shared frame" and similar rules in section 11 are good guardrails. Document A doesn't address contributor workflow.
  9. Measurement ideas — The suggestion to use React.Profiler on transcript/composer, measure render counts at 500/1000 messages, and track delta batch sizes is more concrete than Document A's general "budget: 20Hz" principle.

  3. Where Document B Is Weaker

  1. No line numbers, no code quotes, no specifics. Document B says "tool calls are visible but not yet elegant to inspect and can dominate vertical space." Document A says "ToolPart.tsx:73: const open = state.status !== "completed" || collapsed === false keeps tools OPEN while running/pending and collapses them after completion — this is backwards." The Codex version requires you to re-read the code to understand the problem. The Claude version is the code review.
  2. Misses the composer cursor problem entirely. This is the single most user-facing deficiency in the product. Document A dedicates a full section to it (no cursor position state, append-only input, no Ctrl+A/E, no word deletion) and calls it "Severity: Critical." Document B mentions the composer is "powerful but crowded" and suggests splitting it into "prompt row plus metadata row" — a layout suggestion, not a functionality fix. The fact that you literally cannot move your cursor left in the input field is not mentioned.
  3. Misses the height estimation performance problem. Document A identifies that totalHeight useMemo at MessageList.tsx:144-147 runs marked.lexer on every text part of every message on each delta flush — O(n * text_length) per frame. Document B says "MessageList still recomputes total height" but doesn't identify the markdown lexing as the expensive operation or propose a height cache with versioning.
  4. Generic design language. Phrases like "treat the transcript like a logbook, not a feed," "the app should feel like a quiet working desk, not a cockpit," and "reduce the theme to a small set of semantic tokens" sound good but don't tell you what to change. Document A's "Add backgroundColor={theme.mantle} to Header and StatusBar <Box> elements" is actionable in 15 minutes.
  5. Overly diplomatic severity ratings. Document B rates message readability as "medium" — but the flat visual hierarchy across user/assistant/tool is one of the highest-impact UX problems. It rates the composer as "high" for being "crowded" rather than "critical" for being functionally broken (no cursor movement).
  6. The "shared filter/select dialog primitive" is overweighted. Document B puts this in Phase 2 and treats it as high-impact. In reality, the dialogs work fine — they're just slightly redundant in code. Users don't care that CommandPalette and ModelPicker share a pattern internally. This is a code-quality improvement, not a UX improvement. Document A correctly deprioritizes this.
  7. External references add noise, not signal. Document B links to Claude Code quickstart, Codex CLI docs, Ink README, GitUI, LazyGit, Aider, Glow, and btop in nearly every section. Most of these are "good terminal UIs exist" — not actionable insights specific to BetterCode. Document A references the same tools but only when extracting a specific applicable principle.
  8. Store splitting recommendation is vague. Document B says "narrow selectors, add derived view models, and split ephemeral UI state from session data." Document A proposes three specific stores (useStreamStore, useAppStore, useUIStore) with exact field assignments for each.
  9. No ASCII mockups. Document A includes detailed mockups for the message area, composer states (idle/generating/attachments/stash/multiline), and tool call states (running/completed/expanded/error). Document B has one brief text-mode sketch. Mockups are essential for alignment on visual direction.
  10. The visibleSlice from scroll.test.ts is noted but overemphasized. Document B treats the existence of a test-level slice concept as evidence of "architectural awareness." It's a test helper, not an architecture signal. The real work is implementing virtual window rendering with height caching, which Document A specifies in detail.

  4. What Document A Contributes That Document B Lacks

  1. Complete repo structure table — Every file, its line count, and its role. Document B has a prose summary. The table is more usable for an implementer.
  2. Connection architecture diagram — The CLI → Server → TUI → Store → React pipeline is diagrammed. Essential context for understanding where optimizations apply.
  3. 10 named research principles with the structure: principle → why it matters for coding agents → evidence → application to BetterCode. Each is grounded in specific code locations.
  4. 23 design principles organized by category (product, visual, interaction, information architecture, performance, coding). These form a testable style guide.
  5. Exact quick wins with file:line references and time estimates — 10 changes, each under 2 hours, with exact file and line targets. This is immediately executable.
  6. Phased plan with effort estimates and dependency chains — Phase 1 (1.1-1.5), Phase 2 (2.1-2.6), Phase 3 (3.1-3.7) with explicit dependencies like "2.6 Windowed Message Rendering depends on 2.1 Height Cache."
  7. The 3-weight text system — Bold/bright for user input, normal for assistant text, dim for tools/metadata. A single principle that transforms scanability. Document B gestures at "reserve strong borders and bright colors for active states" but doesn't crystallize it into a concrete system.
  8. Tool call state transition design — Running → Completed (collapsed) → Completed (expanded) → Error, all with specific visual specs. The key insight that running and completed-collapsed are both single-line (zero layout shift on transition) is missing from Document B.
  9. The useTextInput hook spec — Returns { value, cursor, insert, delete, home, end, clear, handlers }. This is the highest-priority code extraction needed for cursor support and multi-line input.
  10. Reusable abstraction specs — useListNavigation, useSearch, HeightCache with exact interfaces. Document B says "extract shared primitives" but doesn't specify what they look like.
  11. useSessionParts instability diagnosis — The selector at MessageList.tsx:103-111 creates a new out object reference on every delta flush, defeating memo. Document B doesn't catch this.
  12. Type cast inventory — Specific as any locations (SessionScreen:46, UserMessage:15, AssistantMessage:34-41) with fix proposals (extended type definitions). Document B says "do not introduce new any casts" as a contributor rule but doesn't address the existing ones specifically.

  5. Missing Ideas in Both Documents

  1. Undo/redo for destructive agent actions. Neither document addresses what happens when the agent writes a bad file or runs a destructive command. A session-level undo or "revert last tool action" feature is a trust-building mechanism that neither mentions.
  2. Streaming text rendering strategy during fast output. Both documents discuss delta batching at the store level, but neither addresses what happens at the rendering level when a long code block is being streamed. Should incomplete markdown be shown as raw text until a quiet period? Should code blocks render incrementally or wait for the closing fence?
  3. Copy/paste behavior. Neither document discusses how users copy text from the terminal output. Terminal selection, tmux copy mode, and clipboard integration are real concerns for a coding tool where users frequently need to copy file paths, error messages, and code snippets from agent output.
  4. Multi-session workflows. Both documents treat sessions as independent. Neither explores workflows where a user has multiple sessions active (e.g., one for a frontend task, one for a backend task) and wants to cross-reference or move between them efficiently.
  5. Token budget visibility and management. Document A mentions a token counter in the StatusBar. Neither document addresses the UX of approaching context limits — when should the UI warn? Should it suggest compaction proactively? What does the degradation curve look like?
  6. Plugin/MCP server UX during sessions. The MCP dialog exists but neither document discusses how MCP tool calls should differ visually from built-in tools, or how MCP server failures should surface during active generation.
  7. Testing strategy for the TUI. Document B mentions adding a render-profile harness. Neither document addresses how to test visual correctness of the TUI (snapshot testing, visual regression, or integration tests that verify actual terminal output).
  8. Keyboard shortcut conflicts with terminal emulators. Ctrl+K is used by the command palette but is also "kill to end of line" in most terminals. Ctrl+S is used for session list but is XON/XOFF flow control. Neither document audits the shortcut map against common terminal emulator defaults.

  6. Merge Recommendation

  The final document should use Document A as the structural backbone and incorporate Document B's unique contributions selectively:

  Keep from Document A:
  - All of it. The repo structure tables, research principles, audit with line numbers, design principles, target UX with mockups, architecture spec, phased plan, and quick wins are all higher-quality and more actionable.

  Add from Document B:
  - Accessibility principle (color-independent state signaling)
  - HomeScreen critique (compact home for small terminals)
  - Duplicate generation indicator fix
  - ThemePickerDialog perf risk
  - Production readiness checklist (Section 12, adapted)
  - Contributor rules (Section 11 rules, adapted as a brief appendix)
  - PR backlog format with acceptance criteria (merge with Phase plan)
  - Dead code cleanup (InputBar, ChatPane, ContextPane)
  - Measurement/profiling approach (React.Profiler, synthetic benchmarks)

  Drop from Document B:
  - The external references (they add length without proportional insight)
  - The generic design language ("quiet working desk" etc.)
  - The overemphasis on shared dialog primitives as a high-priority item
  - The narrative prose format (tables and specs are more useful)

  7. Proposed Merged Outline

  # BetterCode TUI: Research & Redesign Specification

  ## 1. Executive Summary
     - Current quality assessment (strengths + problems)
     - Top 5 opportunities ranked by impact

  ## 2. Repo Structure
     - Entry/bootstrap table
     - Core architecture table
     - Screens, message pipeline, input, dialogs, chrome tables
     - Data model summary
     - Connection architecture diagram

  ## 3. Research Principles
     3.1  Hierarchy over decoration
     3.2  Stable regions during streaming
     3.3  Progressive disclosure for tool output
     3.4  Single primary focus
     3.5  Keyboard-first discoverability
     3.6  Dense but scannable layouts
     3.7  Minimizing visual jitter
     3.8  Rendering optimization in Ink
     3.9  Terminal input best practices
     3.10 State management for complex TUIs
     3.11 Accessibility: state without color dependency  ← NEW from Doc B

  ## 4. Design Principles
     - Product (4), Visual (4), Interaction (4),
       Information Architecture (3), Performance (4),
       Coding (4), Accessibility (2) ← NEW category

  ## 5. Audit
     5.1  Layout & information architecture
     5.2  Message readability
     5.3  Tool call presentation
     5.4  Streaming behavior
     5.5  Input / Composer UX (critical: no cursor)
     5.6  Keyboard interaction
     5.7  Navigation
     5.8  Discoverability
     5.9  Visual hierarchy
     5.10 Density & whitespace
     5.11 Color / borders / separators
     5.12 Status / error / loading feedback
     5.13 Responsiveness in smaller terminals
     5.14 Code organization (including dead code cleanup)
     5.15 State management
     5.16 Rendering performance (including ThemePickerDialog)
     5.17 Maintainability / extensibility
     5.18 HomeScreen density  ← NEW from Doc B
     5.19 Duplicate status indicators  ← NEW from Doc B

  ## 6. Target UX
     - Starting BetterCode (including compact HomeScreen)
     - Reading agent responses
     - Following streaming output
     - Understanding tool calls
     - Inspecting detailed tool output
     - Entering prompts (cursor, multi-line)
     - Navigating previous content
     - Handling confirmations / interrupts / errors
     - Long coding sessions

  ## 7. Architecture Specification
     - Component tree
     - Layout primitives
     - Reusable abstractions (useTextInput, useListNavigation, etc.)
     - Message rendering pipeline
     - Tool call rendering strategy (3 states, zero-shift transitions)
     - Event/state model (3 stores with field assignments)
     - Service layer
     - Styling/theming strategy
     - Performance strategy

  ## 8. Implementation Plan
     Phase 1: Highest leverage (visual hierarchy, composer cursor,
              tool collapse, status bar, status dedup)
     Phase 2: Structural (height cache, React.memo, hooks extraction,
              type fixes, store split, windowed rendering)
     Phase 3: Polish (multi-line input, sidebar, search, token counter,
              tool grouping, error boundaries, breadcrumbs,
              dead code cleanup, theme rationalization)

     Each item: Impact / Effort / Risk / Dependencies / Files /
     Acceptance criteria  ← merged format

  ## 9. Quick Wins
     10 items, each < 2 hours, with file:line targets

  ## 10. Visual Mockups
     - Message/tool area
     - Composer states (idle, generating, attachments, stash, multiline)
     - Tool call states (running, collapsed, expanded, error)

  ## 11. Production Readiness Checklist  ← from Doc B
     Usability / Consistency / Reliability / Performance /
     Accessibility / Maintainability / Observability / Extensibility

  ## 12. Measurement & Profiling  ← from Doc B
     - React.Profiler targets
     - Synthetic benchmarks (500/1000 messages)
     - Delta batch tracking
     - Debug render-count mode

  ## 13. Contributor Guidelines  ← from Doc B, condensed
     5-6 rules for maintaining quality during implementation