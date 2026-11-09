export function parseRemotes(text) {
  return (text ?? '').split(',').flatMap(entry => {
    const match = entry.trim().match(/^([\w.-]+)=(.+)$/)
    if (!match) return []
    try {
      const url = new URL(match[2])
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return []
      return [{ machine: match[1], url: url.origin }]
    } catch {
      return []
    }
  })
}
