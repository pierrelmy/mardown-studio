export interface TextMatch {
  path: string
  line: number
  column: number
  excerpt: string
  from: number
  to: number
}
export interface SearchResults {
  matches: TextMatch[]
  scannedFiles: number
  skippedFiles: number
  limited: boolean
}
/** Literal search only: user input can never introduce regular-expression operators. */
export function findTextMatches(
  content: string,
  query: string,
  path: string,
  matchCase = false,
  limit = 300,
): TextMatch[] {
  if (!query.trim() || /[\r\n]/.test(query) || limit <= 0) return []
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu')
  const results: TextMatch[] = []
  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index].replace(/\r$/, '')
    for (const match of text.matchAll(pattern)) {
      const start = Math.max(0, match.index - 55)
      const end = Math.min(text.length, Math.max(start + 170, match.index + match[0].length))
      const prefix = start ? '…' : ''
      results.push({
        path,
        line: index + 1,
        column: match.index + 1,
        excerpt: prefix + text.slice(start, end) + (end < text.length ? '…' : ''),
        from: prefix.length + match.index - start,
        to: prefix.length + match.index - start + match[0].length,
      })
      if (results.length >= limit) return results
    }
  }
  return results
}
