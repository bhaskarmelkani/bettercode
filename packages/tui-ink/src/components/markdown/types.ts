export type Token = {
  type: string
  raw?: string
  text?: string
  lang?: string
  ordered?: boolean
  items?: Token[]
  tokens?: Token[]
  href?: string
  title?: string
  checked?: boolean
  depth?: number
}
