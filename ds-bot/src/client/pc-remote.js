export function createPcRemote({ url, fetch = globalThis.fetch }) {
  const request = async (path, body) => {
    try {
      const options = body === undefined ? { credentials: 'omit', signal: AbortSignal.timeout(8000) } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(body),
      }
      const response = await fetch(`${url}${path}`, options)
      if (!response.ok && !(path === '/api/permission' && response.status === 400)) throw new Error()
      return await response.json()
    } catch {
      throw new Error('PC unreachable')
    }
  }
  return {
    state: async () => {
      const state = await request('/api/state?light=1')
      return { ...state, peers: (state.peers ?? []).filter(peer => !peer.hidden) }
    },
    messages: async name => (await request(`/api/messages?key=${encodeURIComponent(name)}`)).messages ?? [],
    send: (name, text) => request('/api/send', { to: name, message: text }),
    decide: (name, decision) => request('/api/permission', { to: name, decision }),
    answer: (name, answer) => request('/api/permission', { to: name, decision: 'answer', answer }),
  }
}
