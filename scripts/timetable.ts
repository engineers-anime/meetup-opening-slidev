import { esc, frame } from './slide-html.ts'

/**
 * 長いセルの折り返しを見積もり、投影サイズを保ったまま掲載順にページ分割する。
 * 4列のconnpass形式では時刻と登壇者の幅を確保し、タイトルに残りの幅を使う。
 */
export function renderTimetable(columns: string[], rowsAll: string[][]) {
  const width = Math.max(columns.length, ...rowsAll.map(row => row.length))
  const fourColumns = width === 4
  const capacities = fourColumns ? [12, 5, 14, 6] : Array(width).fill(Math.max(2, Math.floor(28 / width)))
  const pages: string[][][] = [[]]
  let pageHeight = 0
  for (const row of rowsAll) {
    const lines = Math.max(1, ...row.map((value, index) => {
      const units = [...value].reduce((sum, char) => sum + (/^[\x20-\x7e]$/.test(char) ? 0.6 : 1), 0)
      return Math.ceil(units / capacities[index])
    }))
    const rowHeight = 32 * lines + 14
    if (pages.at(-1)!.length && pageHeight + rowHeight > 255) {
      pages.push([])
      pageHeight = 0
    }
    pages.at(-1)!.push(row)
    pageHeight += rowHeight
  }

  const cell = (value: string | undefined, tag: 'th' | 'td') => `<${tag}>${esc(value || '—')}</${tag}>`
  const columnWidths = fourColumns ? '<colgroup><col><col><col><col></colgroup>' : ''
  return pages.map((rows, page) => {
    const cells = (row: string[], tag: 'th' | 'td') => Array.from({ length: width }, (_, i) => cell(row[i], tag)).join('')
    const table = rows.length
      ? `<table class="timetable${fourColumns ? ' timetable-four' : ''}">${columnWidths}<thead><tr>${cells(columns, 'th')}</tr></thead><tbody>
${rows.map(row => `<tr>${cells(row, 'td')}</tr>`).join('\n')}
</tbody></table>`
      : '<p>詳しい進行はイベントページをご確認ください。</p>'
    return frame(`02 / TIMETABLE　${page + 1} / ${pages.length}`, `<h1>タイムテーブル</h1>

${table}`)
  })
}
