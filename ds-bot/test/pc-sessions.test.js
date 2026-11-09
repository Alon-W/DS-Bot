import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

const { outputFiles } = await build({ entryPoints: ['src/client/pc-sessions.js'], bundle: true, format: 'cjs', platform: 'browser', write: false, external: ['react'] })
const module = { exports: {} }
runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: () => ({}) })
const { sessionRows } = module.exports

test('asking and busy sessions come before idle sessions', () => {
  const peers = [{ name: 'codex::idle', tool: 'codex', status: 'idle' }, { name: 'codex::busy', tool: 'codex', status: 'busy' }, { name: 'claude::b', tool: 'claude', status: 'idle' }]
  assert.deepEqual(Array.from(sessionRows(peers, { 'claude::b': [{ tool: 'Bash' }] }, false), row => row.name), ['claude::b', 'codex::busy'])
})

test('a hundred sessions are collapsed, and labels are readable', () => {
  const peers = Array.from({ length: 100 }, (_, i) => ({ name: `opencode::Fix_coord_${i}`, tool: 'opencode', status: 'idle' }))
  assert.ok(sessionRows(peers, {}, false).length <= 12)
  assert.equal(sessionRows(peers, {}, true).length, 100)
  assert.equal(sessionRows(peers, {}, true)[0].label, 'Fix coord 0')
})
