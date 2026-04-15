import { describe, test, expect } from "bun:test"
import { editPrompt, editorCmd } from "../src/utils/promptEditor"

describe("editorCmd", () => {
  test("quotes file paths for the shell", () => {
    expect(editorCmd("code --wait", "/tmp/it's here.md", "sh")).toEqual([
      "sh",
      "-lc",
      "code --wait '/tmp/it'\\''s here.md'",
    ])
  })
})

describe("editPrompt", () => {
  test("writes, toggles raw mode, reads, and cleans up", async () => {
    const seen: string[] = []
    const files = new Map<string, string>()
    const text = await editPrompt("draft", {
      file: "/tmp/prompt.md",
      editor: "vi",
      shell: "sh",
      raw: (value) => seen.push(`raw:${value}`),
      write: async (file, text) => {
        seen.push(`write:${file}:${text}`)
        files.set(file, text)
      },
      read: async (file) => {
        seen.push(`read:${file}`)
        return files.get(file) ?? ""
      },
      rm: async (file) => {
        seen.push(`rm:${file}`)
        files.delete(file)
      },
      spawn: async (cmd) => {
        seen.push(`spawn:${cmd.join(" ")}`)
        files.set("/tmp/prompt.md", "edited")
        return 0
      },
    })

    expect(text).toBe("edited")
    expect(seen).toEqual([
      "write:/tmp/prompt.md:draft",
      "raw:false",
      "spawn:sh -lc vi '/tmp/prompt.md'",
      "read:/tmp/prompt.md",
      "raw:true",
      "rm:/tmp/prompt.md",
    ])
  })
})
