# 1. Executive summary

BetterCode already has the right strategic shape: a dedicated `bettercode` entrypoint launches the existing OpenCode backend and then hands off to a separate Ink-based terminal UI. That is the correct product architecture for this stage. The problem is not that BetterCode lacks capability. The problem is that the current TUI still feels like a capable internal prototype rather than a production-class daily driver for long coding sessions.

The strongest parts today are the separation of concerns between backend and TUI, the normalized Zustand store, the batched SDK update flow, and a shell that already decomposes into transcript, dock, status, dialogs, and optional side surfaces. Those are solid foundations. BetterCode does not need a reinvention. It needs a disciplined refinement of hierarchy, ergonomics, and rendering strategy.

The biggest UX problems are concentrated in three places. First, the transcript is too flat and too eager to show execution detail, which makes long sessions feel noisy. Second, the composer is not yet premium: cursor movement, multiline editing, paste ergonomics, and overall command-entry polish lag behind what users expect from a serious coding tool. Third, visual hierarchy is functional but not calm; the screen communicates "all state is equally important," which increases cognitive load.

The biggest implementation risks are also clear. `MessageList.tsx` still pays too much work on the render path for long sessions, including full-list height calculation and broad invalidation. `store.ts` is disciplined but too monolithic for hot UI paths. `Composer.tsx` mixes too many concerns into one critical interaction surface. These are not abstract code quality complaints; they directly affect perceived speed and polish.

The top opportunity is to make BetterCode feel like a quiet, trustworthy workbench: transcript first, tool detail on demand, one primary focus at a time, stable regions during streaming, and a composer that feels as good as using a real editor. If BetterCode fixes transcript hierarchy, tool disclosure, composer ergonomics, and render-path stability before chasing decorative polish, it can become a genuinely best-in-class terminal coding agent while continuing to rely on the OpenCode backend.

# 2. Repo-grounded current-state assessment

## Architecture summary

BetterCode is correctly structured as a dedicated frontend experience layered on top of the OpenCode backend.

Evidence from repo:
- `packages/opencode/bin/bettercode` is a dedicated CLI entrypoint.
- `packages/opencode/src/cli/cmd/bettercode.ts` starts the OpenCode server and then spawns the TUI process.
- `packages/tui-ink/src/index.tsx` initializes the Ink app, preferences, theme, and history.
- `packages/tui-ink/src/app.tsx` owns routing, resize behavior, overlays, global shortcuts, and high-level shell behavior.

Why it matters:
- This separation is the right long-term move. It lets BetterCode evolve into a distinct product without rewriting backend session/tool infrastructure.

How it applies to BetterCode:
- The redesign should preserve this boundary. The work is a frontend architecture and UX refinement project, not a backend replacement project.

## Main shell and composition

The main experience is composed in the right place, but the shell is currently more functional than composed.

Evidence from repo:
- `packages/tui-ink/src/screens/SessionScreen.tsx` is the primary composition surface. It brings together header, message list, bottom dock, status line, toast overlay, and sidebar.
- The sidebar exists, but current usage keeps it effectively inactive in the primary workflow.
- Header and status surfaces communicate useful state, but the current weighting is not disciplined enough.

Why it matters:
- In terminal UIs, shell composition determines perceived calm. Users do not experience components independently; they experience region stability, scan order, and how often attention is pulled away from the transcript.

How it applies to BetterCode:
- BetterCode needs a stricter shell: transcript as the center of gravity, dock as the primary interaction zone, status as low-noise metadata, overlays for exceptional states, and secondary panels only when deliberately invoked.

## Transcript and message rendering

The transcript is the product. It is also the current performance hotspot.

Evidence from repo:
- `packages/tui-ink/src/components/MessageList.tsx` is responsible for long-session readability, scroll behavior, and message rendering.
- It still computes total transcript height from all messages and renders the full list rather than using a true windowed strategy.
- The render path depends on session parts and height estimation work that can invalidate too broadly during streaming.
- Markdown and part rendering are already reasonably modular, but the list-level strategy is still too expensive for very long sessions.

Why it matters:
- Terminal performance problems are rarely just raw FPS problems. They show up as jitter, scroll instability, delayed input response, and "why did the whole screen redraw?" moments. That breaks trust quickly during long coding sessions.

How it applies to BetterCode:
- The highest-leverage performance work is not micro-optimizing individual leaf components. It is reducing transcript-wide invalidation, caching stable heights, and moving to a windowed or near-windowed render strategy.

## Tool call presentation

BetterCode already has the right primitive, but the current behavior is not yet tuned for signal.

Evidence from repo:
- `packages/tui-ink/src/components/parts/ToolPart.tsx` renders tool calls with a one-line summary plus collapsible detail.
- That is the right base pattern.
- Current defaults still overexpose some running detail and under-stage completed detail.
- There is not yet a consistently premium distinction between "important tool progress," "routine tool completion," and "diagnostic detail."

Why it matters:
- Coding-agent workflows generate lots of tool activity. If the transcript gives equal weight to every tool payload, the interface becomes log-shaped instead of decision-shaped.

How it applies to BetterCode:
- BetterCode should keep tool calls in the transcript, but compress them into a disciplined ladder: live summary while running, compact summary when successful, expanded by default for failures, and full raw output only on deliberate inspection.

## Composer and interaction model

The composer is the most user-visible rough edge.

Evidence from repo:
- `packages/tui-ink/src/components/Composer.tsx` is responsible for prompt entry, slash actions, mentions, attachments, stash behavior, and various inline controls.
- Editing behavior is still closer to append-only terminal input than to a premium text-entry experience.
- Cursor movement, multiline editing, paste handling, and mode clarity are not yet at the standard expected for a daily-use coding tool.
- `packages/tui-ink/src/components/BottomDock.tsx` anchors the lower workflow, but the dock still feels more assembled than designed.

Why it matters:
- The composer is where the user feels product quality most directly. A transcript can be imperfect and still usable. A weak prompt-entry surface makes the whole tool feel unfinished.

How it applies to BetterCode:
- Composer ergonomics should be treated as phase-one product work, not polish. BetterCode needs editor-grade basics before it needs more decorative UI.

## State model and maintainability

The store is competent, but it is carrying too much heat.

Evidence from repo:
- `packages/tui-ink/src/store.ts` centralizes session state, message state, UI flags, collapsed parts, navigation state, and interaction actions.
- The store is normalized and functionally useful.
- It also mixes hot transcript state with colder UI configuration and ephemeral interaction state.
- Several selectors and update paths are broader than ideal for a streaming TUI.
- There are adjacent unused or legacy surfaces such as `packages/tui-ink/src/components/InputBar.tsx`, `packages/tui-ink/src/components/ChatPane.tsx`, and `packages/tui-ink/src/components/ContextPane.tsx`, which suggests architectural drift.

Why it matters:
- Zustand is a good fit for Ink, but only when selector discipline is strict. Once hot paths and control surfaces share too much store surface area, every feature starts to feel more fragile and expensive.

How it applies to BetterCode:
- BetterCode should not rush into a large store rewrite. It should first isolate hot selectors, introduce derived view models, reduce broad invalidation, and remove dead paths. If needed after that, the store can be split along real pressure lines.

# 3. Best-in-class principles for BetterCode

## 1. Transcript first, chrome second

Why it matters:
- In a coding-agent TUI, the transcript is the product surface. Everything else exists to support reading, deciding, and responding.

Evidence:
- Claude Code, Codex CLI, and Aider all prioritize conversational flow over decorative panels.
- High-quality TUIs like LazyGit and GitUI keep the primary working region visually dominant and demote controls until needed.

How it applies to BetterCode:
- The central message area should hold attention by default.
- Header, status, and secondary panels should support orientation, not compete with the transcript.

## 2. Show intent by default, show detail on demand

Why it matters:
- Tool use is important, but raw payloads are rarely the thing the user needs first. Users need to know what happened, whether it succeeded, and whether action is required.

Evidence:
- Modern coding-agent interfaces use progressive disclosure for tool calls, logs, and execution detail.
- Glow demonstrates how terminal interfaces can make content readable first and structural detail secondary.

How it applies to BetterCode:
- Tool rows should default to human summaries.
- Failures, permission prompts, and confirmation-required states should expand automatically.
- Large outputs should route to explicit inspection flows rather than flooding the transcript.

## 3. Stable regions beat flashy streaming

Why it matters:
- Terminal UIs feel fast when they are calm. They feel slow when everything repaints or shifts during streaming.

Evidence:
- Ink guidance emphasizes minimizing unnecessary rerenders.
- btop and htop succeed because each region updates predictably without making the whole screen feel unstable.

How it applies to BetterCode:
- Keep the shell stable.
- Stream text inside fixed regions.
- Avoid changing layout height aggressively while content is arriving.
- Prefer appending within known boundaries over reflowing the full screen.

## 4. One primary focus at a time

Why it matters:
- Coding sessions already involve high cognitive load. A terminal UI should reduce mode confusion, not add to it.

Evidence:
- Lazygit’s keyboard model is powerful because each view has a clear focus model.
- Good agent UIs keep users oriented around one current job: reading, inspecting, editing, confirming, or navigating.

How it applies to BetterCode:
- At any moment, it should be obvious whether the user is focused on transcript reading, composer entry, tool detail inspection, confirmation handling, or a modal surface.

## 5. Dense but scannable beats airy but verbose

Why it matters:
- Terminals have limited space. Productive TUIs use density carefully, not timidly.

Evidence:
- LazyGit, GitUI, and Aider all work because they use compact layouts with strong grouping and separators.
- Overly roomy terminal designs waste columns and reduce usable history.

How it applies to BetterCode:
- Use a disciplined spacing system.
- Reserve whitespace for grouping and relief, not decoration.
- Emphasize alignment, indentation, and repetition of structure to help the eye scan quickly.

## 6. Never require color to understand state

Why it matters:
- Terminal themes vary wildly, and many users work over SSH, tmux, or reduced-color environments. Color-only signaling is fragile and inaccessible.

Evidence:
- Accessibility guidance for CLI/TUI tools consistently recommends pairing color with shape, labels, or text state.
- Strong TUIs use icons, prefixes, and wording as state carriers.

How it applies to BetterCode:
- Success, warning, error, and running states should each have textual and structural cues, not just color.
- Borders, labels, glyphs, prefixes, and copy should do real semantic work.

## 7. The composer should feel editor-grade

Why it matters:
- The user types into BetterCode constantly. If the editor experience feels compromised, the whole product feels compromised.

Evidence:
- Claude Code and Codex-style tools are judged heavily on prompt-entry speed and predictability.
- Terminal users expect robust navigation, paste handling, and shortcut discipline.

How it applies to BetterCode:
- Cursor movement, word jumps, multiline input, bracketed paste, visible draft state, and predictable submit behavior should be treated as core product features.

## 8. Optimize the hot path before generalizing abstractions

Why it matters:
- Shared primitives are valuable, but not if they delay the fixes users feel every session.

Evidence:
- Ink apps tend to degrade when abstraction is added before render pressure is understood.
- The current repo already has some unused abstraction drift.

How it applies to BetterCode:
- Fix transcript rendering, tool disclosure, and composer ergonomics first.
- Generalize dialogs, cards, and panel primitives only where duplication or inconsistency is already hurting the product.

# 4. Research-backed UX findings

## Hierarchy matters more than decoration

Why it matters:
- A calm terminal UI is achieved through weight, grouping, and spacing, not ornamental styling.

Evidence:
- LazyGit and GitUI use strong panel hierarchy and restrained styling to make dense information readable.
- btop uses a limited visual vocabulary but clear zones.

How it applies to BetterCode:
- BetterCode should adopt a small, repeatable visual grammar: primary content, secondary metadata, tertiary system hints.
- It should stop styling many surfaces as if they are equally important.

## Progressive disclosure is essential for tool-heavy agents

Why it matters:
- Tool-rich sessions naturally generate noise. Without disclosure discipline, the transcript becomes a stream of machine internals.

Evidence:
- Coding-agent products typically collapse command output, diff detail, and machine payloads behind summaries.
- Glow’s readability patterns and Aider’s compact output reinforce the value of concise default presentation.

How it applies to BetterCode:
- Successful tool calls should collapse to a single readable row.
- Expanded detail should be cheap to enter and cheap to leave.
- Large output should offer inspection mechanisms beyond "render everything inline."

## Keyboard-first discoverability should be visible but quiet

Why it matters:
- Terminal users expect power, but they do not want a key legend screaming at them all the time.

Evidence:
- Lazygit teaches shortcuts through stable footer hints and context-aware legends.
- Great TUIs reveal the right keys for the focused region instead of dumping a full command list.

How it applies to BetterCode:
- Show only the most relevant next actions for the current state.
- Keep a compact shortcut strip in the dock or status line.
- Offer an explicit "all shortcuts" help surface rather than permanent clutter.

## Stable streaming improves perceived performance more than raw speed

Why it matters:
- Users notice jitter, jumping, and instability more than they notice small differences in token latency.

Evidence:
- Ink best practices and well-behaved TUIs alike emphasize stable tree structure and localized updates.
- Products that feel fast usually minimize layout churn during active updates.

How it applies to BetterCode:
- Keep streaming inside fixed transcript rows when possible.
- Avoid recomputing layout for the full history on each delta.
- Prevent header, footer, and side surfaces from pulsing during active generation.

## Long-session ergonomics are a first-order requirement

Why it matters:
- BetterCode is not a demo interface. It is meant for hours-long coding sessions, which changes the design bar.

Evidence:
- Codex-like tools, Aider, and serious terminal workflows all rely on history readability, quick reorientation, and low-friction navigation.
- Tools used for long sessions prioritize scrollback ergonomics and durable mental models over flashy interactions.

How it applies to BetterCode:
- Users should be able to leave and return to a long session without losing orientation.
- The transcript should remain readable after dozens or hundreds of messages.
- Session metadata, model, and current state should be present but quiet.

## Terminal constraints should shape the design, not be treated as a weaker web canvas

Why it matters:
- Terminal-native products succeed when they exploit terminal strengths: textual density, keyboard-first control, and high scan efficiency.

Evidence:
- Glow succeeds because it leans into terminal typography and flow rather than mimicking a browser.
- LazyGit and btop feel premium because they are designed for terminal behavior, not adapted from web components.

How it applies to BetterCode:
- BetterCode should avoid web-style card clutter.
- Borders, separators, and typography should be purposeful.
- Layout should degrade gracefully in narrow terminals and over remote environments like SSH and tmux.

# 5. Audit of current BetterCode UI

## Layout and information architecture

Severity: High

What is happening today:
- The shell contains the right regions, but hierarchy is too flat. Header, transcript, tool details, bottom controls, and system state all compete more than they should.

Why it is a problem:
- A flat hierarchy makes the product feel busy even when functionality is solid. Users spend more effort deciding what to look at.

Likely root cause in code:
- `packages/tui-ink/src/screens/SessionScreen.tsx` assembles many useful surfaces, but they are not yet weighted as a designed system.
- Header and status surfaces are informative but not disciplined enough in prominence.

Recommended fix:
- Adopt a stricter shell model: transcript dominant, dock strong but contained, status minimal, secondary panels opt-in.
- Consolidate duplicated status indicators.

Files/components likely involved:
- `packages/tui-ink/src/screens/SessionScreen.tsx`
- `packages/tui-ink/src/components/Header.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`

## Message readability

Severity: High

What is happening today:
- Messages are generally understandable, but the transcript still lacks a strong, calm rhythm across user prompts, assistant responses, and tool activity.

Why it is a problem:
- Long sessions become visually noisy. The eye has to work too hard to re-establish the conversational thread.

Likely root cause in code:
- Message rendering exists, but the product does not yet enforce a strong visual grammar for message role, summary, body, and execution detail.

Recommended fix:
- Introduce a consistent transcript grammar:
  - user prompt as compact anchor
  - assistant response as primary readable block
  - tool activity as subordinate inline execution row
  - error or confirmation states as explicit interruptions

Files/components likely involved:
- `packages/tui-ink/src/components/MessageList.tsx`
- message row and markdown-rendering components in `packages/tui-ink/src/components`

## Tool call presentation

Severity: High

What is happening today:
- Tool calls are visible in the transcript, which is correct, but their information staging is not yet optimized.
- Running tools can feel too noisy.
- Completed tools can become too hidden or too similar to the rest of the transcript.

Why it is a problem:
- Users need high confidence about what the agent is doing without being forced to read implementation detail constantly.

Likely root cause in code:
- `packages/tui-ink/src/components/parts/ToolPart.tsx` has the right collapsible primitive, but state defaults and summary language are not yet tuned to an execution ladder.

Recommended fix:
- Standardize tool states:
  - running: one-line summary with short live status
  - success: compact collapsed summary
  - warning/error: expanded by default
  - large output: explicit inspect/open flow
- Avoid raw JSON or oversized payloads in default view.

Files/components likely involved:
- `packages/tui-ink/src/components/parts/ToolPart.tsx`
- part renderers and any related tool summary helpers

## Streaming behavior

Severity: High

What is happening today:
- Streaming works, but the transcript likely repaints too broadly and can feel less stable than a premium TUI should.

Why it is a problem:
- Streaming should feel like content arriving in place, not like the screen keeps renegotiating itself.

Likely root cause in code:
- `packages/tui-ink/src/components/MessageList.tsx` computes list-level heights broadly.
- Session parts and message-derived structures invalidate more than necessary.
- The full-list render approach amplifies the cost of each delta.

Recommended fix:
- Cache heights for completed rows.
- Window or near-window the transcript.
- Narrow subscriptions so only changed rows rerender.
- Keep the surrounding shell structurally stable while content streams.

Files/components likely involved:
- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/store.ts`
- session-part hooks and message row components

## Input/composer UX

Severity: Critical

What is happening today:
- The composer supports core task entry, but it does not yet feel like a trustworthy terminal-native editor.
- Cursor movement and multiline editing are not at production level.
- Paste behavior and draft management need more rigor.

Why it is a problem:
- This is the daily control surface. Weakness here affects every session, every prompt, and every moment of user trust.

Likely root cause in code:
- `packages/tui-ink/src/components/Composer.tsx` owns too many responsibilities and currently behaves more like a hand-built input widget than a mature editor surface.

Recommended fix:
- Treat composer ergonomics as core product work:
  - true cursor movement
  - multiline editing
  - predictable submit vs newline behavior
  - bracketed paste handling
  - visible draft state
  - cleaner separation of input engine from slash/menu/attachments UI

Files/components likely involved:
- `packages/tui-ink/src/components/Composer.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`

## Keyboard interaction

Severity: Medium

What is happening today:
- There are shortcuts and controls, but they are not yet fully coherent as a keyboard-first interaction model.

Why it is a problem:
- Terminal users expect consistency and low-friction power. Missing or inconsistent behaviors create hesitation.

Likely root cause in code:
- Shortcut ownership is distributed across shell and component surfaces.
- There is not yet a consistent concept of focus-scoped actions and hints.

Recommended fix:
- Define focused-region keyboard contracts.
- Show only context-relevant hints.
- Add a full shortcuts surface for discovery.
- Audit conflicts and behavior under tmux/remote environments.

Files/components likely involved:
- `packages/tui-ink/src/app.tsx`
- `packages/tui-ink/src/screens/SessionScreen.tsx`
- composer and dialog surfaces

## Navigation

Severity: Medium

What is happening today:
- Core navigation exists, but long-session reorientation is still weaker than it should be.

Why it is a problem:
- Users need to move through large histories without losing place or context.

Likely root cause in code:
- Transcript navigation is present, but not yet framed as a first-class reading experience.
- Sidebar and adjacent context surfaces are not yet integrated into a clear navigation story.

Recommended fix:
- Add stronger anchors:
  - unread/current boundary
  - latest activity jump
  - error jump
  - permission prompt jump
  - collapsed execution summary boundaries

Files/components likely involved:
- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/components/Sidebar.tsx`
- session-level navigation state in `packages/tui-ink/src/store.ts`

## Discoverability

Severity: Medium

What is happening today:
- BetterCode exposes capability, but some of it feels learned by accident rather than taught cleanly.

Why it is a problem:
- Terminal tools can become intimidating when power is present but not staged well.

Likely root cause in code:
- The product currently leans toward inline accumulation of controls rather than progressive teaching.

Recommended fix:
- Use quiet, contextual hints in the dock and status line.
- Replace permanent clutter with progressive discovery and a dedicated help surface.

Files/components likely involved:
- `packages/tui-ink/src/components/BottomDock.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- help or dialog surfaces

## Visual hierarchy

Severity: High

What is happening today:
- The UI reads as competent but mostly functional. It does not yet feel intentionally composed enough to register as premium.

Why it is a problem:
- Premium terminal UX comes from discipline, not ornament. Without that discipline, even good functionality feels rough.

Likely root cause in code:
- Surfaces use styling and separators, but not yet with a small, consistent visual language.

Recommended fix:
- Establish a three-weight visual system:
  - primary content
  - secondary metadata
  - tertiary guidance/system hints
- Tighten spacing, borders, and backgrounds around that system.

Files/components likely involved:
- shell, header, status, dock, message rows, tool rows, dialogs

## Density and whitespace

Severity: Medium

What is happening today:
- Some surfaces are dense in the wrong way and sparse in the wrong way.

Why it is a problem:
- Terminal UIs need to earn every row and column. Misallocated density makes the interface simultaneously busy and inefficient.

Likely root cause in code:
- Components appear optimized locally rather than through one global density system.

Recommended fix:
- Standardize row spacing and section padding.
- Make transcript density higher than chrome density.
- Use whitespace to separate groups, not decorate containers.

Files/components likely involved:
- transcript, dock, header, dialogs, sidebar

## Color, borders, and separators

Severity: Medium

What is happening today:
- BetterCode has theming support, but state is still too dependent on color and box drawing to carry meaning cleanly.

Why it is a problem:
- Terminal themes vary. Overuse of borders and color turns into noise quickly.

Likely root cause in code:
- Theme primitives exist, but semantic usage is not yet strict enough.

Recommended fix:
- Use borders sparingly and consistently.
- Pair every color-coded state with text or icon cues.
- Use background shifts only for structural anchoring, not ornament.

Files/components likely involved:
- theme-related components and the shell surfaces

## Status, error, and loading feedback

Severity: High

What is happening today:
- Status is present in multiple places, but not yet staged into one coherent system.

Why it is a problem:
- Users need instant clarity on whether the agent is thinking, acting, blocked, or waiting on them. Duplicated or inconsistent signals make the product feel less trustworthy.

Likely root cause in code:
- Header, status bar, tool rows, and possibly generation indicators all communicate overlapping state.

Recommended fix:
- Create a single status hierarchy:
  - global session status in one quiet place
  - inline execution status within tool rows
  - interruptive states as dialogs/toasts only when necessary

Files/components likely involved:
- `packages/tui-ink/src/components/Header.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- transcript tool rows
- toast or dialog components

## Responsiveness in smaller terminals

Severity: High

What is happening today:
- The layout works, but smaller terminals are likely to degrade by compression rather than by intentional mode changes.

Why it is a problem:
- Many developers use split panes, laptop terminals, SSH sessions, or tmux. A production terminal app must adapt deliberately to narrow widths.

Likely root cause in code:
- Existing regions scale, but there is not yet a clearly defined small-width behavior model.

Recommended fix:
- Define breakpoints for terminal width bands.
- Hide or collapse secondary surfaces aggressively on narrow widths.
- Preserve transcript and composer above everything else.

Files/components likely involved:
- `packages/tui-ink/src/app.tsx`
- `packages/tui-ink/src/screens/SessionScreen.tsx`
- sidebar and status surfaces

## Code organization

Severity: Medium

What is happening today:
- The codebase has useful components, but some complexity has accumulated in high-pressure files and some legacy surfaces remain around them.

Why it is a problem:
- High-complexity files slow down iteration and make performance work riskier.

Likely root cause in code:
- `packages/tui-ink/src/components/Composer.tsx` is carrying too much.
- Unused or legacy components remain in the tree.
- Some abstractions exist without a clear product need.

Recommended fix:
- Split by responsibility, not by aesthetics.
- Remove dead surfaces.
- Extract logic-heavy hooks only where it reduces hot-path complexity.

Files/components likely involved:
- `packages/tui-ink/src/components/Composer.tsx`
- legacy components in `packages/tui-ink/src/components`

## State management

Severity: High

What is happening today:
- Zustand is working, but the current store shape makes hot paths more expensive than necessary.

Why it is a problem:
- Streaming transcript updates and input interaction are sensitive to unnecessary state propagation.

Likely root cause in code:
- `packages/tui-ink/src/store.ts` combines hot transcript data, UI chrome state, and control state into a broad store.
- Some actions likely scan more state than necessary.

Recommended fix:
- First narrow selectors and create derived view models for transcript rows and shell state.
- Add indexes where lookups currently scan.
- Consider splitting stores only after measuring remaining pressure.

Files/components likely involved:
- `packages/tui-ink/src/store.ts`
- hooks/selectors that subscribe into it

## Rendering performance

Severity: Critical

What is happening today:
- The list rendering strategy is the clearest risk to long-session stability.

Why it is a problem:
- As history grows, every streaming update risks doing too much work.

Likely root cause in code:
- Full-list render and full-list height work in `packages/tui-ink/src/components/MessageList.tsx`
- broad invalidation from session-part structures
- insufficient memo boundaries on stable rows

Recommended fix:
- Window transcript rendering
- Cache stable measurements
- Memoize row components around immutable row view models
- Ensure only the actively streaming row rerenders during most deltas

Files/components likely involved:
- `packages/tui-ink/src/components/MessageList.tsx`
- row renderers
- store selectors

## Maintainability and extensibility

Severity: Medium

What is happening today:
- BetterCode is extensible in principle, but future feature work will get expensive if current drift continues.

Why it is a problem:
- As new panels, dialogs, and execution states appear, inconsistency and repaint risk will increase.

Likely root cause in code:
- Shared primitives are not yet formalized where they would help, and older components remain in place where they do not.

Recommended fix:
- After hot-path fixes, define a small set of primitives for shell regions, dialogs, transcript rows, and status treatments.
- Remove dead code to make the intended architecture obvious.

Files/components likely involved:
- shell, dialog, panel, and transcript surfaces across `packages/tui-ink/src`

# 6. Target UX for BetterCode

## Starting BetterCode

The ideal startup experience feels immediate and oriented. The screen should not behave like a splash screen. It should behave like entering a workbench.

The user should see:
- a calm shell
- the current session or recent-session launcher
- a quiet status line showing model/session/backend readiness
- a focused composer or clear session selection state

Why it matters:
- Startup defines confidence. The first seconds should say "ready to work," not "loading a demo UI."

Evidence:
- Productive TUIs minimize theatrical startup behavior and favor immediate orientation.

How it applies to BetterCode:
- The home/launch experience should be practical and compact, with recent sessions and next actions prioritized over branding weight.

## Reading agent responses

Agent responses should read like a well-edited transcript, not a raw event stream.

The user should experience:
- clear separation between user turns and assistant turns
- assistant text as the dominant readable surface
- tool activity tucked underneath as subordinate execution evidence
- easy resumption after scrolling away and coming back later

Why it matters:
- The transcript is the memory of the session. If it is noisy, the whole product becomes harder to trust.

Evidence:
- The most effective terminal tools prioritize scan order and continuity.

How it applies to BetterCode:
- Message blocks should have consistent anchors, summaries, and detail rules. The transcript should tell a coherent story even after many screens of history.

## Following streaming output

Streaming should feel localized and steady.

The user should experience:
- text growing in place
- shell regions staying stable
- no jumpy recomputation across the transcript
- a clear sense of whether the model is thinking, writing, or waiting on tools

Why it matters:
- Perceived performance is mostly a stability problem in a TUI.

Evidence:
- Stable-region updates are a recurring pattern in best-in-class TUIs and Ink guidance.

How it applies to BetterCode:
- BetterCode should optimize for the feeling of "this row is updating" instead of "the screen is redrawing."

## Understanding tool calls

Tool calls should provide confidence at a glance.

The user should see:
- what tool ran
- why it ran
- what happened
- whether they need to care

Why it matters:
- Agent trust depends on making execution transparent without turning the transcript into a debug console.

Evidence:
- Strong coding-agent UX keeps the user informed without forcing low-level inspection.

How it applies to BetterCode:
- Tool rows should behave like execution receipts, not like default-expanded logs.

## Inspecting detailed tool output only when needed

Detail inspection should feel like a deliberate drill-down, not a penalty.

The user should be able to:
- expand one tool row inline
- jump to larger output in a pager-like surface
- inspect errors with context
- return to the transcript without losing place

Why it matters:
- Large command output, diffs, and logs are necessary sometimes but harmful when permanently inline.

Evidence:
- Terminal tools routinely use drill-down patterns to preserve readability.

How it applies to BetterCode:
- BetterCode should support inline expand for short detail and explicit larger-output flows for long detail.

## Entering prompts

The composer should feel fast, predictable, and forgiving.

The user should be able to:
- type naturally
- move the cursor
- edit anywhere in the draft
- use multiline input when needed
- paste large prompts safely
- understand exactly what Enter and modified Enter variants do

Why it matters:
- This is the daily control loop of the product.

Evidence:
- Serious coding-agent usage depends on frictionless prompt entry.

How it applies to BetterCode:
- Composer work should be treated like editor work, not auxiliary UI work.

## Navigating previous content

Long-session navigation should feel deliberate and recoverable.

The user should be able to:
- jump to latest
- find recent errors
- inspect the last tool-heavy section
- recover their place after opening detail
- re-enter a session and understand where work stands

Why it matters:
- Real coding sessions accumulate history quickly.

Evidence:
- Terminal workflows rely heavily on efficient reorientation.

How it applies to BetterCode:
- Navigation affordances should be built around transcript landmarks, not only raw scrolling.

## Handling confirmations, interrupts, and errors

Interruptive states should be unmistakable and minimal.

The user should experience:
- confirmations as clear, focused prompts
- interrupts as explicit state changes
- errors as readable summaries with optional detail
- no ambiguity about whether the system is waiting on them

Why it matters:
- Ambiguous interruptions are one of the fastest ways to make agent tooling feel fragile.

Evidence:
- Best-in-class terminal tools reserve strong treatment for states that require action.

How it applies to BetterCode:
- Use dialogs and elevated inline states only for action-required events. Everything else stays quiet.

## Using BetterCode during long coding sessions

The long-session experience should feel like a steady desk lamp, not a control room.

The user should feel:
- low visual fatigue
- strong orientation
- confidence that details are there if needed
- confidence that the tool will not degrade as the session grows

Why it matters:
- BetterCode’s real product test is sustained use, not first impression.

Evidence:
- Every successful terminal productivity tool optimizes for endurance.

How it applies to BetterCode:
- The design bar should be "good after three hours," not just "impressive after three minutes."

# 7. Recommended UI architecture

## Shell structure

Recommended structure:
- top shell bar
- main transcript pane
- optional secondary pane or overlay
- bottom dock
- quiet status rail or line

Why it matters:
- A predictable shell reduces cognitive load and contains repaint scope.

Evidence from repo:
- `packages/tui-ink/src/screens/SessionScreen.tsx` already has most of these pieces.
- The issue is weighting and contract, not missing capability.

How it applies to BetterCode:
- Keep the current shell decomposition, but make region ownership explicit and stable.

## Component boundaries

Recommended boundaries:
- `Shell`: owns top-level layout, resize classes, and persistent regions
- `Transcript`: owns windowing, scroll position, anchors, and row virtualization
- `TranscriptRow`: owns one immutable row view model
- `ToolRow`: owns collapsed/expanded execution display
- `ComposerEngine`: owns text editing, cursor, selection, paste, submit behavior
- `ComposerChrome`: owns menus, hints, attachments, and controls
- `StatusModel`: derives one coherent global status payload
- `OverlayManager`: owns dialogs, confirm flows, help, and toasts

Why it matters:
- Better boundaries reduce hot-path complexity and make performance work tractable.

Evidence from repo:
- `packages/tui-ink/src/components/Composer.tsx` currently mixes engine and chrome.
- `packages/tui-ink/src/components/MessageList.tsx` mixes list mechanics with presentation concerns.

How it applies to BetterCode:
- Split critical surfaces by pressure and responsibility, not by creating many tiny generic components.

## Layout primitives

Recommended primitives:
- `Section`: vertical grouping with standardized spacing
- `Frame`: optional low-contrast structural boundary
- `InlineMeta`: compact metadata line with consistent separators
- `Callout`: explicit action-required or error surface
- `CollapsibleDetail`: standardized detail-expansion behavior
- `HintStrip`: focus-scoped keyboard hints

Why it matters:
- BetterCode needs a small visual vocabulary that scales.

Evidence:
- Best TUIs succeed with repeated structural patterns rather than bespoke surfaces everywhere.

How it applies to BetterCode:
- Introduce only the primitives that remove real inconsistency in transcript rows, tool rows, dialogs, and shell chrome.

## Message rendering pipeline

Recommended pipeline:
- normalize backend message data into stable row view models
- split rows into role-specific variants
- memoize row rendering on immutable inputs
- maintain row height cache for completed rows
- render only visible or near-visible rows

Why it matters:
- This is the biggest performance and readability improvement available.

Evidence from repo:
- Current transcript rendering in `packages/tui-ink/src/components/MessageList.tsx` is still too broad.
- The backend already supplies enough structure to derive more stable row models.

How it applies to BetterCode:
- Introduce a transcript adapter layer between the store and rendering. This is where BetterCode should define "what the user sees," not inside ad hoc component logic.

## Tool call rendering strategy

Recommended strategy:
- summary-first row
- inline state badge or prefix
- optional expanded detail panel
- pager/open/export path for oversized output
- auto-expansion only for failure or permission-required states

Why it matters:
- Tool presentation needs a consistent contract.

Evidence from repo:
- `packages/tui-ink/src/components/parts/ToolPart.tsx` already provides the right base primitive.

How it applies to BetterCode:
- Keep tool calls in transcript order, but make them read like compact execution receipts.

## Event and state model

Recommended model:
- backend session state
- transcript rendering state
- shell UI state
- composer state
- overlay state

Why it matters:
- These domains have different update frequencies and different render sensitivities.

Evidence from repo:
- `packages/tui-ink/src/store.ts` currently mixes them too closely.

How it applies to BetterCode:
- Do not begin with a full store rewrite.
- First introduce derived selectors and domain view models.
- Split store domains only where measurement proves it helps.

## Styling and theming strategy

Recommended strategy:
- semantic tokens for role and state, not component-specific ad hoc colors
- limited structural backgrounds
- text-first emphasis
- three-level visual hierarchy
- reduced dependency on border-heavy framing

Why it matters:
- Premium terminal design comes from disciplined semantic styling.

Evidence from repo:
- Theme infrastructure exists, but usage needs tightening.
- Live-preview styling surfaces may currently cause more churn than value in some flows.

How it applies to BetterCode:
- Standardize tokens by semantic purpose: primary content, secondary metadata, tertiary hint, success, warning, error, active focus.

## What should be generalized

Generalize:
- collapsible detail behavior
- shell framing and spacing
- callout states
- status formatting
- shortcut hint strips

Why it matters:
- These patterns recur and benefit from consistency.

How it applies to BetterCode:
- Generalize only the patterns already repeated across transcript and overlays.

## What should remain specialized

Keep specialized:
- transcript row rendering
- tool execution rows
- composer engine
- session launcher / home flow

Why it matters:
- These are core product surfaces with unique requirements.

How it applies to BetterCode:
- Do not over-abstract the product-defining parts of the UI.

# 8. Performance and implementation considerations

## Biggest rerender risks

Why it matters:
- Most TUI performance failures are state-propagation failures.

Evidence from repo:
- `packages/tui-ink/src/components/MessageList.tsx` still does list-wide work.
- `packages/tui-ink/src/store.ts` exposes broad state surfaces.
- Session-part structures likely create object churn that invalidates more than the streaming row.

How it applies to BetterCode:
- Measure which rows rerender during a single streamed delta.
- The target should be: active streaming row updates, shell stays still, unrelated history remains memoized.

## Large list handling

Why it matters:
- Long sessions are the real test case.

Evidence:
- Full-list rendering scales poorly in Ink just as it does in browser UIs, often worse because paint cost is user-visible in terminal redraws.

How it applies to BetterCode:
- Implement a transcript window.
- Cache stable row heights.
- Precompute row summaries and markdown segments when a row is finalized.

## Layout instability

Why it matters:
- Users interpret jumpy layout as slowness and unreliability.

Evidence:
- Stable-region TUIs consistently feel faster.

How it applies to BetterCode:
- Keep header and bottom dock heights fixed where possible.
- Avoid repeatedly changing the vertical footprint of live tool rows.
- Minimize row-height changes during streaming.

## Composer hot path

Why it matters:
- Input latency matters more than nearly any other micro-interaction.

Evidence from repo:
- `packages/tui-ink/src/components/Composer.tsx` is logic-dense and likely rerenders on more than pure input state.

How it applies to BetterCode:
- Separate text-edit engine state from visual adornments.
- Ensure menu state, attachment state, and transcript activity do not degrade typing responsiveness.

## Terminal repaint constraints

Why it matters:
- Terminal apps pay for every changed cell. Paint discipline matters.

Evidence:
- Ink guidance and mature TUIs both reward minimizing changed output regions.

How it applies to BetterCode:
- Measure cell churn during streaming and scrolling.
- Favor localized updates and stable shells.
- Audit theme previews, flashing indicators, and repeated separators for paint cost.

## Measurement strategy

Why it matters:
- BetterCode should not guess which refactors help.

Recommended measurement:
- count row rerenders during a streaming assistant turn
- measure input latency while a tool is streaming
- record transcript paint cost for 100-message and 500-message sessions
- test narrow terminal widths
- test under tmux and over SSH
- profile paste of large prompts
- profile expansion of large tool outputs

How it applies to BetterCode:
- Add lightweight instrumentation in development builds around transcript rows, composer updates, and scroll operations.

## Rules for future contributors

Why it matters:
- Production polish erodes quickly without contribution guardrails.

Recommended rules:
- no new transcript-wide selectors in render paths
- no default-expanded large payloads
- no color-only state communication
- no new shell chrome without clear information hierarchy value
- no new hot-path abstractions without a measured benefit
- test every UI change in narrow width and long-session scenarios

How it applies to BetterCode:
- These should become explicit TUI contribution rules, not just review preferences.

# 9. Prioritized roadmap

## Phase 1: Highest leverage improvements

### 1. Fix composer ergonomics
Impact:
- Very high

Effort:
- Medium to high

Risk:
- Medium

Dependency notes:
- Independent of backend changes

Type:
- Both UX and code

Why it matters:
- This is the most user-visible rough edge.

Evidence:
- Current composer behavior in `packages/tui-ink/src/components/Composer.tsx` is not yet editor-grade.

How it applies to BetterCode:
- Implement cursor movement, multiline editing, paste handling, and clearer submit behavior before broader polish work.

### 2. Rework transcript rendering for long sessions
Impact:
- Very high

Effort:
- High

Risk:
- Medium

Dependency notes:
- Should begin after basic measurement scaffolding

Type:
- Both UX and code

Why it matters:
- This is the main path to stable perceived performance.

Evidence:
- `packages/tui-ink/src/components/MessageList.tsx` still performs too much list-level work.

How it applies to BetterCode:
- Add row memoization, completed-row height caching, and a windowed or near-windowed transcript strategy.

### 3. Standardize tool disclosure behavior
Impact:
- High

Effort:
- Medium

Risk:
- Low

Dependency notes:
- Can run in parallel with transcript work

Type:
- Both UX and code

Why it matters:
- This is the clearest path to a calmer transcript.

Evidence:
- Tool presentation currently has the right primitive but inconsistent staging.

How it applies to BetterCode:
- Move to summary-first tool rows, failure-expanded detail, and pager/export for large outputs.

### 4. Simplify shell status hierarchy
Impact:
- High

Effort:
- Low to medium

Risk:
- Low

Dependency notes:
- Should be coordinated with dock polish

Type:
- Both UX and code

Why it matters:
- Reduces cognitive load immediately.

Evidence:
- Status information is currently spread across multiple surfaces.

How it applies to BetterCode:
- Define one quiet global status line and remove duplicated indicators elsewhere.

## Phase 2: Structural improvements

### 5. Split composer engine from composer chrome
Impact:
- High

Effort:
- Medium

Risk:
- Medium

Dependency notes:
- Best done after phase-1 composer fixes clarify responsibilities

Type:
- Code

Why it matters:
- Makes further composer iteration safer and faster.

Evidence:
- Current composer file is too responsibility-dense.

How it applies to BetterCode:
- Separate text editing logic from menus, hints, and attachments.

### 6. Introduce transcript row view models and narrower selectors
Impact:
- High

Effort:
- Medium

Risk:
- Medium

Dependency notes:
- Pairs naturally with transcript performance work

Type:
- Code

Why it matters:
- Prevents broad invalidation and clarifies rendering contracts.

Evidence:
- Store and list rendering are too tightly coupled today.

How it applies to BetterCode:
- Build a transcript adapter layer that produces stable immutable row data.

### 7. Clean up unused or legacy surfaces
Impact:
- Medium

Effort:
- Low

Risk:
- Low

Dependency notes:
- Can happen incrementally

Type:
- Code

Why it matters:
- Reduces drift and review ambiguity.

Evidence:
- Unused components such as `packages/tui-ink/src/components/InputBar.tsx`, `packages/tui-ink/src/components/ChatPane.tsx`, and `packages/tui-ink/src/components/ContextPane.tsx` suggest architectural leftovers.

How it applies to BetterCode:
- Remove or formally re-home dead surfaces so the intended architecture is obvious.

### 8. Define narrow-width and remote-terminal behavior
Impact:
- Medium to high

Effort:
- Medium

Risk:
- Low

Dependency notes:
- Best after shell hierarchy is simplified

Type:
- Both UX and code

Why it matters:
- Production-class terminal UX must survive real terminal constraints.

Evidence:
- Current layout likely compresses rather than deliberately adapts.

How it applies to BetterCode:
- Add width-band rules and test under tmux, SSH, and common terminal sizes.

## Phase 3: Polish and advanced features

### 9. Add richer transcript landmarks and jump navigation
Impact:
- Medium

Effort:
- Medium

Risk:
- Low

Dependency notes:
- Benefits from stabilized transcript architecture

Type:
- Both UX and code

Why it matters:
- Improves long-session orientation.

How it applies to BetterCode:
- Add jumps to latest, errors, pending confirmations, and recent tool-heavy sections.

### 10. Add large-output inspection flows
Impact:
- Medium

Effort:
- Medium

Risk:
- Low

Dependency notes:
- Should follow tool disclosure cleanup

Type:
- Both UX and code

Why it matters:
- Prevents transcript pollution while preserving inspectability.

How it applies to BetterCode:
- Support pager-like view, open/export actions, or structured drill-down for big logs and diffs.

### 11. Formalize shared primitives for dialogs, callouts, and hint strips
Impact:
- Medium

Effort:
- Medium

Risk:
- Low

Dependency notes:
- Best after the high-pressure surfaces are stabilized

Type:
- Code

Why it matters:
- Improves consistency and future extensibility.

How it applies to BetterCode:
- Standardize repeated patterns only after the right UX contracts have been proven in real product surfaces.

# 10. Quick wins

## 1. Collapse successful tool calls by default
Why it matters:
- Immediate reduction in transcript noise.

Evidence:
- Tool rows already support collapse patterns.

How it applies to BetterCode:
- Keep one-line success summaries visible and hide bulky detail unless requested.

## 2. Expand failures and action-required tool states by default
Why it matters:
- Makes important interruptions impossible to miss.

Evidence:
- Failure is more important than routine success.

How it applies to BetterCode:
- Error, warning, and permission-required states should break the default collapse rule.

## 3. Simplify and unify status indicators
Why it matters:
- Immediate improvement in calmness.

Evidence:
- Current status is spread across multiple surfaces.

How it applies to BetterCode:
- Remove redundant generation indicators and keep one global session state readout.

## 4. Tighten visual hierarchy with a three-weight system
Why it matters:
- Makes the UI feel more premium without heavy rework.

Evidence:
- The shell already has structure; it just needs clearer weighting.

How it applies to BetterCode:
- Make transcript primary, metadata secondary, and hints tertiary through consistent color and spacing.

## 5. Give header and dock stronger structural anchoring
Why it matters:
- Improves scan order immediately.

Evidence:
- Current shell can feel slightly unframed.

How it applies to BetterCode:
- Use low-contrast background anchoring or separator discipline for top and bottom regions.

## 6. Remove or hide dead secondary surfaces
Why it matters:
- Reduces ambiguity for contributors and users.

Evidence:
- Some side components appear inactive or legacy.

How it applies to BetterCode:
- Remove dormant UI paths from the active architecture.

## 7. Make shortcut hints contextual instead of broad
Why it matters:
- Better discoverability with less clutter.

Evidence:
- High-quality TUIs show focus-relevant keys, not exhaustive legends.

How it applies to BetterCode:
- Keep only the most useful current actions visible in the dock or status line.

## 8. Improve home screen from splash to launcher
Why it matters:
- Startup should feel like entering a workspace.

Evidence:
- A practical launcher supports actual use better than a branded welcome composition.

How it applies to BetterCode:
- Emphasize recent sessions, model/status, and next actions over decorative presentation.

# 11. PR-ready backlog

## Theme: Composer

### Title
Editor-grade composer behavior

Why
- The composer is the highest-friction product surface today.

Scope
- Add cursor movement, multiline editing, clearer submit/newline behavior, and robust paste handling.

Files/components likely involved
- `packages/tui-ink/src/components/Composer.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`

Acceptance criteria
- User can move cursor within the draft
- User can edit in the middle of text
- User can create multiline drafts intentionally
- Large pasted prompts remain usable and predictable
- Typing latency remains stable during streaming

### Title
Separate composer engine from composer chrome

Why
- Current composer is too responsibility-dense for reliable iteration.

Scope
- Extract text-editing state and behavior from visual menus, hints, and attachment affordances.

Files/components likely involved
- `packages/tui-ink/src/components/Composer.tsx`

Acceptance criteria
- Text editing logic can be reasoned about independently
- Visual chrome changes do not affect core editing behavior
- Input performance is measurably stable under load

## Theme: Transcript and performance

### Title
Introduce transcript row view models

Why
- Stable immutable row data is the basis for memoized rendering.

Scope
- Add an adapter layer from backend/store state into transcript row models.

Files/components likely involved
- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/store.ts`

Acceptance criteria
- Each row renderer receives a narrow, stable payload
- Unchanged rows do not rerender during a typical stream delta
- Transcript rendering logic is easier to profile and test

### Title
Add completed-row height caching and row memoization

Why
- Reduces expensive transcript-wide recomputation.

Scope
- Cache heights once rows stabilize and memoize row components on stable inputs.

Files/components likely involved
- `packages/tui-ink/src/components/MessageList.tsx`
- row components in `packages/tui-ink/src/components`

Acceptance criteria
- Completed rows do not repeatedly recompute height
- Streaming one row does not invalidate the whole transcript
- Long sessions remain responsive

### Title
Window transcript rendering

Why
- Full-list rendering will not scale to production-class long sessions.

Scope
- Render only visible and nearby rows with stable scroll behavior.

Files/components likely involved
- `packages/tui-ink/src/components/MessageList.tsx`

Acceptance criteria
- Transcript remains responsive in large sessions
- Scroll behavior remains correct and predictable
- User does not perceive missing content while navigating

## Theme: Tool UX

### Title
Standardize tool row state ladder

Why
- Tool activity is currently too noisy and insufficiently staged.

Scope
- Define row behavior for running, success, warning, error, and permission-required states.

Files/components likely involved
- `packages/tui-ink/src/components/parts/ToolPart.tsx`

Acceptance criteria
- Running tools show concise live summaries
- Successful tools collapse to compact summaries
- Errors and action-required states expand by default
- Default tool rows avoid raw payload clutter

### Title
Add oversized output inspection flow

Why
- Large logs and diffs should not bloat the transcript.

Scope
- Add pager-like or drill-down inspection path for oversized tool output.

Files/components likely involved
- tool rendering components
- dialog or overlay surfaces

Acceptance criteria
- Large output does not render fully inline by default
- User can inspect and exit detail without losing transcript position
- Error context remains easy to access

## Theme: Shell and hierarchy

### Title
Unify session status model

Why
- BetterCode currently communicates overlapping status in multiple places.

Scope
- Derive one global session status and reduce duplicated indicators.

Files/components likely involved
- `packages/tui-ink/src/components/Header.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- `packages/tui-ink/src/screens/SessionScreen.tsx`

Acceptance criteria
- One primary global status indicator exists
- Inline tool state remains local to tool rows
- Users can immediately tell whether the agent is idle, streaming, blocked, or waiting

### Title
Apply three-weight visual hierarchy across the shell

Why
- The current UI is functional but not yet calm or premium.

Scope
- Standardize primary, secondary, and tertiary treatments for transcript, metadata, and hints.

Files/components likely involved
- shell, transcript, dock, status, dialogs, theme usage

Acceptance criteria
- Transcript is visually dominant
- Metadata supports without competing
- Hints are available without visual shouting
- State is understandable without relying only on color

### Title
Refactor home screen into a practical launcher

Why
- Startup should optimize for immediate work, not splash presentation.

Scope
- Rework home screen to emphasize recent sessions and next actions.

Files/components likely involved
- `packages/tui-ink/src/screens/HomeScreen.tsx`

Acceptance criteria
- Startup emphasizes recency and readiness
- The screen feels like a launcher, not a welcome page
- Narrow terminals remain usable

## Theme: State and maintainability

### Title
Narrow hot-path store selectors

Why
- Broad store subscriptions are a major rerender risk.

Scope
- Audit transcript, composer, and shell selectors and replace broad subscriptions with narrower derived selectors.

Files/components likely involved
- `packages/tui-ink/src/store.ts`
- transcript and composer hooks/components

Acceptance criteria
- Hot surfaces subscribe only to the state they need
- Streaming updates do not rerender unrelated chrome
- Selector logic is easier to reason about

### Title
Remove legacy or unused TUI surfaces

Why
- Dead code makes architecture drift harder to reverse.

Scope
- Audit and remove or formally re-home unused components.

Files/components likely involved
- `packages/tui-ink/src/components/InputBar.tsx`
- `packages/tui-ink/src/components/ChatPane.tsx`
- `packages/tui-ink/src/components/ContextPane.tsx`

Acceptance criteria
- The active TUI architecture is obvious from the component tree
- Dead or dormant surfaces are no longer confusing contributors
- There is less duplicated responsibility in the codebase

## Theme: Production hardening

### Title
Add terminal compatibility test matrix

Why
- Production-class terminal tools must behave well in real terminal environments.

Scope
- Define and test common width bands, theme modes, tmux usage, SSH/remoting, and reduced-color cases.

Files/components likely involved
- app shell and render-sensitive surfaces across `packages/tui-ink/src`

Acceptance criteria
- Documented supported terminal scenarios exist
- Narrow-width behavior is intentional
- State remains understandable without color dependence

### Title
Add TUI performance instrumentation for development

Why
- Performance work should be measured, not guessed.

Scope
- Add development-only counters or logs for row rerenders, transcript updates, and input latency.

Files/components likely involved
- transcript and composer hot paths
- development utilities

Acceptance criteria
- Engineers can observe rerender counts for streaming sessions
- Regressions are easier to catch during review
- Performance improvements can be verified empirically
