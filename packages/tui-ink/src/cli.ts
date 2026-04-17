#!/usr/bin/env bun
import { main } from "./index.tsx"

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
