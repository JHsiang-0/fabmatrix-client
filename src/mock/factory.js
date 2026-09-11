import { toPublicSemanticIds } from './server.js'

/**
 * Mock 响应工厂。
 * 仅模拟后端统一响应 envelope，不向业务层暴露内部状态对象。
 */

export const MOCK_SUCCESS_CODE = 200

export const createMockSuccess = data => ({
  code: MOCK_SUCCESS_CODE,
  message: '操作成功',
  data,
  timestamp: Date.now()
})

export class MockRequestError extends Error {
  constructor(status, code, message, data = null) {
    super(message)
    this.name = 'MockRequestError'
    this.response = {
      status,
      data: createMockSuccess(toPublicSemanticIds(data))
    }
    this.response.data.code = code
    this.response.data.message = message
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
