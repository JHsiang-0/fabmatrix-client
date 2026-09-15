const normalizedText = value => String(value ?? '').trim()

const sameSegment = (left, right) => (
  normalizedText(left.status).toUpperCase() === normalizedText(right.status).toUpperCase()
  && normalizedText(left.rawState).toLowerCase() === normalizedText(right.rawState).toLowerCase()
  && normalizedText(left.filename) === normalizedText(right.filename)
  && normalizedText(left.systemMessage) === normalizedText(right.systemMessage)
)

const numericProgress = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * 将后端旧数据中连续、同状态且同文件的高频采样合并为可读状态段。
 * 输入保持接口的倒序顺序（最新在前），输出可直接用于状态历史表格。
 */
export function compactStatusHistory(records = []) {
  return records.reduce((segments, record) => {
    const previous = segments.at(-1)
    if (!previous || !sameSegment(previous, record)) {
      const progress = numericProgress(record.progress)
      segments.push({
        ...record,
        historyRowKey: `history-${record.id ?? segments.length}`,
        sampleCount: 1,
        latestRecordedAt: record.recordedAt,
        earliestRecordedAt: record.recordedAt,
        latestProgress: progress,
        earliestProgress: progress
      })
      return segments
    }

    previous.sampleCount += 1
    previous.historyRowKey = `${previous.historyRowKey}-${record.id ?? previous.sampleCount}`
    previous.earliestRecordedAt = record.recordedAt
    previous.earliestProgress = numericProgress(record.progress)
    return segments
  }, [])
}
