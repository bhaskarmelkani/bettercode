import type { Keymap } from "./schema"

export const defaults: Keymap = {
  exit: [{ context: "global", key: "ctrl+c" }],
  commandPalette: [{ context: "global", key: "ctrl+k" }],
  newSession: [{ context: "global", key: "ctrl+n" }],
  sessionList: [{ context: "global", key: "ctrl+s" }],
  close: [{ context: "dialog", key: "escape" }],
  toggleSidebar: [{ context: "session", key: "ctrl+b" }],
  toggleFocus: [{ context: "session", key: "ctrl+o" }],
  openSearch: [{ context: "session", key: "ctrl+f" }],
  retry: [{ context: "session", key: "r" }],
  toggleDiffs: [{ context: "session", key: "ctrl+g" }],
  submit: [
    { context: "chat", key: "return" },
    { context: "stream", key: "return" },
  ],
  steer: [{ context: "stream", key: "ctrl+s" }],
  clearInput: [
    { context: "chat", key: "ctrl+u" },
    { context: "stream", key: "ctrl+u" },
  ],
  stashInput: [
    { context: "chat", key: "ctrl+x" },
    { context: "stream", key: "ctrl+x" },
  ],
  unstashInput: [
    { context: "chat", key: "ctrl+y" },
    { context: "stream", key: "ctrl+y" },
  ],
  yankCycle: [
    { context: "chat", key: "meta+y" },
    { context: "stream", key: "meta+y" },
  ],
  undoInput: [
    { context: "chat", key: "ctrl+z" },
    { context: "chat", key: "ctrl+_" },
    { context: "stream", key: "ctrl+z" },
    { context: "stream", key: "ctrl+_" },
  ],
  historySearch: [
    { context: "chat", key: "ctrl+r" },
    { context: "stream", key: "ctrl+r" },
  ],
  externalEditor: [
    { context: "chat", key: "ctrl+g" },
    { context: "stream", key: "ctrl+g" },
  ],
  toggleMode: [{ context: "chat", key: "shift+tab" }],
  home: [
    { context: "chat", key: "ctrl+a" },
    { context: "stream", key: "ctrl+a" },
    { context: "search", key: "ctrl+a" },
  ],
  end: [
    { context: "chat", key: "ctrl+e" },
    { context: "stream", key: "ctrl+e" },
    { context: "search", key: "ctrl+e" },
  ],
  deleteWord: [
    { context: "chat", key: "ctrl+w" },
    { context: "stream", key: "ctrl+w" },
  ],
  killLine: [
    { context: "chat", key: "ctrl+k" },
    { context: "stream", key: "ctrl+k" },
  ],
  newline: [
    { context: "chat", key: "shift+return" },
    { context: "chat", key: "meta+return" },
    { context: "stream", key: "shift+return" },
  ],
  historyPrev: [{ context: "chat", key: "up" }],
  historyNext: [{ context: "chat", key: "down" }],
  backspace: [
    { context: "chat", key: "backspace" },
    { context: "stream", key: "backspace" },
    { context: "search", key: "backspace" },
  ],
  delete: [
    { context: "chat", key: "delete" },
    { context: "stream", key: "delete" },
    { context: "search", key: "delete" },
  ],
  moveLeft: [
    { context: "chat", key: "left" },
    { context: "stream", key: "left" },
    { context: "search", key: "left" },
  ],
  moveRight: [
    { context: "chat", key: "right" },
    { context: "stream", key: "right" },
    { context: "search", key: "right" },
  ],
  scrollLineUp: [{ context: "scroll", key: "k" }],
  scrollLineDown: [{ context: "scroll", key: "j" }],
  scrollUp: [
    { context: "scroll", key: "pageup" },
    { context: "scroll", key: "shift+up" },
    { context: "stream", key: "up" },
  ],
  scrollDown: [
    { context: "scroll", key: "pagedown" },
    { context: "scroll", key: "shift+down" },
    { context: "stream", key: "down" },
  ],
  scrollHalfUp: [{ context: "scroll", key: "ctrl+u" }],
  scrollHalfDown: [{ context: "scroll", key: "ctrl+d" }],
  scrollPageUp: [
    { context: "scroll", key: "ctrl+b" },
    { context: "scroll", key: "b" },
  ],
  scrollPageDown: [
    { context: "scroll", key: "ctrl+f" },
    { context: "scroll", key: "space" },
  ],
  scrollTop: [
    { context: "scroll", key: "g" },
    { context: "scroll", key: "ctrl+up" },
  ],
  scrollBottom: [{ context: "scroll", key: "shift+g" }],
  snapBottom: [
    { context: "scroll", key: "ctrl+down" },
    { context: "scroll", key: "q" },
  ],
  pagerBack: [],
  cursorPrev: [{ context: "message", key: "shift+up" }],
  cursorNext: [{ context: "message", key: "shift+down" }],
  cursorClear: [{ context: "message", key: "escape" }],
  messageCopy: [
    { context: "message", key: "c" },
    { context: "message", key: "ctrl+shift+c" },
  ],
  messageEdit: [{ context: "message", key: "e" }],
  searchNext: [
    { context: "search", key: "return" },
    { context: "search", key: "ctrl+n" },
  ],
  searchPrev: [{ context: "search", key: "ctrl+p" }],
  searchClose: [{ context: "search", key: "escape" }],
}
