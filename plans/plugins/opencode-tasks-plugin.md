# opencode-tasks plugin

## Goal

Build a self-contained npm plugin named `opencode-tasks` that enforces a task-first workflow in opencode:

- no implementation without a written plan
- exactly one active task at a time
- structured handover between sessions
- task state persisted in git on the current branch via `.tasks/*.md`

## Agreed decisions

- Package name: `opencode-tasks`
- Export name: `TasksPlugin`
- Task state directory: `.tasks/`
- Task identifiers: `T1`, `T2`, `T3`, ...
- Step identifiers: checklist items under each task
- Tool names:
  - `task_manager_read`
  - `task_manager_tick`
  - `task_manager_handover`
- Runtime: Bun-only
- Tests: `bun:test`
- Persistence model:
  - `.tasks/` lives in the consumer project's worktree
  - `.tasks/` is committed to git
  - only one non-completed plan may exist per branch

## Deliverables

- `opencode-tasks/` package scaffold
- Bun/TypeScript source under `src/`
- unit tests for parser and registry
- packaged `agents/` and `skills/`
- README documenting install and workflow

## Package structure

```text
opencode-tasks/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts
    plan.ts
    registry.ts
    tools.ts
    compaction.ts
    hooks.ts
  test/
    plan.test.ts
    registry.test.ts
  agents/
    planner.md
    builder.md
  skills/
    task-workflow/
      SKILL.md
```

## Detailed todo list

### 1. Scaffold the package

- [ ] Create `opencode-tasks/` as a sibling package
- [ ] Add `package.json` with:
  - [ ] `name: "opencode-tasks"`
  - [ ] `main: "dist/index.js"`
  - [ ] `types: "dist/index.d.ts"`
  - [ ] `files: ["dist", "agents", "skills", "README.md"]`
  - [ ] `peerDependencies["@opencode-ai/plugin"]`
  - [ ] `devDependencies` for `@opencode-ai/plugin` and `typescript`
  - [ ] scripts for `build`, `test`, and `typecheck`
- [ ] Add `tsconfig.json` targeting modern ESM output in `dist/`
- [ ] Create empty source/test/asset directories

### 2. Implement the plan data model in `src/plan.ts`

- [ ] Define `TaskStatus = "not_started" | "in_progress" | "blocked" | "completed"`
- [ ] Define `Step` type:
  - [ ] `text: string`
  - [ ] `done: boolean`
- [ ] Define `Task` type:
  - [ ] `id`
  - [ ] `title`
  - [ ] `goal`
  - [ ] `doneWhen`
  - [ ] `files`
  - [ ] `steps`
- [ ] Define `HandoverState` type:
  - [ ] `currentTask`
  - [ ] `status`
  - [ ] `completed`
  - [ ] `decisions`
  - [ ] `blockers`
  - [ ] `resumeFile`
  - [ ] `resumeLocation`
  - [ ] `nextAction`
  - [ ] `systemState`
  - [ ] `doNotRedo`
- [ ] Define `Plan` type:
  - [ ] `filePath`
  - [ ] `slug`
  - [ ] `title`
  - [ ] `context`
  - [ ] `scope`
  - [ ] `filesTouched`
  - [ ] `tasks`
  - [ ] `handover`
- [ ] Implement `parsePlan(filePath, content)`:
  - [ ] parse title from first `# ...` line
  - [ ] parse `## Context`
  - [ ] parse `## Scope`
  - [ ] parse `## Files likely touched`
  - [ ] parse `## Tasks`
  - [ ] split task blocks on `### T<n>: `
  - [ ] parse task `Goal`, `Done when`, `Files`, and checklist steps
  - [ ] parse `## Handover state`
  - [ ] parse `### Current task: ...`
  - [ ] parse `### Status: ...`
  - [ ] parse `### Completed: [...]`
  - [ ] parse `### Decisions`
  - [ ] parse `### Blockers`
  - [ ] parse `### Next session context`
  - [ ] parse `Start here`, `State of the system`, `Next action`, `Do NOT redo`
  - [ ] tolerate trailing whitespace and optional trailing newline
- [ ] Implement `serializeHandover(handover)`
- [ ] Implement `tickStep(content, stepText)`:
  - [ ] replace `- [ ] ...` with `- [x] ...`
  - [ ] throw a descriptive error if the step text is not found
- [ ] Implement `updateHandover(content, handover)`:
  - [ ] replace existing `## Handover state`
  - [ ] append the section if it does not exist
- [ ] Implement helpers:
  - [ ] `currentTask(plan)`
  - [ ] `nextTask(plan)`
  - [ ] `taskProgress(task)`
  - [ ] `isComplete(plan)`

### 3. Implement the registry in `src/registry.ts`

- [ ] Create `PlanRegistry` class with constructor taking `worktree`
- [ ] Add internal caches for:
  - [ ] parsed plans by file path
  - [ ] raw markdown by file path
- [ ] Implement `plansDir()` returning `<worktree>/.tasks`
- [ ] Implement `ensurePlansDir()`:
  - [ ] create `.tasks/` if missing
- [ ] Implement `refresh()`:
  - [ ] scan `.tasks/*.md` with `Bun.Glob`
  - [ ] skip dotfiles
  - [ ] read all files with `Bun.file(...).text()`
  - [ ] parse and cache valid plans
- [ ] Implement `load(filePath)`:
  - [ ] read one file
  - [ ] parse it
  - [ ] update caches
  - [ ] return parsed plan
  - [ ] return `null` if unreadable or invalid
- [ ] Implement `write(filePath, content)`:
  - [ ] write file with `Bun.write`
  - [ ] refresh that cache entry
- [ ] Implement getters:
  - [ ] `getContent(filePath)`
  - [ ] `getPlan(filePath)`
  - [ ] `allPlans()`
- [ ] Implement `activePlan()`:
  - [ ] find all plans whose handover status is not `completed`
  - [ ] return the only active plan when exactly one exists
  - [ ] return `undefined` when none exist
  - [ ] throw a descriptive error when more than one active plan exists

### 4. Add tests for parser and registry

- [ ] Create `test/plan.test.ts`
- [ ] Add a canonical `.tasks/*.md` fixture string covering:
  - [ ] context
  - [ ] scope
  - [ ] files likely touched
  - [ ] multiple tasks
  - [ ] handover state
- [ ] Test `parsePlan()` returns the expected object shape
- [ ] Test `serializeHandover()` output format
- [ ] Test `tickStep()` checks the correct step
- [ ] Test `tickStep()` throws when the step text does not exist
- [ ] Test `updateHandover()` replaces an existing handover block
- [ ] Test `updateHandover()` appends when missing
- [ ] Test `currentTask()`
- [ ] Test `nextTask()`
- [ ] Test `taskProgress()`
- [ ] Test `isComplete()`
- [ ] Create `test/registry.test.ts`
- [ ] Test `refresh()` loads plans from a temp `.tasks/`
- [ ] Test `write()` updates both file contents and cache
- [ ] Test `activePlan()` returns the one non-completed plan
- [ ] Test `activePlan()` throws when two non-completed plans exist

### 5. Implement LLM-facing tools in `src/tools.ts`

- [ ] Create `createTools(registry)` returning a tool map
- [ ] Implement `task_manager_read`
  - [ ] accept optional `planFile`
  - [ ] call `registry.refresh()`
  - [ ] resolve the requested or active plan
  - [ ] return an instructional message if no active plan exists
  - [ ] compute current task and progress
  - [ ] format the output with:
    - [ ] plan slug
    - [ ] plan file path
    - [ ] current task id and title
    - [ ] task progress
    - [ ] goal
    - [ ] done-when condition
    - [ ] key files
    - [ ] step checklist
    - [ ] previous handover
    - [ ] all task titles
    - [ ] completed task ids
- [ ] Implement `task_manager_tick`
  - [ ] accept required `task` step text and optional `planFile`
  - [ ] resolve the active plan
  - [ ] read cached raw content
  - [ ] call `tickStep()`
  - [ ] persist updated content via `registry.write()`
  - [ ] return success message
  - [ ] catch not-found errors and return a helpful hint
- [ ] Implement `task_manager_handover`
  - [ ] accept decisions, resume file, resume location, next action, system state
  - [ ] accept optional `doNotRedo`, `blockers`, and `planFile`
  - [ ] resolve the active plan and current task
  - [ ] reject if any steps remain unchecked
  - [ ] compute completed task ids through the current task
  - [ ] compute the next task if present
  - [ ] build the new `HandoverState`
  - [ ] set status to `in_progress` for the next task
  - [ ] set status to `completed` if there is no next task
  - [ ] update the markdown via `updateHandover()`
  - [ ] write the file through `registry.write()`
  - [ ] return a success message telling the session it can end

### 6. Implement compaction override in `src/compaction.ts`

- [ ] Export `createCompactionHook(registry)`
- [ ] Resolve the active plan
- [ ] Resolve the current task
- [ ] Push active task context into `output.context`
- [ ] Replace `output.prompt` with the structured task-aware compaction prompt
- [ ] Ensure the prompt:
  - [ ] outputs markdown only
  - [ ] includes active plan, current task, and status
  - [ ] asks for 3-5 bullets of completed work
  - [ ] includes files modified, decisions made, current system state, resume point, do-not-redo list, blockers
  - [ ] stays under 400 words

### 7. Implement lifecycle hooks in `src/hooks.ts`

- [ ] Export `createHooks(registry, client, worktree)`
- [ ] Add module-level toast dedupe set keyed by `sessionId + taskId`
- [ ] Implement `onSessionCreated`
  - [ ] wait briefly for session init
  - [ ] refresh registry
  - [ ] resolve active plan
  - [ ] compute current task and progress
  - [ ] build the injected context string
  - [ ] call `client.session.prompt(... noReply: true ...)`
  - [ ] do nothing when no active plan exists
- [ ] Implement `onFileEdited`
  - [ ] inspect `event.properties?.path`
  - [ ] if it matches `/.tasks/*.md`, reload that file via `registry.load()`
- [ ] Implement `onSessionIdle`
  - [ ] resolve active plan
  - [ ] compute current task progress
  - [ ] show a success toast when all steps are done
  - [ ] show a progress toast when some but not all steps are done
  - [ ] suppress repeated toasts for the same session/task combination
- [ ] Wrap every hook body in try/catch
- [ ] Log failures via `client.app.log`

### 8. Implement plugin entry point in `src/index.ts`

- [ ] Import plugin types from `@opencode-ai/plugin`
- [ ] Import registry, tools, hooks, and compaction factory
- [ ] Export `TasksPlugin`
- [ ] In plugin startup:
  - [ ] initialize `PlanRegistry`
  - [ ] call `registry.refresh()`
  - [ ] call `bootstrapAgents(worktree, $)`
  - [ ] create tool map
  - [ ] create lifecycle hooks
  - [ ] create compaction hook
  - [ ] return the plugin object with tools and hooks wired in
- [ ] Implement `bootstrapAgents(worktree, $)`
  - [ ] resolve package root from `import.meta.url`
  - [ ] resolve source/destination paths for `agents/`
  - [ ] resolve source/destination paths for `skills/`
  - [ ] create `.opencode/agents` and `.opencode/skills`
  - [ ] copy `planner.md` only if absent
  - [ ] copy `builder.md` only if absent
  - [ ] copy `skills/task-workflow/` only if absent
  - [ ] create `.tasks/` if absent
  - [ ] create `.tasks/.gitkeep` if absent
  - [ ] never overwrite user-modified agent or skill files

### 9. Add packaged agent definitions

#### `agents/planner.md`

- [ ] Add frontmatter for a planning-only subagent
- [ ] State that it must never write implementation code
- [ ] State that it must survey the repo before writing a plan
- [ ] State that it must always write the plan file before replying
- [ ] Update terminology to tasks and steps
- [ ] Add single-active rule:
  - [ ] call `task_manager_read` before creating a new plan
  - [ ] if an active plan exists, stop and report it
  - [ ] do not create parallel plans
- [ ] Require output of plan path plus one-line summary of each task

#### `agents/builder.md`

- [ ] Add frontmatter for the primary implementation agent
- [ ] State the startup rules:
  - [ ] call `task_manager_read` first
  - [ ] load only current task files
  - [ ] check `Do NOT redo`
  - [ ] start with the first unchecked step
- [ ] State execution rules:
  - [ ] call `task_manager_tick` after each completed step
  - [ ] do not start the next task
  - [ ] do not read outside current task files unless necessary
  - [ ] surface newly discovered work instead of absorbing it silently
- [ ] State completion rules:
  - [ ] all steps checked
  - [ ] done-when condition verified
  - [ ] no broken state left
  - [ ] call `task_manager_handover`
  - [ ] end the session after handover

### 10. Add packaged skill documentation

- [ ] Create `skills/task-workflow/SKILL.md`
- [ ] Describe the workflow loop:
  - [ ] planner writes `.tasks/<slug>.md`
  - [ ] builder calls `task_manager_read`
  - [ ] builder executes steps and calls `task_manager_tick`
  - [ ] builder calls `task_manager_handover` when task is verified complete
  - [ ] next session resumes from the updated plan
- [ ] Document `.tasks/` as the shared branch-persistent memory location
- [ ] Document the three tools and what each does
- [ ] Document the context discipline rules

### 11. Write the README

- [ ] Add section: what the plugin does
- [ ] Add section: install via `opencode.json`
- [ ] Add section: how the task loop works
- [ ] Add section: the three tools
- [ ] Add section: plan file format with a minimal example
- [ ] Add section: customising copied agents in `.opencode/agents/`
- [ ] Add section: where to add team-specific conventions
- [ ] Include the persistence model:
  - [ ] `.tasks/` is committed to git
  - [ ] branch state persists automatically
  - [ ] only one active plan per branch

### 12. Validate the package

- [ ] Run TypeScript build successfully
- [ ] Run `bun:test` successfully
- [ ] Fix any type or test failures
- [ ] Confirm `dist/` contains compiled modules for:
  - [ ] `index`
  - [ ] `plan`
  - [ ] `registry`
  - [ ] `tools`
  - [ ] `compaction`
  - [ ] `hooks`
- [ ] Confirm `agents/` and `skills/` are packaged as raw markdown assets

## Definition of done

- [ ] `opencode-tasks` can be installed as an opencode plugin
- [ ] A new task produces a committed `.tasks/<slug>.md`
- [ ] A new session resumes from the current branch's `.tasks/` state
- [ ] Builder agent can read, tick, and hand over exactly one task at a time
- [ ] Multiple active plans on one branch are rejected
- [ ] Compaction output is task-aware instead of generic
- [ ] Build and tests pass
