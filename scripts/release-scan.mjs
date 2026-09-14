import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.txt', '.vue', '.xml', '.yaml', '.yml'
])
const SOURCE_DIRECTORIES = new Set(['electron', 'public', 'src'])
const SOURCE_FILES = new Set(['index.html', 'package-lock.json', 'package.json', 'vite.config.js'])
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git', '.kiro', 'node_modules', 'release', 'release-mock', 'release-smoke', 'target', 'test-results', 'tests'
])

export const ARTIFACT_RULES = [
  { id: 'mock-mode', pattern: /desktop-mock|VITE_USE_MOCK\s*[:=]\s*["']?true|farmMode\s*[:=]\s*["']mock|FARM_ELECTRON_E2E|__FARM_(?:RESET|MOCK)/i },
  { id: 'development-credential', pattern: /Admin123|admin123|JWT_SECRET_KEY|ADMIN_SECRET_KEY|MYSQL_PASSWORD|REDIS_PASSWORD|RUSTFS_SECRET_KEY/i },
  { id: 'environment-file', pattern: /(?:^|[\\/])\.env(?:\.|$)|VITE_(?:API_TARGET|WS_TARGET)\s*[:=]/i },
  { id: 'sample-data', pattern: /gearbox\.gcode|Printer_C0DA|createTc008HistoryJobs|Mock 调试账号/i }
]

export const SOURCE_RULES = [
  { id: 'hard-coded-credential', pattern: /(?:JWT_SECRET_KEY|ADMIN_SECRET_KEY|MYSQL_PASSWORD|REDIS_PASSWORD|RUSTFS_SECRET_KEY)\s*[:=]\s*["'](?!\$\{|<|>)[^"']{8,}["']/i },
  { id: 'sample-credential', pattern: /(?:password|token|secret)\s*[:=]\s*["'](?:Admin123|admin123|password123|test123)["']/i },
  { id: 'environment-file-content', pattern: /(?:VITE_API_TARGET|VITE_WS_TARGET)\s*[:=]\s*["']https?:\/\//i }
]

const isTextFile = filePath => TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())

const collectFiles = async (rootPath, { sourceMode = false } = {}) => {
  const root = path.resolve(rootPath)
  const rootStats = await stat(root)
  if (rootStats.isFile()) return isTextFile(root) ? [root] : []

  const files = []
  const walk = async current => {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue
        const relativeDirectory = path.relative(root, entryPath).split(path.sep).join('/')
        if (sourceMode && (relativeDirectory === 'src/mock' || relativeDirectory.startsWith('src/mock/'))) continue
        if (sourceMode && current === root && !SOURCE_DIRECTORIES.has(entry.name)) continue
        await walk(entryPath)
        continue
      }
      if (!entry.isFile() || !isTextFile(entryPath) || entry.name.endsWith('.map')) continue
      if (sourceMode && current === root && !SOURCE_FILES.has(entry.name)) continue
      files.push(entryPath)
    }
  }
  await walk(root)
  return files.sort()
}

const scanFiles = async (files, rules, rootPath) => {
  const findings = []
  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    for (const rule of rules) {
      const match = rule.pattern.exec(content)
      if (!match) continue
      const line = content.slice(0, match.index).split(/\r?\n/).length
      findings.push({
        file: path.relative(rootPath, filePath).split(path.sep).join('/'),
        line,
        rule: rule.id
      })
    }
  }
  return findings
}

export const scanReleaseSource = async rootPath => {
  const root = path.resolve(rootPath)
  const files = await collectFiles(root, { sourceMode: true })
  return {
    mode: 'source',
    root,
    files: files.map(filePath => path.relative(root, filePath).split(path.sep).join('/')),
    findings: await scanFiles(files, SOURCE_RULES, root)
  }
}

export const scanReleaseArtifact = async artifactPath => {
  const root = path.resolve(artifactPath)
  const files = await collectFiles(root)
  return {
    mode: 'artifact',
    root,
    files: files.map(filePath => path.relative(root, filePath).split(path.sep).join('/')),
    findings: await scanFiles(files, ARTIFACT_RULES, root)
  }
}

export const assertSafe = result => {
  if (result.findings.length === 0) return result
  const details = result.findings.map(finding => `${finding.file}:${finding.line} [${finding.rule}]`).join(', ')
  throw new Error(`Release safety scan failed (${result.mode}): ${details}`)
}

const parseArgs = argv => {
  const options = { mode: '', path: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--mode') options.mode = argv[++index]
    else if (argument === '--path') options.path = argv[++index]
    else if (argument === '--help') options.help = true
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log('Usage: node scripts/release-scan.mjs --mode source|artifact --path <directory>')
      process.exit(0)
    }
    if (!['source', 'artifact'].includes(options.mode) || !options.path) throw new Error('Both --mode and --path are required')
    const result = options.mode === 'source'
      ? await scanReleaseSource(options.path)
      : await scanReleaseArtifact(options.path)
    assertSafe(result)
    console.log(JSON.stringify({ ...result, status: 'PASS' }, null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
