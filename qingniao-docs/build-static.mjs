import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const docsRoot = path.dirname(fileURLToPath(import.meta.url))

const result = spawnSync('bun', ['run', 'build'], {
  cwd: docsRoot,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
