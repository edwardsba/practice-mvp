import { cpSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(
  root,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs"
)
const destinationDir = join(root, "public", "pdfjs")
const destination = join(destinationDir, "pdf.worker.min.mjs")

mkdirSync(destinationDir, { recursive: true })
cpSync(source, destination)
console.log(`Copied pdf.js worker to ${destination}`)
