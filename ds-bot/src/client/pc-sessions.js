import { createElement as h, useState } from 'react'
import { AgentBadge } from './agent-badge.js'
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

function Machine({ remote, wide, actions }) {
  const [showAll, setShowAll] = useState(false)
  const peers = remote.peers ?? []
  const rows = sessionRows(peers, remote.pending ?? {}, showAll)
  return h('section', null,
    h('div', { className: 'bt-section-title' }, wide ? `${t('PC sessions')} · ${remote.machine}` : remote.machine),
    remote.error ? h('div', { className: 'bt-hint', role: 'status' }, t('PC unreachable')) : rows.map(row => h('button', {
      key: row.name, type: 'button', className: 'bt-row', title: row.label,
      onClick: () => actions.openPcSession(remote.machine, row.name),
    }, h('span', { 'aria-hidden': true }, row.state === 'asking' ? '●' : row.state === 'busy' ? '◉' : row.state === 'failed' ? '!' : '○'),
    h(AgentBadge, { engine: `local-${({ claude: 'claude-code', codex: 'codex-cli' })[row.tool] ?? row.tool}` }),
    wide ? h('span', { className: 'bt-row-title' }, row.label) : null)),
    !remote.error && peers.length > rows.length ? h('button', { type: 'button', className: 'bt-more', onClick: () => setShowAll(true) }, t('Show all ({count})', { count: peers.length })) : null,
    !remote.error && showAll ? h('button', { type: 'button', className: 'bt-more', onClick: () => setShowAll(false) }, t('Show less')) : null)
}

export function PcSessions({ remotes, wide, actions }) {
  return (remotes ?? []).map(remote => h(Machine, { key: remote.machine, remote, wide, actions }))
}
