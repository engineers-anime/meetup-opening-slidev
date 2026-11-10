import { load } from 'cheerio'
import { eventUrl } from './event-url.ts'

const heading = 'h1,h2,h3,h4,h5,h6'
const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

/** 公開ページのHTMLからイベント情報を読み取る。指定URLとイベントIDが異なる場合は失敗する。 */
export function readEvent(html: string, url: URL) {
  const $ = load(html)
  const meta = (name: string) => $('meta[property="og:' + name + '"]').attr('content') ?? ''
  const match = meta('title').match(/^(.*?)\s*\((\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})[^)]*\)$/)
  if (!match) throw new Error('connpass のイベント情報を読み取れません。ブラウザーで保存したHTMLを --html で指定できます。')
  const canonical = meta('url') ? eventUrl(meta('url')) : url
  if (canonical.pathname !== url.pathname) throw new Error('HTMLとURLのイベントIDが一致しません。')
  const [, title, date, time] = match
  const starts = Date.parse(date.split('/').map((part, i) => i ? part.padStart(2, '0') : part).join('-')
    + 'T' + time.padStart(5, '0') + ':00+09:00')
  // connpass can reuse editor_area for both the attendee note and the public description.
  const descriptions = $('#editor_area, .editor_area').toArray()
    .map(node => readDescription($(node).html() ?? ''))
  const description = descriptions.find(item => item.rows.length > 0)
    ?? descriptions[0] ?? readDescription('')
  return {
    title, date, time, starts, url: canonical.href, image: meta('image'),
    place: clean($('.event_place_area .place_name').first().text()),
    address: clean($('.event_place_area .adr').first().text()),
    hashtag: clean($('a[href*="twitter.com/search"], a[href*="x.com/search"]').first().text()),
    ...description
  }
}

/** イベント本文のHTMLから会場案内と進行表を抽出する。時刻がある先頭行以降を掲載順で保持する。 */
export function readDescription(html: string) {
  const $ = load(html)
  const section = (pattern: RegExp) => $(heading).filter((_, node) =>
    pattern.test(clean($(node).text()))).first().nextUntil(heading)
  const timetable = section(/タイムテーブル|スケジュール|進行表/)
  const schedule = timetable.filter('table').add(timetable.find('table')).first()
  const rows = schedule.find('tr').toArray().map(row =>
    $(row).children('th,td').toArray().map(cell => clean($(cell).text())))
  const firstSlot = rows.findIndex(row => /\d{1,2}[:：]\d{2}/.test(row[0] ?? ''))
  const hasHeader = firstSlot > 0 && /時[間刻]|開始|time/i.test(rows[firstSlot - 1][0])
  const access = section(/会場へのアクセス|会場案内|^会場$/)
  return {
    sponsor: clean(section(/^会場スポンサー$|^会場提供$/).filter('p').first().text()),
    access: access.filter('p').toArray().map(node => clean($(node).text())).filter(Boolean).slice(0, 2),
    columns: hasHeader ? rows[firstSlot - 1] : ['時間', '内容', 'タイトル', '発表者'],
    rows: firstSlot < 0 ? [] : rows.slice(firstSlot).filter(row => row.some(Boolean))
  }
}
