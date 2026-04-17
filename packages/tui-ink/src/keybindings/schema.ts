export const CONTEXTS = [
  "global",
  "session",
  "chat",
  "stream",
  "scroll",
  "search",
  "message",
  "dialog",
] as const

export type Context = (typeof CONTEXTS)[number]

export const ACTIONS = [
  "exit",
  "commandPalette",
  "newSession",
  "sessionList",
  "close",
  "toggleSidebar",
  "toggleFocus",
  "openSearch",
  "retry",
  "toggleDiffs",
  "toggleThinking",
  "submit",
  "steer",
  "clearInput",
  "stashInput",
  "unstashInput",
  "yankCycle",
  "undoInput",
  "historySearch",
  "externalEditor",
  "toggleMode",
  "home",
  "end",
  "deleteWord",
  "killLine",
  "newline",
  "historyPrev",
  "historyNext",
  "backspace",
  "delete",
  "moveLeft",
  "moveRight",
  "scrollLineUp",
  "scrollLineDown",
  "scrollUp",
  "scrollDown",
  "scrollHalfUp",
  "scrollHalfDown",
  "scrollPageUp",
  "scrollPageDown",
  "scrollTop",
  "scrollBottom",
  "snapBottom",
  "pagerBack",
  "cursorPrev",
  "cursorNext",
  "cursorClear",
  "messageCopy",
  "messageEdit",
  "searchNext",
  "searchPrev",
  "searchClose",
] as const

export type Action = (typeof ACTIONS)[number]

export type Binding = {
  key: string
  context: Context
}

export type Keymap = Record<Action, Binding[]>

export type BindingFile = Partial<Record<Action, Binding[]>>
