# Accessibility guideline

The reference for screens added in this fork, starting with PC sessions. It follows
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, plus a few readability rules for
phones that AA leaves open.

## Rules

| Area | Rule | Source |
|---|---|---|
| Text contrast | At least **4.5:1** against the colour actually behind it; **3:1** for text 24px and up, or 18.66px bold and up. | WCAG 1.4.3 |
| Controls and focus | Borders, icons and focus rings that show state: at least **3:1**. | WCAG 1.4.11 |
| Tap targets | At least **24×24px**, and **44×44px** for a screen's main actions. Links inside running text are exempt. | WCAG 2.5.8; Apple and Android guidance |
| Body text size | **16px** on phones, **15px** on wider screens, line height about **1.55**. Nothing a person must read below **12px**. | Readability |
| Text inputs | **16px** or more, so phones do not zoom in when typing. | Mobile browsers |
| Primary text | Messages and content use the full text colour (`--bt-ink`). Greyed tones (`--bt-ink-2`, `--bt-ink-3`) are for labels and metadata only, and must still meet 4.5:1. | Readability |
| Focus | Every control shows a visible focus ring (`:focus-visible`). | WCAG 2.4.7 |
| Names | Icon-only buttons have an `aria-label`; state is said in words, not colour alone. | WCAG 4.1.2, 1.4.1 |
| Reflow | No sideways scrolling at 320px wide, except code blocks and tables in their own scroll box. | WCAG 1.4.10 |
| Motion | Animations respect `prefers-reduced-motion`. | WCAG 2.3.3 |

Logos and decorative images are exempt from the contrast rule.

## Checking

`ds-bot/dev/a11y-audit.js` measures a rendered screen against the contrast and target
rules. Paste it into the browser console on the screen to check (it audits
`.bt-pc-panel`; change the selector at the bottom for another screen). It reports the
lowest contrast ratio, failing text by class and size, and targets under 24px.

Check both themes and a phone width (412px) before merging a screen.
