import { readFile, writeFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { findNext, readRemoteEvent, type NextEvent } from './connpass.ts'
import { eventUrl } from './event-url.ts'
import { render, type Opening } from './render.ts'

/** URLを標準入力から受け取り、取得後は入力を閉じる。 */
async function promptEventUrl() {
  const input = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const url = (await input.question('connpass のイベントURL: ')).trim()
    if (!url) throw new Error('イベントURLを入力してください。')
    return url
  } finally {
    input.close()
  }
}

/** 入力を処理し、生成に成功した場合だけ既存の slides.md を差し替える。 */
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { next: { type: 'string' },
      'no-next': { type: 'boolean' }, open: { type: 'boolean' } }
  })
  if (positionals.length > 1 || (values.next && values['no-next'])) {
    throw new Error('使い方: npm run opening -- [connpass URL] [--next 次回URL | --no-next]')
  }
  const url = eventUrl(positionals[0] ?? await promptEventUrl())
  const event = await readRemoteEvent(url)
  let next: NextEvent | undefined
  if (values.next) {
    const url = eventUrl(values.next)
    next = await readRemoteEvent(url)
    if (next.starts <= event.starts) throw new Error('次回URLには、今回より後に開催されるイベントを指定してください。')
  } else if (!values['no-next']) {
    try {
      next = await findNext(event)
    } catch (error) {
      console.warn(`次回の自動取得: ${error instanceof Error ? error.message : String(error)}`)
      next = { unavailable: true }
    }
  }
  if (!event.rows.length) throw new Error('タイムテーブルを取得できませんでした。')
  const temp = `.slides-${randomUUID()}.tmp`
  const opening: Opening = JSON.parse(await readFile(new URL('../opening.json', import.meta.url), 'utf8'))
  await writeFile(temp, await render(event, next, opening))
  await rename(temp, 'slides.md')
  console.log(`slides.md を生成しました（進行表 ${event.rows.length} 件）。`)
  if (values.open) process.exitCode = spawnSync('npm', ['run', 'dev'], { stdio: 'inherit' }).status ?? 1
}

main().catch(error => {
  console.error(error.cause?.code ? `${error.message} (${error.cause.code})` : error.message)
  process.exitCode = 1
})
