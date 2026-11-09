import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRemotes } from '../src/host/pc-remotes.js'

test('PC remotes come from one variable, and bad entries are dropped', () => {
  assert.deepEqual(parseRemotes('other=https://pc.example.ts.net, bad, x=http://plain.example'), [{ machine: 'other', url: 'https://pc.example.ts.net' }])
  assert.deepEqual(parseRemotes(undefined), [])
  assert.deepEqual(parseRemotes('a=https://example.com/, bad name=https://example.com, x=https://user:pass@example.com'), [{ machine: 'a', url: 'https://example.com' }])
})
