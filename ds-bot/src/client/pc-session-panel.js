import { Fragment, createElement as h, useEffect, useRef, useState } from 'react'
import { createPcRemote } from './pc-remote.js'
import { SessionList } from './pc-sessions.js'
import { ChevronLeftIcon, CloseIcon } from './icons.js'
import { MarkdownText } from './dsh-primitives.js'
import { t } from './i18n.js'

export const visibleMessages = (messages, expanded) => expanded ? messages : messages.slice(-200)
export function promptCard(items) {
  if (!items?.length) return null
  const question = items.find(item => item.tool === 'Question' && Array.isArray(item.options))
  return question ? { kind: 'question', detail: question.detail, options: question.options } : { kind: 'approval', items, decisions: ['once', 'always', 'reject'] }
}
export const MessageText = ({ text }) => h('div', { className: 'bt-pc-text' }, text)

const DECISION = { once: 'Allow once', always: 'Always allow', reject: 'Reject' }
// Session replies are Markdown; DSH's renderer draws them the way the Bots' own chats do.
const mdLabels = () => ({ code: { copyLabel: t('Copy'), copiedLabel: t('Copied') }, footnotes: t('Footnotes') })
const MessageBody = ({ text }) => (MarkdownText ? h(MarkdownText, { text, labels: mdLabels(), variant: 'compact' }) : h(MessageText, { text }))

// Polls one PC remote while open: the session's history and prompts, or with no session,
// the list to pick one from.
function usePcRemote(url, name, refresh) {
  const [data, setData] = useState({ messages: [], peers: [], pending: {}, loaded: false })
  const [unreachable, setUnreachable] = useState(false)
  useEffect(() => {
    let stopped = false
    let timer
    const remote = createPcRemote({ url })
    const poll = async () => {
      try {
        const [messages, state] = await Promise.all([name ? remote.messages(name) : [], remote.state()])
        if (!stopped) { setData({ messages, peers: state.peers ?? [], pending: state.pending ?? {}, loaded: true }); setUnreachable(false) }
      } catch { if (!stopped) setUnreachable(true) }
      if (!stopped) timer = setTimeout(poll, name ? 3000 : 5000)
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [url, name, refresh])
  return [data, unreachable]
}

export function PcSessionPanel({ machine, name, url, close, actions }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [data, unreachable] = usePcRemote(url, name, refresh)
  const body = useRef(null)
  const atEnd = useRef(true)
  // A new reply scrolls into view only for a reader already at the bottom.
  useEffect(() => {
    if (body.current && atEnd.current) body.current.scrollTop = body.current.scrollHeight
  }, [data.messages.length, name])
  const run = async fn => {
    if (busy) return undefined
    setBusy(true)
    try {
      const result = await fn(createPcRemote({ url }))
      setError(result.ok === false ? 'Already answered' : result.sent === false ? (result.error || 'Send failed') : '')
      return result
    } catch { setError('PC unreachable') } finally { setBusy(false); setRefresh(value => value + 1) }
    return undefined
  }
  const head = (title, sub, back) => h('div', { className: 'bt-pc-head' },
    back ? h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('All PC sessions'), title: t('All PC sessions'), onClick: back }, h(ChevronLeftIcon)) : null,
    h('div', { className: 'bt-pc-title' }, h('b', null, title), sub ? h('span', null, sub) : null),
    h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Close panel'), title: t('Close panel'), onClick: close }, h(CloseIcon)))
  const note = unreachable ? 'PC unreachable' : error
  if (!name) {
    return h('aside', { className: 'bt-panel bt-pc-panel', 'aria-label': t('PC sessions') },
      head(t('PC sessions'), machine),
      note ? h('div', { className: 'bt-pc-note', role: 'status' }, t(note)) : null,
      h('div', { className: 'bt-pc-list' }, h(SessionList, { peers: data.peers, pending: data.pending, onOpen: next => actions.openPcSession(machine, next) })))
  }
  const label = name.replace(/^.*?::/, '').replaceAll('_', ' ')
  const tool = name.includes('::') ? name.split('::')[0] : ''
  const prompt = promptCard(data.pending[name])
  return h('aside', { className: 'bt-panel bt-pc-panel', 'aria-label': t('PC session') },
    head(label, [tool, machine].filter(Boolean).join(' · '), () => actions.openPcSession(machine, null)),
    note ? h('div', { className: 'bt-pc-note', role: 'status' }, t(note)) : null,
    h('div', { className: 'bt-pc-body', ref: body, onScroll: event => { const el = event.currentTarget; atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 } },
      data.messages.length > 200 && !expanded ? h('button', { type: 'button', className: 'bt-pc-earlier', onClick: () => setExpanded(true) }, t('Show earlier')) : null,
      visibleMessages(data.messages, expanded).map((message, index) => h('div', { key: index, className: `bt-pc-msg ${message.dir === 'out' ? 'bt-pc-out' : 'bt-pc-in'}` },
        // What you sent stays plain text: it sits on your bubble's colour, which Markdown would not follow.
        h(message.dir === 'out' ? MessageText : MessageBody, { text: message.text || message.summary || '' })))),
    prompt ? h('div', { className: 'bt-pc-prompt', role: 'group', 'aria-label': t('The session is asking') }, prompt.kind === 'question'
      ? h(Fragment, null, h(MessageText, { text: prompt.detail }), h('div', { className: 'bt-pc-choices' },
        prompt.options.map(option => h('button', { key: option, type: 'button', className: 'bt-pc-choice', disabled: busy, onClick: () => void run(remote => remote.answer(name, option)) }, option))))
      : h(Fragment, null, h('div', { className: 'bt-pc-prompt-title' }, t('Needs your approval')),
        prompt.items.map((item, index) => h(MessageText, { key: index, text: `${item.tool}: ${item.detail}` })),
        h('div', { className: 'bt-pc-choices' }, prompt.decisions.map(decision => h('button', {
          key: decision, type: 'button', className: decision === 'once' ? 'bt-send' : 'bt-pc-choice', disabled: busy,
          onClick: () => void run(remote => remote.decide(name, decision)),
        }, t(DECISION[decision])))))) : null,
    h('form', { className: 'bt-pc-compose', onSubmit: (event) => { event.preventDefault(); const text = draft.trim(); if (text) void run(remote => remote.send(name, text)).then((result) => { if (result?.sent) setDraft('') }) } },
      h('textarea', { className: 'bt-pc-input', rows: 1, value: draft, placeholder: t('Message this session'), 'aria-label': t('Message this session'), onChange: event => setDraft(event.target.value) }),
      h('button', { type: 'submit', className: 'bt-send', disabled: busy || !draft.trim() }, t('Send'))))
}
