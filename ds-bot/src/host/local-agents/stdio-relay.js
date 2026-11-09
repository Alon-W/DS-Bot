// Carries one CLI session's MCP between stdio and the loopback server, for an ACP
// agent that takes only stdio MCP servers. Run by the agent, one JSON message a line.
import { createInterface } from 'node:readline'

const { DSBOT_MCP_URL: url, DSBOT_MCP_TOKEN: token } = process.env
const write = line => process.stdout.write(`${line}\n`)

async function relay(line) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: line,
  })
  if (response.status === 202) return
  if (!response.ok) throw new Error(`MCP server answered ${response.status}`)
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    write(JSON.stringify(await response.json()))
    return
  }
  let rest = ''
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    rest += chunk
    const events = rest.split('\n\n')
    rest = events.pop()
    for (const event of events) if (event.startsWith('data: ')) write(event.slice(6))
  }
}

const input = createInterface({ input: process.stdin })
input.on('line', (line) => {
  if (line.trim() === '') return
  relay(line).catch((error) => {
    let id
    try { id = JSON.parse(line).id } catch { id = null }
    if (id !== undefined) write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: error.message } }))
  })
})
input.on('close', () => process.exit(0))
