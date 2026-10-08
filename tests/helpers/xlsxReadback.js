import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'

const unescapeXml = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const attribute = (source, name) => source.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

/** Read OOXML from the downloaded ZIP, rather than searching opaque archive bytes. */
export function readXlsx(bytes) {
  const data = Buffer.from(bytes)
  let end = data.length - 22
  while (end >= Math.max(0, data.length - 65557) && data.readUInt32LE(end) !== 0x06054b50) end--
  assert.ok(end >= 0, 'ZIP central directory must exist')
  const files = new Map()
  const count = data.readUInt16LE(end + 10)
  let offset = data.readUInt32LE(end + 16)
  for (let index = 0; index < count; index++) {
    assert.equal(data.readUInt32LE(offset), 0x02014b50)
    const method = data.readUInt16LE(offset + 10)
    const compressedSize = data.readUInt32LE(offset + 20)
    const nameSize = data.readUInt16LE(offset + 28)
    const extraSize = data.readUInt16LE(offset + 30)
    const commentSize = data.readUInt16LE(offset + 32)
    const name = data.subarray(offset + 46, offset + 46 + nameSize).toString('utf8')
    const local = data.readUInt32LE(offset + 42)
    assert.equal(data.readUInt32LE(local), 0x04034b50)
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28)
    const compressed = data.subarray(start, start + compressedSize)
    assert.ok(method === 0 || method === 8, 'Stored or deflated ZIP is required')
    const content = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 })
    files.set(name, content.toString('utf8'))
    offset += 46 + nameSize + extraSize + commentSize
  }
  const workbook = files.get('xl/workbook.xml')
  assert.ok(workbook, 'Workbook must be present')
  const relationships = new Map([...files.get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*\/>/g)]
    .map(match => [attribute(match[0], 'Id'), attribute(match[0], 'Target')]))
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*\/>/g)].map(match => {
    const target = relationships.get(attribute(match[0], 'r:id'))
    const source = files.get(`xl/${target.replace(/^\/?xl\//, '')}`)
    assert.ok(source, 'Sheet XML must exist')
    const rows = [...source.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(cell => {
      if (attribute(cell[1], 't') === 'inlineStr') return unescapeXml([...cell[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(text => text[1]).join(''))
      const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]
      return value === undefined ? '' : Number(value)
    }))
    return { name: unescapeXml(attribute(match[0], 'name')), rows }
  })
  return { activeTab: Number(attribute(workbook.match(/<workbookView\b[^>]*\/>/)?.[0] || '', 'activeTab') || 0), sheets }
}
