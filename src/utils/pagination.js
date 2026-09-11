/** 按后端页数聚合全部分页结果，避免看板只显示第一页设备。 */
export async function collectAllPages(fetchPage, firstPage, { maxPages = 10000 } = {}) {
  const firstData = firstPage?.data || {}
  const pageSize = Number(firstData.pageSize) > 0 ? Number(firstData.pageSize) : 100
  const total = Number(firstData.total) >= 0 ? Number(firstData.total) : 0
  const declaredPages = Number(firstData.pages)
  const pageCount = Math.min(
    maxPages,
    Math.max(
      Number.isInteger(declaredPages) && declaredPages >= 0 ? declaredPages : 0,
      Math.ceil(total / pageSize),
      firstData.records?.length ? 1 : 0
    )
  )
  const pages = [firstPage]
  for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
    pages.push(await fetchPage(pageNum, pageSize))
  }
  return pages.flatMap(page => Array.isArray(page?.data?.records) ? page.data.records : [])
}
