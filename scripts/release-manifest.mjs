import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const collectFiles = async rootPath => {
  const root = path.resolve(rootPath)
  const rootStats = await stat(root)
  if (rootStats.isFile()) return [root]
  const files = []
  const walk = async current => {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(entryPath)
      else if (entry.isFile() && !entry.name.endsWith('.map')) files.push(entryPath)
    }
  }
  await walk(root)
  return files.sort()
}

const parseArgs = argv => {
  const options = { paths: [], version: '1.0.0', candidate: 'v1.0.0-rc.1' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--path') options.paths.push(argv[++index])
    else if (argument === '--version') options.version = argv[++index]
    else if (argument === '--candidate') options.candidate = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else if (argument === '--help') options.help = true
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

export const createReleaseManifest = async ({ paths, version = '1.0.0', candidate = 'v1.0.0-rc.1' }) => {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('At least one --path is required')
  const files = []
  for (const inputPath of paths) {
    const root = path.resolve(inputPath)
    for (const filePath of await collectFiles(root)) {
      const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join('/')
      const content = await readFile(filePath)
      files.push({
        path: relativePath,
        bytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex')
      })
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  return {
    schemaVersion: 1,
    product: 'FabMatrix',
    version,
    candidate,
    generatedAt: new Date().toISOString(),
    files
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log('Usage: node scripts/release-manifest.mjs --path <artifact> [--path <artifact>] [--output <json>]')
      process.exit(0)
    }
    const manifest = await createReleaseManifest(options)
    const serialized = JSON.stringify(manifest, null, 2) + '\n'
    if (options.output) await writeFile(path.resolve(options.output), serialized, 'utf8')
    else process.stdout.write(serialized)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
