import { tmpdir } from "node:os"
import { join } from "node:path"
import { readFile, unlink, writeFile } from "node:fs/promises"
import { spawn as fork } from "node:child_process"

type Deps = {
  editor?: string
  shell?: string
  file?: string
  raw?: (value: boolean) => void
  write?: (file: string, text: string) => Promise<unknown>
  read?: (file: string) => Promise<string>
  rm?: (file: string) => Promise<unknown>
  spawn?: (cmd: string[]) => Promise<number>
}

export function editorCmd(editor: string, file: string, shell: string) {
  return [shell, "-lc", `${editor} '${file.replaceAll("'", `'\\''`)}'`]
}

export async function editPrompt(text: string, deps: Deps = {}) {
  const file = deps.file ?? join(tmpdir(), `bettercode-${process.pid}-${Date.now()}.md`)
  const raw = deps.raw ?? ((value: boolean) => process.stdin.setRawMode?.(value))
  const write = deps.write ?? ((file: string, text: string) => writeFile(file, text, "utf8"))
  const read = deps.read ?? ((file: string) => readFile(file, "utf8"))
  const rm = deps.rm ?? unlink
  const shell = deps.shell ?? process.env.SHELL ?? "sh"
  const editor = deps.editor ?? process.env.EDITOR ?? process.env.VISUAL ?? "vi"
  const spawn =
    deps.spawn ??
    ((cmd: string[]) =>
      new Promise<number>((resolve, reject) => {
        const child = fork(cmd[0]!, cmd.slice(1), {
          stdio: "inherit",
        })
        child.on("error", reject)
        child.on("exit", (code) => resolve(code ?? 1))
      }))

  await write(file, text)
  raw(false)
  try {
    const code = await spawn(editorCmd(editor, file, shell))
    if (code !== 0) throw new Error(`editor exited with code ${code}`)
    return await read(file)
  } finally {
    raw(true)
    await rm(file).catch(() => {})
  }
}
