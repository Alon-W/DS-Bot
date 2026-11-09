import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcRemote } from '../src/client/pc-remote.js'

test('sends a session message as JSON without credentials', async () => {
  const calls = []
  const remote = createPcRemote({ url: 'https://pc.example', fetch: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ sent: true }) }
  } })
  assert.deepEqual(await remote.send('claude::fix', 'hi'), { sent: true })
  assert.deepEqual(calls[0], { url: 'https://pc.example/api/send', method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: { to: 'claude::fix', message: 'hi' } })
})

test('network errors and non-success responses report PC unreachable', async () => {
  for (const fetch of [async () => { throw new Error('offline') }, async () => ({ ok: false, status: 503 })]) {
    await assert.rejects(createPcRemote({ url: 'https://pc.example', fetch }).state(), /PC unreachable/)
  }
})

test('hidden sessions are dropped and permission errors are returned', async () => {
  const calls = []
  const remote = createPcRemote({ url: 'https://pc.example', fetch: async (url, options) => {
    calls.push({ url, options })
    return url.includes('/api/state')
      ? { ok: true, json: async () => ({ peers: [{ name: 'shown' }, { name: 'hidden', hidden: true }], pending: {} }) }
      : { ok: false, status: 400, json: async () => ({ ok: false, error: 'already answered' }) }
  } })
  assert.deepEqual((await remote.state()).peers.map(peer => peer.name), ['shown'])
  assert.deepEqual(await remote.decide('shown', 'once'), { ok: false, error: 'already answered' })
  assert.deepEqual(JSON.parse(calls[1].options.body), { to: 'shown', decision: 'once' })
})

test('messages unwrap the phone remote response', async () => {
  const remote = createPcRemote({ url: 'https://pc.example', fetch: async () => ({ ok: true, json: async () => ({ messages: [{ text: 'hello' }] }) }) })
  assert.deepEqual(await remote.messages('codex::one'), [{ text: 'hello' }])
})
