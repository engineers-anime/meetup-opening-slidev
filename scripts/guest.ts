import type { MeetupEvent } from './connpass.ts'
import { esc } from './slide-html.ts'

/** 紹介文を失わず、文や段落の区切りを優先してページに分ける。 */
function splitBiography(paragraphs: string[], pageLength: number) {
  const characters = [...paragraphs.join('\n')]
  const pages: string[] = []
  let start = 0
  while (characters.length - start > pageLength) {
    const window = characters.slice(start, start + pageLength)
    const boundary = window.findLastIndex(character => /[。！？\n]/.test(character))
    const length = boundary >= pageLength * 0.75 ? boundary + 1 : pageLength
    pages.push(window.slice(0, length).join(''))
    start += length
  }
  pages.push(characters.slice(start).join(''))
  return pages
}

/** アイコンの有無に合わせて紹介文を分け、ゲスト名とXのIDを各ページに添える。 */
export function renderGuest(guest: MeetupEvent['guests'][number]) {
  const pages = splitBiography(guest.bio, guest.image ? 112 : 160)
  return pages.map(bio => `<div class="venue guest-profile${guest.image ? ' host-profile' : ''}">
<div>
<h1>${esc(guest.name)}</h1>
${guest.xHandle ? `<p>X：${esc(guest.xHandle)}</p>` : ''}
${bio ? `<p class="guest-bio">${esc(bio)}</p>` : ''}
</div>
${guest.image ? `<img src="${esc(guest.image)}" alt="${esc(guest.name)}のプロフィール画像" />` : ''}
</div>`)
}
