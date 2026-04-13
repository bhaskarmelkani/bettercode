export type Theme = {
  base: string
  mantle: string
  crust: string
  text: string
  subtext: string
  overlay: string
  blue: string
  cyan: string
  green: string
  yellow: string
  red: string
  pink: string
  lavender: string
  mauve: string
  surface0: string
  surface1: string
  surface2: string
}

export const themes: Record<string, Theme> = {
  "catppuccin-mocha": {
    base: "#1e1e2e",
    mantle: "#181825",
    crust: "#11111b",
    text: "#cdd6f4",
    subtext: "#a6adc8",
    overlay: "#6c7086",
    blue: "#89b4fa",
    cyan: "#89dceb",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    red: "#f38ba8",
    pink: "#f5c2e7",
    lavender: "#b4befe",
    mauve: "#cba6f7",
    surface0: "#313244",
    surface1: "#45475a",
    surface2: "#585b70",
  },
  "catppuccin-latte": {
    base: "#eff1f5",
    mantle: "#e6e9ef",
    crust: "#dce0e8",
    text: "#4c4f69",
    subtext: "#5c5f77",
    overlay: "#7c7f93",
    blue: "#1e66f5",
    cyan: "#04a5e5",
    green: "#40a02b",
    yellow: "#df8e1d",
    red: "#d20f39",
    pink: "#ea76cb",
    lavender: "#7287fd",
    mauve: "#8839ef",
    surface0: "#ccd0da",
    surface1: "#bcc0cc",
    surface2: "#acb0be",
  },
  "catppuccin-macchiato": {
    base: "#24273a",
    mantle: "#1e2030",
    crust: "#181926",
    text: "#cad3f5",
    subtext: "#a5adcb",
    overlay: "#6e738d",
    blue: "#8aadf4",
    cyan: "#91d7e3",
    green: "#a6da95",
    yellow: "#eed49f",
    red: "#ed8796",
    pink: "#f5bde6",
    lavender: "#b7bdf8",
    mauve: "#c6a0f6",
    surface0: "#363a4f",
    surface1: "#494d64",
    surface2: "#5b6078",
  },
  "catppuccin-frappe": {
    base: "#303446",
    mantle: "#292c3c",
    crust: "#232634",
    text: "#c6d0f5",
    subtext: "#a5adce",
    overlay: "#737994",
    blue: "#8caaee",
    cyan: "#99d1db",
    green: "#a6d189",
    yellow: "#e5c890",
    red: "#e78284",
    pink: "#f4b8e4",
    lavender: "#babbf1",
    mauve: "#ca9ee6",
    surface0: "#414559",
    surface1: "#51576d",
    surface2: "#626880",
  },
  "gruvbox-dark": {
    base: "#282828",
    mantle: "#1d2021",
    crust: "#141617",
    text: "#ebdbb2",
    subtext: "#d5c4a1",
    overlay: "#a89984",
    blue: "#83a598",
    cyan: "#8ec07c",
    green: "#b8bb26",
    yellow: "#fabd2f",
    red: "#fb4934",
    pink: "#d3869b",
    lavender: "#d3869b",
    mauve: "#b16286",
    surface0: "#3c3836",
    surface1: "#504945",
    surface2: "#665c54",
  },
  nord: {
    base: "#2e3440",
    mantle: "#272c36",
    crust: "#222730",
    text: "#d8dee9",
    subtext: "#c0c8d8",
    overlay: "#7b88a1",
    blue: "#81a1c1",
    cyan: "#88c0d0",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    red: "#bf616a",
    pink: "#b48ead",
    lavender: "#b48ead",
    mauve: "#b48ead",
    surface0: "#3b4252",
    surface1: "#434c5e",
    surface2: "#4c566a",
  },
  dracula: {
    base: "#282a36",
    mantle: "#21222c",
    crust: "#191a21",
    text: "#f8f8f2",
    subtext: "#e2e2dc",
    overlay: "#6272a4",
    blue: "#6272a4",
    cyan: "#8be9fd",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    red: "#ff5555",
    pink: "#ff79c6",
    lavender: "#bd93f9",
    mauve: "#ff79c6",
    surface0: "#44475a",
    surface1: "#4f5166",
    surface2: "#5a5d72",
  },
}

export const DEFAULT_THEME = "catppuccin-mocha"

export function getTheme(name: string): Theme {
  return themes[name] ?? themes[DEFAULT_THEME]!
}

// Static fallback for backward compat — components should prefer useTheme()
export const theme = themes[DEFAULT_THEME]!
