import { createElement as h, useEffect, useState } from 'react'
import { createPcRemote } from './pc-remote.js'
import { t } from './i18n.js'

export const visibleMessages = (messages, expanded) => expanded ? messages : messages.slice(-200)
export function promptCard(items) {
  if (!items?.length) return null
  const question = items.find(item => item.tool === 'Question' && Array.isArray(item.options))
  return question ? { kind: 'question', detail: question.detail, options: question.options } : { kind: 'approval', items, decisions: ['once', 'always', 'reject'] }
}
export const MessageText = ({ text }) => h('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, text)

export function PcSessionPanel({ machine, name, url, close }) {
  const [messages, setMessages] = useState([])
  const [items, setItems] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let stopped = false
    let timer
    const remote = createPcRemote({ url })
    const poll = async () => {
      try {
        const [history, state] = await Promise.all([remote.messages(name), remote.state()])
        if (!stopped) { setMessages(history); setItems(state.pending?.[name] ?? []); setError(current => current === 'PC unreachable' ? '' : current) }
      } catch { if (!stopped) setError('PC unreachable') }
      if (!stopped) timer = setTimeout(poll, 3000)
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [url, name, refresh])
  const run = async fn => {
    if (busy) return
    setBusy(true)
    try {
      const result = await fn(createPcRemote({ url }))
      setError(result.ok === false ? 'Already answered' : result.sent === false ? (result.error || 'Send failed') : '')
      return result
    } catch { setError('PC unreachable') } finally { setBusy(false); setRefresh(value => value + 1) }
  }
  const prompt = promptCard(items)
  return h('aside', { className: 'bt-panel', style: { display: 'flex', flexDirection: 'column', padding: 16, gap: 10 }, 'aria-label': t('PC session') },
    h('div', null, h('strong', null, `${machine} · ${name}`), ' ', h('button', { type: 'button', onClick: close }, t('Close'))),
    error ? h('div', { role: 'status' }, t(error)) : null,
    h('div', { style: { flex: 1, overflowY: 'auto' } },
      messages.length > 200 && !expanded ? h('button', { type: 'button', onClick: () => setExpanded(true) }, t('Show earlier')) : null,
      visibleMessages(messages, expanded).map((message, index) => h('div', { key: index, style: { margin: '12px 0' } }, h('strong', null, message.dir === 'out' ? t('You') : name), h(MessageText, { text: message.text ?? message.summary ?? '' })))),
    prompt ? h('div', { role: 'group' }, prompt.kind === 'question'
      ? [h(MessageText, { key: 'detail', text: prompt.detail }), ...prompt.options.map(option => h('button', { key: option, type: 'button', disabled: busy, onClick: () => void run(remote => remote.answer(name, option)) }, option))]
      : [prompt.items.map((item, index) => h(MessageText, { key: index, text: `${item.tool}: ${item.detail}` })), ...prompt.decisions.map(decision => h('button', { key: decision, type: 'button', disabled: busy, onClick: () => void run(remote => remote.decide(name, decision)) }, t(({ once: 'Allow once', always: 'Always allow', reject: 'Reject' })[decision])))]) : null,
    h('form', { onSubmit: event => { event.preventDefault(); const text = draft.trim(); if (text) void run(remote => remote.send(name, text)).then(result => { if (result?.sent) setDraft('') }) } },
      h('textarea', { value: draft, onChange: event => setDraft(event.target.value), 'aria-label': t('Message') }),
      h('button', { type: 'submit', disabled: busy || !draft.trim() }, t('Send'))))
}
