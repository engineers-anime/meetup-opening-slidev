/** スライド内に埋め込む文字列をHTMLとVueテンプレート向けにエスケープする。 */
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"'{}]/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;'  } as Record<string, string>)[char])

/** 全スライド共通の枠とセクション見出しを付ける。 */
export const frame = (label: string, body: string) => `<div class="frame">

<div class="eyebrow">${label}</div>

${body}

</div>`
