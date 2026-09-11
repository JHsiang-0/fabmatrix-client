/** 计算分页数据缩减后仍然有效的页码；空结果仍保留第 1 页。 */
export function getLastValidPage(total, pageSize) {
  const safeTotal = Math.max(Number(total) || 0, 0)
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 1
  return Math.max(1, Math.ceil(safeTotal / safePageSize))
}

const MAX_PAGE_REQUESTS = 1000

/**
 * Read all records for a bounded page query. Requests are sequential so each
 * page is fetched once and an abnormal server total cannot create an endless
 * loop.
 */
export async function fetchAllPageRecords(fetchPage, request = {}) {
  const requestedPageSize = Number(request.pageSize)
  const pageSize = Math.min(requestedPageSize > 0 ? requestedPageSize : 100, 100)
  const firstResponse = await fetchPage({ ...request, pageNum: 1, pageSize })
  const firstPage = firstResponse?.data || {}
  const records = Array.isArray(firstPage.records) ? [...firstPage.records] : []
  const total = Number(firstPage.total)
  const pages = Number(firstPage.pages)
  const pageCount = Number.isFinite(total) && total >= 0
    ? Math.ceil(total / pageSize)
    : Number.isFinite(pages) && pages >= 0 ? Math.ceil(pages) : 1
  if (pageCount > MAX_PAGE_REQUESTS) {
    throw new RangeError(`分页结果超过 ${MAX_PAGE_REQUESTS} 页上限`)
  }

  for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
    const response = await fetchPage({ ...request, pageNum, pageSize })
    const page = response?.data || {}
    if (Array.isArray(page.records)) records.push(...page.records)
    if (!Array.isArray(page.records) || page.records.length === 0) break
  }

  return records
}

/**
 * 活动任务分页在当前页因数据缩减而越界时，只补请求一次最后有效页。
 * fetchPage 必须返回统一 API 响应，调用方可直接使用返回的 response。
 */
export async function fetchPageWithLastValidFallback(fetchPage, request) {
  const response = await fetchPage(request)
  const page = response?.data || {}
  const pageSize = Number(page.pageSize) > 0 ? Number(page.pageSize) : request.pageSize
  const lastPage = getLastValidPage(page.total, pageSize)
  if (Number(request.pageNum) <= lastPage) {
    return response
  }

  return fetchPage({ ...request, pageNum: lastPage, pageSize })
}
