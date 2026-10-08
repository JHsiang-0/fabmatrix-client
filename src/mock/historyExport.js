import { HISTORY_EXPORT_TYPES } from '../utils/fileExport.js'

const encoder = new TextEncoder()
const xml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
const crc32 = bytes => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
const zip = files => {
  const parts = []
  const central = []
  let offset = 0
  for (const [name, source] of Object.entries(files)) {
    const filename = encoder.encode(name)
    const bytes = encoder.encode(source)
    const crc = crc32(bytes)
    const local = new Uint8Array(30 + filename.length)
    const header = new DataView(local.buffer)
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true)
    header.setUint32(14, crc, true)
    header.setUint32(18, bytes.length, true)
    header.setUint32(22, bytes.length, true)
    header.setUint16(26, filename.length, true)
    local.set(filename, 30)
    const directory = new Uint8Array(46 + filename.length)
    const entry = new DataView(directory.buffer)
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, bytes.length, true)
    entry.setUint32(24, bytes.length, true)
    entry.setUint16(28, filename.length, true)
    entry.setUint32(42, offset, true)
    directory.set(filename, 46)
    parts.push(local, bytes)
    central.push(directory)
    offset += local.length + bytes.length
  }
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, central.length, true)
  endView.setUint16(10, central.length, true)
  endView.setUint32(12, central.reduce((sum, part) => sum + part.length, 0), true)
  endView.setUint32(16, offset, true)
  return [...parts, ...central, end]
}

const makeExcel = records => {
  const rows = [['任务编号', '文件名', '打印机', '创建人', '结果', '结束时间'], ...records.map(row => [
    row.id, row.fileNameSnapshot || row.fileName, row.printerNameSnapshot || row.printerName,
    row.creatorUsernameSnapshot || row.creatorUsername, row.status, row.completedAt
  ])]
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 1}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
  return zip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="打印历史（Mock）" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet
  })
}

const pdfText = value => String(value || '').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&')
const makePdf = records => {
  const groups = []
  for (let start = 0; start < Math.max(records.length, 1); start += 42) groups.push(records.slice(start, start + 42))
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const pages = []
  for (const [index, group] of groups.entries()) {
    const pageId = objects.length + 1
    const streamId = pageId + 1
    pages.push(`${pageId} 0 R`)
    const lines = [`FabMatrix Print History (Mock) - ${records.length} records`, `Page ${index + 1} / ${groups.length}`, '', ...group.map(row => `#${row.id} | ${row.status} | ${row.completedAt || '-'}`)]
    const stream = `BT /F1 11 Tf 40 790 Td 16 TL ${lines.map((line, pos) => `${pos ? 'T* ' : ''}(${pdfText(line)}) Tj`).join('\n')} ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.join(' ')}] >>`
  let source = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(source.length); source += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = source.length
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return [source]
}

/** Valid small binary documents for Mock/E2E; never included in formal builds. */
export function createMockHistoryDownload(records, format) {
  const extension = format === 'PDF' ? 'pdf' : 'xlsx'
  return {
    status: 200,
    data: new Blob(format === 'PDF' ? makePdf(records) : makeExcel(records), { type: HISTORY_EXPORT_TYPES[format] }),
    headers: {
      'content-type': HISTORY_EXPORT_TYPES[format],
      'content-disposition': `attachment; filename="print-history.${extension}"; filename*=UTF-8''${encodeURIComponent(`打印历史（Mock）.${extension}`)}`
    }
  }
}
