import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

const { outputFiles } = await build({ entryPoints: ['src/client/pc-session-panel.js'], bundle: true, format: 'cjs', platform: 'browser', write: false, external: ['react', '@deepseek-ai/*'] })
const module = { exports: {} }
const react = { createElement: (type, props, ...children) => ({ type, props, children }), useEffect() {}, useState: value => [value, () => {}] }
runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: () => react })
const { visibleMessages, promptCard, MessageText } = module.exports

test('questions offer their options; approvals offer three decisions', () => {
  assert.equal(JSON.stringify(promptCard([{ tool: 'Question', detail: 'Pick', options: ['a', 'b'] }])), JSON.stringify({ kind: 'question', detail: 'Pick', options: ['a', 'b'] }))
  assert.equal(JSON.stringify(promptCard([{ tool: 'Bash', detail: 'rm x' }]).decisions), JSON.stringify(['once', 'always', 'reject']))
  assert.equal(promptCard([]), null)
})
test('long histories show the latest 200 until expanded', () => {
  const messages = Array.from({ length: 1500 }, (_, i) => i)
  assert.equal(visibleMessages(messages, false).length, 200)
  assert.equal(visibleMessages(messages, true).length, 1500)
})
test('message text is passed as text, not markup', () => {
  const text = '<img src=x onerror=alert(1)>'
  const element = MessageText({ text })
  assert.equal(element.type, 'div')
  assert.equal(element.children[0], text)
  assert.equal(element.props?.dangerouslySetInnerHTML, undefined)
})
