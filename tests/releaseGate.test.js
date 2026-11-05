import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createReleaseManifest } from '../scripts/release-manifest.mjs'
import { assertSafe, scanReleaseArtifact, scanReleaseSource } from '../scripts/release-scan.mjs'

test('发布扫描只扫描发布白名单并拒绝正式产物中的 Mock、凭据和样例数据', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fabmatrix-release-scan-'))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'src', 'mock'), { recursive: true })
  await mkdir(path.join(root, 'node_modules'), { recursive: true })
  await writeFile(path.join(root, 'src', 'main.js'), 'export const value = 1\n')
  await writeFile(path.join(root, 'src', 'mock', 'data.js'), "const password = 'Admin123'\n")
  await writeFile(path.join(root, 'tests.fixture.js'), 'Admin123 should be ignored\n')
  const sourceResult = await scanReleaseSource(root)
  assert.equal(sourceResult.findings.length, 0)
  assertSafe(sourceResult)

  const formalArtifactRoot = path.join(root, 'formal-dist')
  await mkdir(formalArtifactRoot, { recursive: true })
  await writeFile(path.join(formalArtifactRoot, 'index.js'), 'const useMock = false\n')
  const formalArtifactResult = await scanReleaseArtifact(formalArtifactRoot)
  assertSafe(formalArtifactResult)

  const artifactRoot = path.join(root, 'dist')
  await mkdir(artifactRoot, { recursive: true })
  await writeFile(path.join(artifactRoot, 'index.js'), 'desktop-mock\n')
  const artifactResult = await scanReleaseArtifact(artifactRoot)
  assert.equal(artifactResult.findings[0].rule, 'mock-mode')
  assert.throws(() => assertSafe(artifactResult), /mock-mode/)
})

test('发布扫描规则会检测源码硬编码凭据', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fabmatrix-release-source-'))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'src', 'config.js'), "const JWT_SECRET_KEY = 'hard-coded-release-secret'\n")
  const result = await scanReleaseSource(root)
  assert.deepEqual(result.findings.map(finding => finding.rule), ['hard-coded-credential'])
})

test('发布清单按稳定路径生成 SHA-256 和候选版元数据', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fabmatrix-release-manifest-'))
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await writeFile(path.join(root, 'dist', 'index.html'), 'FabMatrix 1.0.0\n')
  const previousCwd = process.cwd()
  process.chdir(root)
  try {
    const manifest = await createReleaseManifest({ paths: ['dist'], candidate: 'v1.0.0-rc.1' })
    assert.equal(manifest.candidate, 'v1.0.0-rc.1')
    assert.deepEqual(manifest.files.map(file => file.path), ['dist/index.html'])
    assert.equal(manifest.files[0].sha256, 'f61ae83213ffff3c795ad4a2a5bdb63cbcd4fe7b806a98d9918b2deb39969120')
  } finally {
    process.chdir(previousCwd)
  }
})

test('发布门禁脚本串联既有测试、检查、构建和 dist Electron E2E', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const gateSource = await readFile(new URL('../scripts/release-gate.mjs', import.meta.url), 'utf8')
  const viteSource = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  const disabledSource = await readFile(new URL('../src/mock/disabled.js', import.meta.url), 'utf8')
  const disabledWebSocketSource = await readFile(new URL('../src/mock/disabled-websocket.js', import.meta.url), 'utf8')
  assert.match(packageJson.scripts['release:gate'], /release-gate\.mjs/)
  assert.match(packageJson.scripts['release:manifest'], /release-manifest\.mjs/)
  assert.match(packageJson.scripts['release:scan'], /release-scan\.mjs/)
  assert.match(packageJson.scripts['lint:check:oxlint'], /^oxlint \.$/)
  assert.match(packageJson.scripts['lint:check:eslint'], /^eslint \. --cache$/)
  assert.match(packageJson.scripts['release:gate'], /node scripts\/release-gate\.mjs/)
  assert.match(gateSource, /shell:\s*process\.platform === 'win32'/)
  assert.match(gateSource, /cwd:\s*projectRoot/)
  assert.match(gateSource, /(?:env:\s*process\.env|\.\.\.process\.env)/)
  assert.match(gateSource, /stdio:\s*'inherit'/)
  assert.match(viteSource, /const mockAliases = isExplicitMockMode \? \{\} : \{[\s\S]*disabled-websocket\.js[\s\S]*disabled\.js/)
  assert.match(viteSource, /farm-formal-mock-diagnostic-isolation/)
  assert.match(viteSource, /transformedCode = code\.replace\([\s\S]*desktop-mock[\s\S]*'false'/)
  assert.match(viteSource, /alias:\s*\{[\s\S]*\.\.\.mockAliases[\s\S]*'@': srcRoot/)
  assert.match(viteSource, /isExplicitMockMode = \['mock', 'desktop-mock'\]/)
  assert.match(disabledSource, /isMockEnabled = false/)
  assert.match(disabledSource, /export const mockRequest/)
  assert.match(disabledWebSocketSource, /export const createMockWebSocketStream/)
})
