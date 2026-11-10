/** connpass のイベントURLを検証し、クエリとフラグメントを除いた形式に揃える。 */
export function eventUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?connpass\.com$/.test(url.hostname)
    || url.port || url.username || url.password || !/^\/event\/\d+\/?$/.test(url.pathname)) {
    throw new Error('connpass のイベントURLを指定してください。')
  }
  return new URL(url.pathname.replace(/\/?$/, '/'), url.origin)
}
