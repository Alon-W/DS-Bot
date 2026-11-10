// Runs in the page. WCAG 2.2 AA audit of one element's subtree: text contrast (1.4.3)
// against the real painted background, and tap target size (2.5.8). Returns a summary.
(root => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
  const background = (el) => {
    const layers = []
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) base = over(layer, base)
    return base
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const text = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!n.textContent.trim() || seen.has(el)) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.getBoundingClientRect().width === 0) continue
    const bg = background(el)
    const fg = over(parse(cs.color), bg)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700)
    const r = ratio(fg, bg)
    text.push({ r: Math.round(r * 100) / 100, need: large ? 3 : 4.5, size, cls: (el.className || el.tagName).toString().slice(0, 28), sample: n.textContent.trim().slice(0, 24) })
  }
  const failing = text.filter(t => t.r < t.need)
  const targets = [...root.querySelectorAll('button, a, textarea, input')].map(el => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 20) } }).filter(t => t.w > 0)
  const byClass = {}
  for (const t of failing) { const k = t.cls + ' ' + t.size + 'px'; byClass[k] = byClass[k] ? Math.min(byClass[k], t.r) : t.r }
  return JSON.stringify({
    textNodes: text.length, failing: failing.length, minRatio: Math.min(...text.map(t => t.r)),
    fontSizes: [...new Set(text.map(t => t.size))].sort((a, b) => a - b),
    failingByClass: byClass,
    targetsUnder24: targets.filter(t => t.w < 24 || t.h < 24),
    targetsUnder44: targets.filter(t => t.w < 44 || t.h < 44).length + '/' + targets.length,
  })
})(document.querySelector('.bt-pc-panel'))
