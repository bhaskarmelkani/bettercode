import { Binary } from "@opencode-ai/util/binary"
import { produce, reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type {
  Message,
  Part,
  PermissionRequest,
  Project,
  QuestionRequest,
  Session,
  SessionStatus,
  SnapshotFileDiff,
  Todo,
} from "@opencode-ai/sdk/v2/client"
import type { DebugEntry, DebugRaw, State, VcsCache } from "./types"
import { trimSessions } from "./session-trim"
import { dropSessionCaches } from "./session-cache"
import { diffs as list, message as clean } from "@/utils/diffs"

const SKIP_PARTS = new Set(["patch", "step-start", "step-finish"])
const DEBUG_LIMIT = 500

const makeID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const entry = (sessionID: string, stage: string, title: string, data: Record<string, any> = {}): DebugEntry => ({
  id: makeID(),
  sessionID,
  time: Date.now(),
  stage,
  title,
  data,
})

function appendTrace(setStore: SetStoreFunction<State>, sessionID: string, item: DebugEntry) {
  setStore(
    "debug_trace",
    sessionID,
    produce((draft = []) => {
      draft.push(item)
      if (draft.length > DEBUG_LIMIT) draft.splice(0, draft.length - DEBUG_LIMIT)
      return draft
    }),
  )
}

function appendRaw(setStore: SetStoreFunction<State>, sessionID: string, item: DebugRaw) {
  setStore(
    "debug_raw",
    sessionID,
    produce((draft = []) => {
      draft.push(item)
      if (draft.length > DEBUG_LIMIT) draft.splice(0, draft.length - DEBUG_LIMIT)
      return draft
    }),
  )
}

function sessionID(event: { type: string; properties?: unknown }) {
  const props = event.properties as Record<string, any> | undefined
  if (!props) return
  if (typeof props.sessionID === "string") return props.sessionID
  if (typeof props.info?.sessionID === "string") return props.info.sessionID
  if (typeof props.part?.sessionID === "string") return props.part.sessionID
}

export function applyGlobalEvent(input: {
  event: { type: string; properties?: unknown }
  project: Project[]
  setGlobalProject: (next: Project[] | ((draft: Project[]) => void)) => void
  refresh: () => void
}) {
  if (input.event.type === "global.disposed" || input.event.type === "server.connected") {
    input.refresh()
    return
  }

  if (input.event.type !== "project.updated") return
  const properties = input.event.properties as Project
  const result = Binary.search(input.project, properties.id, (s) => s.id)
  if (result.found) {
    input.setGlobalProject((draft) => {
      draft[result.index] = { ...draft[result.index], ...properties }
    })
    return
  }
  input.setGlobalProject((draft) => {
    draft.splice(result.index, 0, properties)
  })
}

function cleanupSessionCaches(
  setStore: SetStoreFunction<State>,
  sessionID: string,
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void,
) {
  if (!sessionID) return
  setSessionTodo?.(sessionID, undefined)
  setStore(
    produce((draft) => {
      dropSessionCaches(draft, [sessionID])
    }),
  )
}

export function cleanupDroppedSessionCaches(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  next: Session[],
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void,
) {
  const keep = new Set(next.map((item) => item.id))
  const stale = [
    ...Object.keys(store.message),
    ...Object.keys(store.session_diff),
    ...Object.keys(store.todo),
    ...Object.keys(store.permission),
    ...Object.keys(store.question),
    ...Object.keys(store.session_status),
    ...Object.values(store.part)
      .map((parts) => parts?.find((part) => !!part?.sessionID)?.sessionID)
      .filter((sessionID): sessionID is string => !!sessionID),
  ].filter((sessionID, index, list) => !keep.has(sessionID) && list.indexOf(sessionID) === index)
  if (stale.length === 0) return
  for (const sessionID of stale) {
    setSessionTodo?.(sessionID, undefined)
  }
  setStore(
    produce((draft) => {
      dropSessionCaches(draft, stale)
    }),
  )
}

export function applyDirectoryEvent(input: {
  event: { type: string; properties?: unknown }
  store: Store<State>
  setStore: SetStoreFunction<State>
  push: (directory: string) => void
  directory: string
  loadLsp: () => void
  vcsCache?: VcsCache
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void
}) {
  const event = input.event
  const debugSessionID = sessionID(event)
  const debugEnabled = input.store.debug_enabled ?? {}
  if (
    debugSessionID &&
    (debugEnabled[debugSessionID] ||
      event.type === "session.debug.updated" ||
      event.type === "session.debug.trace")
  ) {
    appendRaw(input.setStore, debugSessionID, {
      id: makeID(),
      time: Date.now(),
      type: event.type,
      properties: event.properties,
    })
  }
  switch (event.type) {
    case "server.instance.disposed": {
      input.push(input.directory)
      return
    }
    case "session.created": {
      const info = (event.properties as { info: Session }).info
      const result = Binary.search(input.store.session, info.id, (s) => s.id)
      if (result.found) {
        input.setStore("session", result.index, reconcile(info))
        break
      }
      const next = input.store.session.slice()
      next.splice(result.index, 0, info)
      const trimmed = trimSessions(next, { limit: input.store.limit, permission: input.store.permission })
      input.setStore("session", reconcile(trimmed, { key: "id" }))
      cleanupDroppedSessionCaches(input.store, input.setStore, trimmed, input.setSessionTodo)
      if (!info.parentID) input.setStore("sessionTotal", (value) => value + 1)
      break
    }
    case "session.updated": {
      const info = (event.properties as { info: Session }).info
      const result = Binary.search(input.store.session, info.id, (s) => s.id)
      if (info.time.archived) {
        if (result.found) {
          input.setStore(
            "session",
            produce((draft) => {
              draft.splice(result.index, 1)
            }),
          )
        }
        cleanupSessionCaches(input.setStore, info.id, input.setSessionTodo)
        if (info.parentID) break
        input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
        break
      }
      if (result.found) {
        input.setStore("session", result.index, reconcile(info))
        break
      }
      const next = input.store.session.slice()
      next.splice(result.index, 0, info)
      const trimmed = trimSessions(next, { limit: input.store.limit, permission: input.store.permission })
      input.setStore("session", reconcile(trimmed, { key: "id" }))
      cleanupDroppedSessionCaches(input.store, input.setStore, trimmed, input.setSessionTodo)
      break
    }
    case "session.deleted": {
      const info = (event.properties as { info: Session }).info
      const result = Binary.search(input.store.session, info.id, (s) => s.id)
      if (result.found) {
        input.setStore(
          "session",
          produce((draft) => {
            draft.splice(result.index, 1)
          }),
        )
      }
      cleanupSessionCaches(input.setStore, info.id, input.setSessionTodo)
      if (info.parentID) break
      input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
      break
    }
    case "session.diff": {
      const props = event.properties as { sessionID: string; diff: SnapshotFileDiff[] }
      input.setStore("session_diff", props.sessionID, reconcile(list(props.diff), { key: "file" }))
      break
    }
    case "todo.updated": {
      const props = event.properties as { sessionID: string; todos: Todo[] }
      input.setStore("todo", props.sessionID, reconcile(props.todos, { key: "id" }))
      input.setSessionTodo?.(props.sessionID, props.todos)
      break
    }
    case "session.status": {
      const props = event.properties as { sessionID: string; status: SessionStatus }
      input.setStore("session_status", props.sessionID, reconcile(props.status))
      break
    }
    case "message.updated": {
      const info = clean((event.properties as { info: Message }).info)
      const messages = input.store.message[info.sessionID]
      if (!messages) {
        input.setStore("message", info.sessionID, [info])
      } else {
        const result = Binary.search(messages, info.id, (m) => m.id)
        if (result.found) {
          input.setStore("message", info.sessionID, result.index, reconcile(info))
        } else {
          input.setStore(
            "message",
            info.sessionID,
            produce((draft) => {
              draft.splice(result.index, 0, info)
            }),
          )
        }
      }
      if (info.role === "assistant" && debugEnabled[info.sessionID]) {
        appendTrace(
          input.setStore,
          info.sessionID,
          entry(info.sessionID, "answer.finalized", "Answer finalized", {
            assistantMessageID: info.id,
            finish: info.finish,
            error: info.error,
          }),
        )
      }
      break
    }
    case "message.removed": {
      const props = event.properties as { sessionID: string; messageID: string }
      input.setStore(
        produce((draft) => {
          const messages = draft.message[props.sessionID]
          if (messages) {
            const result = Binary.search(messages, props.messageID, (m) => m.id)
            if (result.found) messages.splice(result.index, 1)
          }
          delete draft.part[props.messageID]
        }),
      )
      break
    }
    case "message.part.updated": {
      const part = (event.properties as { part: Part }).part
      if (!SKIP_PARTS.has(part.type)) {
        const parts = input.store.part[part.messageID]
        if (!parts) {
          input.setStore("part", part.messageID, [part])
        } else {
          const result = Binary.search(parts, part.id, (p) => p.id)
          if (result.found) {
            input.setStore("part", part.messageID, result.index, reconcile(part))
          } else {
            input.setStore(
              "part",
              part.messageID,
              produce((draft) => {
                draft.splice(result.index, 0, part)
              }),
            )
          }
        }
      }
      if (debugEnabled[part.sessionID]) {
        if (part.type === "reasoning") {
          appendTrace(
            input.setStore,
            part.sessionID,
            entry(part.sessionID, "reasoning", "Reasoning", {
              messageID: part.messageID,
              partID: part.id,
              text: part.text.slice(0, 400),
            }),
          )
        }
        if (part.type === "tool") {
          appendTrace(
            input.setStore,
            part.sessionID,
            entry(
              part.sessionID,
              `tool.${part.state.status}`,
              part.state.status === "pending"
                ? "Tool selected"
                : part.state.status === "running"
                  ? "Tool running"
                  : part.state.status === "completed"
                    ? "Tool completed"
                    : "Tool failed",
              {
                messageID: part.messageID,
                partID: part.id,
                tool: part.tool,
                callID: part.callID,
                state: part.state,
                files: Object.values(part.state.input ?? {}).filter(
                  (value) => typeof value === "string" && /[./\\]/.test(value),
                ),
              },
            ),
          )
        }
      }
      break
    }
    case "message.part.removed": {
      const props = event.properties as { messageID: string; partID: string }
      const parts = input.store.part[props.messageID]
      if (!parts) break
      const result = Binary.search(parts, props.partID, (p) => p.id)
      if (result.found) {
        input.setStore(
          produce((draft) => {
            const list = draft.part[props.messageID]
            if (!list) return
            const next = Binary.search(list, props.partID, (p) => p.id)
            if (!next.found) return
            list.splice(next.index, 1)
            if (list.length === 0) delete draft.part[props.messageID]
          }),
        )
      }
      break
    }
    case "message.part.delta": {
      const props = event.properties as { messageID: string; partID: string; field: string; delta: string }
      const parts = input.store.part[props.messageID]
      if (!parts) break
      const result = Binary.search(parts, props.partID, (p) => p.id)
      if (!result.found) break
      input.setStore(
        "part",
        props.messageID,
        produce((draft) => {
          const part = draft[result.index]
          const field = props.field as keyof typeof part
          const existing = part[field] as string | undefined
          ;(part[field] as string) = (existing ?? "") + props.delta
        }),
      )
      break
    }
    case "vcs.branch.updated": {
      const props = event.properties as { branch?: string }
      if (input.store.vcs?.branch === props.branch) break
      const next = { ...input.store.vcs, branch: props.branch }
      input.setStore("vcs", next)
      if (input.vcsCache) input.vcsCache.setStore("value", next)
      break
    }
    case "permission.asked": {
      const permission = event.properties as PermissionRequest
      const permissions = input.store.permission[permission.sessionID]
      if (!permissions) {
        input.setStore("permission", permission.sessionID, [permission])
      } else {
        const result = Binary.search(permissions, permission.id, (p) => p.id)
        if (result.found) {
          input.setStore("permission", permission.sessionID, result.index, reconcile(permission))
        } else {
          input.setStore(
            "permission",
            permission.sessionID,
            produce((draft) => {
              draft.splice(result.index, 0, permission)
            }),
          )
        }
      }
      if (debugEnabled[permission.sessionID]) {
        appendTrace(
          input.setStore,
          permission.sessionID,
          entry(permission.sessionID, "permission.asked", "Permission requested", {
            permission: permission.permission,
            patterns: permission.patterns,
            metadata: permission.metadata,
          }),
        )
      }
      break
    }
    case "permission.replied": {
      const props = event.properties as { sessionID: string; requestID: string }
      const permissions = input.store.permission[props.sessionID]
      if (!permissions) break
      const result = Binary.search(permissions, props.requestID, (p) => p.id)
      if (!result.found) break
      input.setStore(
        "permission",
        props.sessionID,
        produce((draft) => {
          draft.splice(result.index, 1)
        }),
      )
      break
    }
    case "question.asked": {
      const question = event.properties as QuestionRequest
      const questions = input.store.question[question.sessionID]
      if (!questions) {
        input.setStore("question", question.sessionID, [question])
      } else {
        const result = Binary.search(questions, question.id, (q) => q.id)
        if (result.found) {
          input.setStore("question", question.sessionID, result.index, reconcile(question))
        } else {
          input.setStore(
            "question",
            question.sessionID,
            produce((draft) => {
              draft.splice(result.index, 0, question)
            }),
          )
        }
      }
      if (debugEnabled[question.sessionID]) {
        appendTrace(
          input.setStore,
          question.sessionID,
          entry(question.sessionID, "question.asked", "Question asked", { question }),
        )
      }
      break
    }
    case "question.replied":
    case "question.rejected": {
      const props = event.properties as { sessionID: string; requestID: string }
      const questions = input.store.question[props.sessionID]
      if (!questions) break
      const result = Binary.search(questions, props.requestID, (q) => q.id)
      if (!result.found) break
      input.setStore(
        "question",
        props.sessionID,
        produce((draft) => {
          draft.splice(result.index, 1)
        }),
      )
      break
    }
    case "session.debug.updated": {
      const props = event.properties as { sessionID: string; enabled: boolean }
      input.setStore("debug_enabled", props.sessionID, props.enabled)
      break
    }
    case "session.debug.trace": {
      const props = event.properties as DebugEntry
      appendTrace(input.setStore, props.sessionID, props)
      break
    }
    case "session.error": {
      const props = event.properties as { sessionID?: string; error: unknown }
      if (!props.sessionID || !debugEnabled[props.sessionID]) break
      appendTrace(input.setStore, props.sessionID, entry(props.sessionID, "session.error", "Session error", { error: props.error }))
      break
    }
    case "lsp.updated": {
      input.loadLsp()
      break
    }
  }
}
