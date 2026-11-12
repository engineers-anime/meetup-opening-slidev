import { load } from 'cheerio'
import { readDescription, readEvent } from './event-html.ts'
import { eventUrl } from './event-url.ts'

export type MeetupEvent = ReturnType<typeof readEvent> & {
  groupId?: number
}

type ApiEvent = {
  title: string
  started_at: string
  url: string
  description?: string
  image_url?: string
  place?: string
  hash_tag?: string
  group?: { id: number }
  open_status: string
}

export type NextEvent = MeetupEvent | { unavailable: true }

async function fetchHtml(url: URL | string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`connpass の取得に失敗しました (HTTP ${response.status})。`)
  return response.text()
}

const apiKey = process.env.CONNPASS_API_KEY
let lastApiRequest = 0

/** APIの呼び出し間隔を空けてからイベント一覧を取得する。 */
async function apiEvents(params: Record<string, string>): Promise<{ events: ApiEvent[]; results_available: number }> {
  const delay = Math.max(0, 1100 - (Date.now() - lastApiRequest))
  await new Promise(resolve => setTimeout(resolve, delay))
  lastApiRequest = Date.now()
  const response = await fetch('https://connpass.com/api/v2/events/?' + new URLSearchParams(params), {
    headers: {  'X-API-Key': apiKey ?? '' },
    redirect: 'error',
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) throw new Error(`connpass API の取得に失敗しました (HTTP ${response.status})。`)
  return response.json()
}

function fromApi(data: ApiEvent): MeetupEvent {
  const starts = Date.parse(data.started_at)
  if (!data.title || !Number.isFinite(starts)) throw new Error('connpass API のイベント情報が不足しています。')
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(starts)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
  return {
    title: data.title, starts, date: [part('year'), part('month'), part('day')].join('/'),
    url: eventUrl(data.url).href,
    image: data.image_url ?? '', place: data.place ?? '', groupId: data.group?.id, hashtag: data.hash_tag ?? '',
    ...readDescription(data.description ?? '')
  }
}

/** APIキーがあれば公式APIを使い、なければ公開ページのHTMLを読む。 */
export async function readRemoteEvent(url: URL) {
  if (!apiKey) return readEvent(await fetchHtml(url), url)
  const { events } = await apiEvents({ event_id: url.pathname.split('/')[2] })
  if (!events.length) throw new Error('connpass API に指定のイベントが見つかりません。')
  return fromApi(events[0])
}

/** 同じグループから今回より後に始まる最も近い公開イベントを探す。 */
export async function findNext(current: MeetupEvent): Promise<NextEvent | undefined> {
  if (apiKey && current.groupId) {
    let start = 1
    let next
    while (true) {
      const { events, results_available: total } = await apiEvents({
        group_id: String(current.groupId), order: '2', count: '100', start: String(start)
      })
      for (const data of events) {
        const starts = Date.parse(data.started_at)
        if (starts > current.starts && data.open_status === 'open' && (!next || starts < next.starts)) {
          next = fromApi(data)
        }
      }
      start += events.length
      if (!events.length || start > total || events.some(data => Date.parse(data.started_at) <= current.starts)) {
        return next
      }
    }
  }
  const group = new URL(current.url).origin
  if (group === 'https://connpass.com') return { unavailable: true }
  const $ = load(await fetchHtml(group))
  if (!$('.group_event_inner, .upcoming_events_list').length) {
    throw new Error('グループの公開イベント一覧を取得できませんでした。')
  }
  const links = new Set<string>()
  $('.upcoming_events_list a[href]').each((_, link) => {
    const url = new URL($(link).attr('href') ?? '', group)
    if (url.origin === group && /^\/event\/\d+\/$/.test(url.pathname)) links.add(url.href)
  })
  links.delete(current.url)
  const events = []
  for (const link of links) {
    const url = eventUrl(link)
    events.push(readEvent(await fetchHtml(url), url))
  }
  return events.filter(event => event.starts > current.starts)
    .sort((a, b) => a.starts - b.starts)[0]
}
