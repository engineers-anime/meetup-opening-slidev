import { readFile, writeFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { findNext, readRemoteEvent, type NextEvent } from './connpass.ts'
import { eventUrl } from './event-url.ts'
import { render, type Opening } from './render.ts'

/** URLと会場提供ページの表示設定を実行時に受け取る。 */
async function promptSettings(urlArgument?: string) {
  const input = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const url = eventUrl(urlArgument ?? (await input.question('connpass のイベントURL: ')).trim())
    const answer = (await input.question('会場提供スライドを表示しますか？（Y/n）: ')).trim()
    return { url, showVenue: !/^(n|no|いいえ)$/i.test(answer) }
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
  const { url, showVenue } = await promptSettings(positionals[0])
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
  await writeFile(temp, await render(event, next, opening, showVenue))
  await rename(temp, 'slides.md')
  console.log(`slides.md を生成しました（進行表 ${event.rows.length} 件）。`)
  if (values.open) process.exitCode = spawnSync('npm', ['run', 'dev'], { stdio: 'inherit' }).status ?? 1
}

main().catch(error => {
  console.error(error.cause?.code ? `${error.message} (${error.cause.code})` : error.message)
  process.exitCode = 1
})
