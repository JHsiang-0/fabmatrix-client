const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')

const originalRename = fs.rename.bind(fs)
const retryableCodes = new Set(['EPERM', 'EBUSY', 'EACCES'])
const maxAttempts = 8
const retryDelayMs = 250
const fallbackSources = new Set()

const wait = delay => new Promise(resolve => setTimeout(resolve, delay))

const isElectronStageRename = (source, target) => {
  const targetName = path.basename(target)

  return process.platform === 'win32'
    && path.basename(source) === `${targetName}.tmp`
    && /-unpacked$/i.test(targetName)
}

fs.rename = async (source, target) => {
  if (!isElectronStageRename(source, target)) {
    return originalRename(source, target)
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await originalRename(source, target)
    } catch (error) {
      if (!retryableCodes.has(error?.code)) {
        throw error
      }

      if (attempt === maxAttempts) {
        console.warn('[desktop-build] 目录锁未释放，改用完整复制继续打包。')
        await fs.rm(target, { recursive: true, force: true })
        await fs.cp(source, target, { recursive: true, force: true })
        fallbackSources.add(source)
        return
      }

      if (attempt === 1) {
        console.warn('[desktop-build] Windows 暂时占用 Electron 解包目录，正在重试...')
      }
      await wait(retryDelayMs)
    }
  }
}

process.on('exit', () => {
  for (const source of fallbackSources) {
    fsSync.rmSync(source, { recursive: true, force: true })
  }
})
