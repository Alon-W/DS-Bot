import { Fragment, createElement as h, useState } from 'react'
import { AgentBadge } from './agent-badge.js'
import { MonitorIcon } from './icons.js'
import { t } from './i18n.js'

export function sessionRows(peers, pending, showAll) {
  const rows = peers.map(peer => {
    const status = String(peer.status ?? '').toLowerCase()
    const state = pending[peer.name]?.length ? 'asking' : /fail|error/.test(status) ? 'failed' : /busy|work|running/.test(status) ? 'busy' : 'idle'
    return { name: peer.name, tool: peer.tool, label: peer.name.replace(/^.*?::/, '').replaceAll('_', ' '), state }
  })
  const priority = { asking: 0, busy: 1, failed: 2, idle: 3 }
  rows.sort((a, b) => priority[a.state] - priority[b.state])
  return showAll ? rows : rows.filter(row => row.state !== 'idle').slice(0, 12)
}

// One line on what a PC's sessions are doing, for the sidebar row under its name.
export function summaryOf(rows) {
  const asking = rows.filter(row => row.state === 'asking').length
  const busy = rows.filter(row => row.state === 'busy').length
  const parts = [asking ? t('{count} need you', { count: asking }) : '', busy ? t('{count} working', { count: busy }) : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('{count} sessions', { count: rows.length })
}

const STATE_LABEL = { asking: 'Needs you', busy: 'Working', failed: 'Failed', idle: 'Idle' }
const engineOf = tool => `local-${({ claude: 'claude-code', codex: 'codex-cli' })[tool] ?? tool}`

export function SessionRow({ row, onOpen, index = 0 }) {
  return h('button', {
    type: 'button', className: 'bt-agent-sub-row bt-pc-row', 'data-state': row.state, style: { '--i': index },
    'aria-label': `${row.label}, ${t(STATE_LABEL[row.state])}`, title: row.label, onClick: onOpen,
  },
  h('span', { className: 'bt-pc-state', 'aria-hidden': true }),
  h('span', { className: 'bt-pc-badge' }, h(AgentBadge, { engine: engineOf(row.tool) })),
  h('span', { className: 'bt-agent-sub-title' }, row.label),
  row.state === 'asking' ? h('span', { className: 'bt-agent-sub-time bt-pc-ask' }, t('Needs you')) : null)
}

// The rows a list shows, then a row to show the rest.
export function SessionList({ peers, pending, onOpen }) {
  const [showAll, setShowAll] = useState(false)
  const all = sessionRows(peers, pending, true)
  const shown = showAll ? all : sessionRows(peers, pending, false)
  return h(Fragment, null,
    shown.map((row, index) => h(SessionRow, { key: row.name, row, index: index + 1, onOpen: () => onOpen(row.name) })),
    all.length > shown.length ? h('button', { type: 'button', className: 'bt-agent-sub-row bt-pc-more', onClick: () => setShowAll(true) },
      h('span', { className: 'bt-agent-sub-title' }, t('Show all ({count})', { count: all.length }))) : null)
}

// A PC is one row like the DSH Agent's: in the full sidebar it opens its session list in
// place; in the narrow rail it opens that list as a panel.
function Machine({ remote, wide, actions }) {
  const [open, setOpen] = useState(false)
  const peers = remote.peers ?? []
  const pending = remote.pending ?? {}
  const all = sessionRows(peers, pending, true)
  const asking = all.some(row => row.state === 'asking')
  const busy = all.some(row => row.state === 'busy')
  const preview = remote.error ? t('PC unreachable') : summaryOf(all)
  return h('div', { className: 'bt-agent' },
    h('button', {
      type: 'button', className: 'bt-row', 'aria-label': [t('PC sessions'), remote.machine, preview].join(', '),
      'aria-expanded': wide ? open : undefined, title: wide ? undefined : t('PC sessions'),
      onClick: () => (wide ? setOpen(value => !value) : actions.openPcSession(remote.machine, null)),
    },
    h('span', { className: `bt-agent-ava${busy ? ' bt-run' : ''}` }, h(MonitorIcon)),
    wide ? h('span', { className: 'bt-row-body' },
      h('span', { className: 'bt-row-name' }, t('PC sessions')),
      h('span', { className: 'bt-row-preview' }, preview)) : null,
    !wide && asking ? h('span', { className: 'bt-dot bt-dot-wait', 'aria-hidden': true }) : null),
    wide ? h('div', { className: 'bt-agent-sub', 'data-open': open || undefined },
      h('div', { className: 'bt-agent-sub-in' },
        remote.error ? null : h(SessionList, { peers, pending, onOpen: name => actions.openPcSession(remote.machine, name) }))) : null)
}

export function PcSessions({ remotes, wide, actions }) {
  return (remotes ?? []).map(remote => h(Machine, { key: remote.machine, remote, wide, actions }))
}

export const PC_SESSIONS_CSS = `
.bt-pc-row .bt-pc-state{flex:none;width:7px;height:7px;border-radius:50%;background:var(--bt-line-2)}
.bt-pc-row[data-state=busy] .bt-pc-state{background:var(--bt-accent)}
.bt-pc-row[data-state=asking] .bt-pc-state{background:var(--bt-star)}
.bt-pc-row[data-state=failed] .bt-pc-state{background:var(--bt-danger)}
.bt-pc-row[data-state=idle]{color:var(--bt-ink-3)}
.bt-pc-ask{color:var(--bt-ink-2)}
.bt-pc-badge{flex:none;display:inline-flex;padding:2px;border-radius:6px;background:var(--bt-card);box-shadow:0 0 0 .5px var(--bt-line)}
/* The CLI logos are drawn for a light ground, so the tile stays light in the dark theme too. */
body[data-ds-dark-theme] .bt-pc-badge{background:var(--bt-accent)}
.bt-pc-more .bt-agent-sub-title{color:var(--bt-accent)}
.bt-pc-panel{display:flex;flex-direction:column;--bt-panel-w:min(420px,100vw);width:var(--bt-panel-w)}
@media (max-width:640px){.bt-pc-panel{left:0;width:100vw;border-left:0}}
.bt-pc-head{display:flex;align-items:center;gap:4px;min-height:52px;padding:8px 8px 8px 12px;border-bottom:.5px solid var(--bt-line)}
.bt-pc-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.bt-pc-title b{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-pc-title span{font-size:12px;color:var(--bt-ink-3)}
.bt-pc-head .bt-icon-btn{width:36px;height:36px;flex:none}
.bt-pc-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px;display:flex;flex-direction:column;gap:12px}
.bt-pc-list{flex:1;min-height:0;overflow-y:auto;padding:8px}
.bt-pc-list .bt-agent-sub-row{padding:11px 12px;font-size:14px}
.bt-pc-msg{max-width:88%;min-width:0;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.bt-pc-msg pre{overflow-x:auto;max-width:100%}
.bt-pc-text{white-space:pre-wrap}
.bt-pc-in{align-self:flex-start}
.bt-pc-out{align-self:flex-end;padding:8px 12px;border-radius:16px;background:var(--bt-user);color:var(--bt-user-ink)}
.bt-pc-earlier{align-self:center;border:0;background:none;color:var(--bt-accent);font:inherit;font-size:13px;padding:6px 10px;cursor:pointer}
.bt-pc-note{margin:10px 14px 0;padding:8px 12px;border-radius:10px;background:var(--bt-hover);font-size:13px;color:var(--bt-ink-2)}
.bt-pc-prompt{margin:0 14px 10px;padding:12px;border:.5px solid var(--bt-line-2);border-radius:12px;background:var(--bt-card);display:flex;flex-direction:column;gap:10px;font-size:13px}
.bt-pc-prompt-title{font-weight:600}
.bt-pc-choices{display:flex;flex-wrap:wrap;gap:8px}
.bt-pc-choice{min-height:36px;padding:0 14px;border-radius:999px;border:.5px solid var(--bt-line-2);background:var(--bt-main);color:var(--bt-ink);font:inherit;font-size:14px;cursor:pointer}
.bt-pc-choice:disabled{opacity:.5;cursor:default}
.bt-pc-compose{display:flex;gap:8px;align-items:flex-end;padding:10px 14px;border-top:.5px solid var(--bt-line)}
.bt-pc-input{flex:1;min-width:0;min-height:40px;max-height:160px;resize:none;border:.5px solid var(--bt-line-2);border-radius:20px;padding:9px 14px;background:var(--bt-card);color:var(--bt-ink);font:inherit;font-size:16px;line-height:1.4}
.bt-pc-input:focus-visible,.bt-pc-choice:focus-visible{outline:2px solid var(--bt-accent);outline-offset:1px}
`
