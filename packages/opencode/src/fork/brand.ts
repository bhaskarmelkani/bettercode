function uniq(list: string[]) {
  return Array.from(new Set(list))
}

const legacy = "opencode"
const appSlug = process.env.OPENCODE_BRAND_SLUG || legacy
const name = process.env.OPENCODE_BRAND_NAME || (appSlug === legacy ? "OpenCode" : "BetterCode")
const cmd = process.env.OPENCODE_BRAND_COMMAND || appSlug
const dot = process.env.OPENCODE_BRAND_DOTDIR || `.${appSlug}`
const proto = process.env.OPENCODE_BRAND_PROTOCOL || appSlug

export namespace Brand {
  export const app = name
  export const bin = cmd
  export const dir = dot
  export const legacyDir = ".opencode"
  export const legacyName = "OpenCode"
  export const legacySlug = legacy
  export const protocol = proto
  export const slug = appSlug

  export function cfg(name: string) {
    if (name !== legacy && name !== appSlug) return [name]
    return uniq([appSlug, legacy])
  }

  export function dirs() {
    return uniq([dot, ".opencode"])
  }

  export function isDir(dir: string) {
    return dirs().some((item) => dir.endsWith(item))
  }
}
