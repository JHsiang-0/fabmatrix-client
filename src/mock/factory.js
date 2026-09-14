import { toPublicSemanticIds } from './server.js'

/**
 * Mock 响应工厂。
 * 仅模拟后端统一响应 envelope，不向业务层暴露内部状态对象。
 */

export const MOCK_SUCCESS_CODE = 200
let mockTraceSequence = 0

const createMockTraceId = () => `mock-trace-${Date.now().toString(36)}-${++mockTraceSequence}`

export const createMockSuccess = data => ({
  code: MOCK_SUCCESS_CODE,
  message: '操作成功',
  data,
  timestamp: Date.now()
})

export class MockRequestError extends Error {
  constructor(status, code, message, data = null, traceId = createMockTraceId()) {
    super(message)
    this.name = 'MockRequestError'
    this.traceId = traceId
    this.response = {
      status,
      headers: { 'X-Trace-Id': traceId },
      data: createMockSuccess(toPublicSemanticIds(data))
    }
    this.response.data.code = code
    this.response.data.message = message
    this.response.data.traceId = traceId
  }
}

export const createMockPage = (records, params = {}) => {
  const pageNum = Math.max(Number(params.pageNum) || 1, 1)
  const pageSize = Math.min(Math.max(Number(params.pageSize) || 10, 1), 100)
  const start = (pageNum - 1) * pageSize

  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    pageNum,
    pageSize,
    pages: Math.ceil(records.length / pageSize)
  }
}
