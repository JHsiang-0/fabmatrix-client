import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertSafe, scanReleaseArtifact, scanReleaseSource } from './release-scan.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const run = (command, args) => new Promise((resolve, reject) => {
  console.log(`\n[RELEASE GATE] ${command} ${args.join(' ')}`)
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit'
  })
  child.once('error', reject)
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${command} ${args.join(' ')}`)))
})

const hasFlag = flag => process.argv.slice(2).includes(flag)

try {
  if (!hasFlag('--allow-dirty')) {
    console.log('[RELEASE GATE] Workspace cleanliness is enforced by the backend gate; use --allow-dirty only for local diagnostics.')
  }
  const commands = [
    ['run', ['test']],
    ['run', ['lint:check']],
    ['run', ['build']],
    ['run', ['build:mock']],
    ['run', ['build:desktop']],
    ['run', ['build:desktop:mock']],
    ['run', ['test:electron:dist']]
  ]
  for (const [command, args] of commands) await run(npmCommand, [command, ...args])

  assertSafe(await scanReleaseSource(projectRoot))
  assertSafe(await scanReleaseArtifact(path.join(projectRoot, 'dist')))
  console.log('\n[RELEASE GATE] PASS: tests, lint, formal/mock/desktop builds, Electron dist E2E and release scans')
  console.log('[RELEASE GATE] Manifest is opt-in: npm run release:manifest -- --path dist --output <outside-or-ignored-path>')
} catch (error) {
  console.error(`\n[RELEASE GATE] FAIL: ${error.message}`)
  process.exitCode = 1
}
