import React, { createContext, useContext } from "react"
import { useAppStore } from "./store"
import { themes, DEFAULT_THEME, type Theme } from "./theme"

const ThemeCtx = createContext<Theme>(themes[DEFAULT_THEME]!)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const name = useAppStore((s) => s.currentThemeName)
  const t = themes[name] ?? themes[DEFAULT_THEME]!
  return <ThemeCtx.Provider value={t}>{children}</ThemeCtx.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeCtx)
}
