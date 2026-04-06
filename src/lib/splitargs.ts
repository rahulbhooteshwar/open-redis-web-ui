'use client'

/**
 * splitargs.ts
 *
 * Tokenizes a Redis CLI input string respecting single/double quotes
 * and backslash escape sequences. Inline replacement for
 * @qii404/redis-splitargs.
 *
 * Examples:
 *   splitargs('SET foo bar')          => ['SET', 'foo', 'bar']
 *   splitargs('SET foo "bar baz"')    => ['SET', 'foo', 'bar baz']
 *   splitargs("SET foo 'bar baz'")   => ['SET', 'foo', 'bar baz']
 *   splitargs('SET key "val\\"q"')   => ['SET', 'key', 'val"q']
 */
export function splitargs(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(input[i])) i++
    if (i >= len) break

    let token = ''
    const start = i

    while (i < len && !/\s/.test(input[i])) {
      const ch = input[i]

      if (ch === '"' || ch === "'") {
        const quote = ch
        i++ // skip opening quote

        while (i < len) {
          const c = input[i]
          if (c === '\\' && i + 1 < len) {
            i++ // skip backslash
            const escaped = input[i]
            switch (escaped) {
              case 'n':
                token += '\n'
                break
              case 'r':
                token += '\r'
                break
              case 't':
                token += '\t'
                break
              default:
                token += escaped
            }
            i++
          } else if (c === quote) {
            i++ // skip closing quote
            break
          } else {
            token += c
            i++
          }
        }
      } else if (ch === '\\' && i + 1 < len) {
        i++ // skip backslash
        token += input[i]
        i++
      } else {
        token += ch
        i++
      }
    }

    // Only add non-empty tokens (avoids empty string from leading whitespace edge cases)
    if (token.length > 0 || i > start) {
      tokens.push(token)
    }
  }

  return tokens
}

export default splitargs
