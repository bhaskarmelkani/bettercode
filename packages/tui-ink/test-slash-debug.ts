import React from "react"
import { Box, Text } from "ink"
import { capture } from "./src/testing/render"

// Test: absolute without negative margin
const test1 = React.createElement(Box, { position: "relative" as any, flexDirection: "column" as any },
  React.createElement(Text, null, "flow line"),
  React.createElement(Box, { position: "absolute" as any, flexDirection: "column" as any, width: 40, top: 0 },
    React.createElement(Text, null, "overlay"),
  ),
)
const f1 = await capture(test1, { columns: 80, rows: 8 })
console.log("absolute with top=0:", JSON.stringify(f1.text))

// Test: negative marginTop with position=relative (not absolute)
const test2 = React.createElement(Box, { flexDirection: "column" as any },
  React.createElement(Text, null, " "),
  React.createElement(Text, null, " "),
  React.createElement(Box, { flexDirection: "column" as any, marginTop: -2 },
    React.createElement(Text, null, "shifted up"),
    React.createElement(Text, null, "shifted up 2"),
  ),
)
const f2 = await capture(test2, { columns: 80, rows: 8 })
console.log("relative with negative marginTop:", JSON.stringify(f2.text))
