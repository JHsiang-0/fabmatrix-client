export const UPLOAD_QUEUE_CONCURRENCY = 3

export function chunkItems(items, chunkSize) {
  const chunks = []
  const size = Math.max(1, Number(chunkSize) || 1)
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function chunkItemsByBytes(items, maxBytes, getSize = item => item?.size) {
  const chunks = []
  const limit = Math.max(1, Number(maxBytes) || 1)
  let currentChunk = []
  let currentBytes = 0

  for (const item of Array.isArray(items) ? items : []) {
    const itemBytes = Math.max(0, Number(getSize(item)) || 0)
    if (currentChunk.length && currentBytes + itemBytes > limit) {
      chunks.push(currentChunk)
      currentChunk = []
      currentBytes = 0
    }
    currentChunk.push(item)
    currentBytes += itemBytes
  }

  if (currentChunk.length) chunks.push(currentChunk)
  return chunks
}

function createAbortError() {
  const error = new Error('上传已取消')
  error.name = 'AbortError'
  return error
}

export async function runUploadQueue(items, worker, options = {}) {
  const queue = Array.isArray(items) ? items : []
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || UPLOAD_QUEUE_CONCURRENCY, queue.length || 1))
  const signal = options.signal
  const results = Array.from({ length: queue.length })
  let nextIndex = 0

  const takeNext = () => {
    if (signal?.aborted) throw createAbortError()
    const index = nextIndex
    nextIndex += 1
    return index < queue.length ? index : -1
  }

  const consume = async () => {
    while (true) {
      const index = takeNext()
      if (index < 0) return
      try {
        results[index] = { status: 'fulfilled', value: await worker(queue[index], index) }
      } catch (error) {
        if (signal?.aborted) throw error
        results[index] = { status: 'rejected', reason: error }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, consume))
  return results
}
