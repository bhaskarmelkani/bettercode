import React from "react"
import { Text, Box } from "ink"
import { capture } from "./src/testing/render"

const node = React.createElement(
  Box,
  { flexDirection: "row" },
  React.createElement(Text, { backgroundColor: "#89b4fa", color: "#1e1e2e" }, ">"),
  React.createElement(Text, {}, "  placeholder")
)

const frame = await capture(node, { columns: 20, rows: 1 })
console.log("Text:", JSON.stringify(frame.text.split("\n")[0]))

// Also test with space
const node2 = React.createElement(
  Box,
  { flexDirection: "row" },
  React.createElement(Text, { backgroundColor: "#89b4fa" }, " "),
  React.createElement(Text, {}, "  placeholder2")
)
const frame2 = await capture(node2, { columns: 20, rows: 1 })
console.log("Space:", JSON.stringify(frame2.text.split("\n")[0]))
