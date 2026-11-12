import { renderGuest } from './guest.ts'
import { existsSync } from 'node:fs'
import QRCode from 'qrcode'
import type { MeetupEvent, NextEvent } from './connpass.ts'
import { esc, frame } from './slide-html.ts'
import { findReceptionEnd, renderTimetable } from './timetable.ts'

export type Opening = {
  host: { name: string; job: string; hobby: string }
  about: string[]
  notes: string[]
}

/** connpass の公開画像を表示する。 */
function thumbnail(event?: MeetupEvent) {
  if (!event) return ''
  const source = event.image
  if (!/^https:\/\/media\.connpass\.com\//i.test(source)) return ''
  return `<img class="event-thumbnail" src="${esc(source)}" alt="${esc(event.title)}のイベント画像" />`
}

const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' })

/** 日付に日本時間の曜日を添える。 */
function eventDate(event: MeetupEvent) {
  return `${event.date}（${weekday.format(event.starts)}）`
}

/** イベント情報と主催者設定から、Slidev用のMarkdown全体を組み立てる。 */
export async function render(event: MeetupEvent, result: NextEvent | undefined, opening: Opening) {
  const next = result && 'url' in result ? result : undefined
  const divider = (title: string, label = 'オープニング', subtitle?: string) => frame(label, `<div class="cover">

<h1>${esc(title)}</h1>${subtitle ? `
<p>${esc(subtitle)}</p>` : ''}

</div>`)
  const paragraphs = (items: string[]) => items.map(item => `<p>${esc(item)}</p>`).join('\n')
  const sponsorTalk = event.rows.find(row => row.slice(1).some(cell => /(?:会場提供|スポンサー).*(?:LT|トーク)|(?:LT|トーク).*(?:会場提供|スポンサー)/i.test(cell)))
  const companyInPlace = event.place.match(/[（(]([^）)]*(?:株式会社|合同会社|有限会社)[^）)]*)[）)]/)?.[1]
  const venueName = event.sponsor || companyInPlace || event.place || '会場情報はイベントページをご確認ください'
  const hasHostImage = existsSync(new URL('../public/host.png', import.meta.url))
  const coverImage = thumbnail(event)
  const nextImage = thumbnail(next)
  const nextQr = next?.url ? await QRCode.toDataURL(next.url, { width: 360, margin: 4 }) : ''
  const guestPages = event.guests.flatMap(renderGuest)
  const sheets = [
    frame('オープニング', `<div class="cover${coverImage ? ' event-visual' : ''}">

<h1>${esc(event.title)}</h1>
<p>${esc(eventDate(event))}</p>
${coverImage}

</div>`),
    frame('主催者', `<h1>自己紹介</h1>

<div class="venue${hasHostImage ? ' host-profile' : ''}">
<div>
<h2>${esc(opening.host.name)}</h2>
<p>仕事　${esc(opening.host.job)}</p>
<p>趣味　${esc(opening.host.hobby)}</p>
</div>
${hasHostImage ? `<img src="/host.png" alt="${esc(opening.host.name)}のプロフィール画像" />` : ''}
</div>`),
    divider('会の説明'),
    frame('イベント概要', `<h1>会の説明</h1>

<div class="venue">
${paragraphs(opening.about).replace(
  /アニメから得た学び|アニメをきっかけに得た気づき|アニメや技術の話/g,
  '<strong class="about-highlight">$&</strong>'
)}
</div>`),
    divider('注意事項'),
    frame('ご参加の皆さんへ', `<h1>注意事項</h1>

<div class="venue">
<ul>${opening.notes.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
</div>`),
    ...(guestPages.length ? [divider('ゲスト紹介')] : []),
    ...guestPages.map((body, index) => frame(`ゲスト紹介　${index + 1} / ${guestPages.length}`, body)),
    divider('タイムテーブル')
  ]
  sheets.push(...renderTimetable(event.columns, event.rows.map(row =>
    row.map(cell => cell.replaceAll('会場スポンサー', '会場提供')))))
  sheets.push(
    divider('会場提供'),
    `<div class="frame">

<div class="cover venue-company">

<h1>${esc(venueName)}</h1>

</div>

</div>`,
    divider('イベントハッシュタグ'),
    frame('イベントハッシュタグ', `<div class="cover">

<h1>${esc(event.hashtag ? '#' + event.hashtag.replace(/^#/, '') : 'イベントハッシュタグ')}</h1>
<p>${event.hashtag ? 'Xで感想をポストしてください！' : 'ハッシュタグはイベントページをご確認ください。'}</p>

</div>`),
    frame('トーク', `<div class="cover">

<h1>トークスタート！</h1>
${sponsorTalk ? `<p>${esc(sponsorTalk.slice(1).filter(Boolean).join('　').replaceAll('会場スポンサー', '会場提供'))}</p>` : ''}

</div>`),
    divider('トーク終了！', 'クロージング'),
    divider('宣伝', 'クロージング')
  )
  const notice = result && 'unavailable' in result
    ? '<h2>最新情報は connpass でご確認ください</h2>'
    : '<h2>公開され次第お知らせします</h2>'
  sheets.push(frame('クロージング', `<h1>次回予告</h1>

<div class="${nextQr ? 'event-visual next-event-visual' : 'venue'}">
${next?.title ? `<h2>${esc(next.title)}</h2><p>${esc(eventDate(next))}</p>` : notice}
${nextQr ? `<div class="next-event-media${nextImage ? ' has-thumbnail' : ''}">
${nextImage}
<div class="event-qr"><img src="${esc(nextQr)}" alt="次回イベントのQRコード" /><span>イベント詳細</span></div>
</div>` : ''}
</div>`))
  const receptionEnd = findReceptionEnd(event.rows)
  sheets.push(divider('懇親会スタート！', 'クロージング', receptionEnd ? `${receptionEnd} 終了` : undefined))
  return `---
theme: default
layout: default
colorSchema: light
title: ${JSON.stringify(event.title)}
---

${sheets.join('\n\n---\nlayout: default\n---\n\n')}
`
}
