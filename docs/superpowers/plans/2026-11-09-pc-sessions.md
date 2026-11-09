# PC Sessions in DS Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List the agent sessions running on the user's PC in DS Bot's sidebar, and open one to read its history, send it a message, and answer its permission prompts.

**Architecture:** The browser talks straight to the PC's agent-bus phone remote through the PC's existing Tailscale proxy (`tailnet_proxy.py`), which adds the PC's token. The DS Bot server only tells the page that proxy's address. No token for the PC is stored on the server or in the container, and the server's own tailnet access to the PC stays limited to port 8787 with a link token.

**Tech Stack:** DS Bot client (`ds-bot/src/client`, plain `h()` components, bundled by `npm run build` into `client.js`), DS Bot host (`ds-bot/src/host`), Python 3 stdlib for the proxy, Tailscale serve.

**Spec:** The Decisions section below. It replaces the dropped "Agents sidebar" of `docs/2026-11-09-ds-bot-agent-hub-design.md` revision 1, adjusted for Tailscale.

## Decisions

- Data path: browser on `https://<server>.<tailnet>.ts.net` -> `fetch` -> `https://<pc>.<tailnet>.ts.net` (the PC's `tailnet_proxy.py`) -> phone remote on the PC.
- Only a logged-in Tailscale user reaches the proxy: tagged machines do not get `Tailscale-User-Login`, and the ACL already blocks `tag:ds-bot` from the PC's port 443.
- The proxy keeps refusing other origins. It admits exactly one more origin, the DS Bot address, and answers CORS for it.
- The DS Bot host learns the PC addresses from one environment variable, `DSBOT_PC_REMOTES`, for example `other=https://<pc>.<tailnet>.ts.net`. The key is the machine name already used on the bus.
- This is read, send, and answer only. Starting sessions, renaming, model choice, and the phone remote's other controls stay in the phone remote.
- Session text is shown as text, never as HTML.

## Global Constraints

- No new npm or Python dependencies.
- `ds-bot/client.js` is rebuilt with `npm run build` and committed in the same commit as any `src/client` change; `npm test` fails on a stale bundle.
- `npm test` in `ds-bot/` passes with 0 failures; `python3 -m unittest discover -s tests` passes in agent-bus.
- `tailnet_proxy.py` moves into the private agent-bus repository; it must never be committed to the public DS Bot fork, which keeps only placeholders like `<pc>.<tailnet>.ts.net`.
- When `DSBOT_PC_REMOTES` is unset, DS Bot looks and behaves exactly as today.

## Review Focus

1. The PC is off or Tailscale is down on the viewing device: the section shows "PC unreachable" once, keeps the rest of DS Bot working, and retries; it never spins or floods the console.
2. 90+ sessions with many idle ones: the section shows working and waiting-for-you sessions first and collapses the rest behind "Show all"; tested with 100 rows.
3. Message text containing `<script>`, Markdown, or an `http` link: shown as plain text; tested with `<img src=x onerror=alert(1)>`.
4. A permission prompt answered elsewhere (phone remote, terminal) while open here: the card disappears on the next refresh and a late click reports "already answered" instead of acting.
5. A very long history (1000+ entries): only the latest 200 render, with "Show earlier"; tested with 1500 entries.

---

### Task 1: Proxy admits DS Bot's origin

**Files:**
- Create in agent-bus repo: `tailnet_proxy.py` (moved from `~/agent-bus/tailnet_proxy.py`), `tests/test_tailnet_proxy.py`
- Modify: `~/.config/systemd/user/phone-tailnet-proxy.service` (path of the moved file, plus `Environment=PROXY_EXTRA_ORIGINS=https://<server>.<tailnet>.ts.net`)

**Interfaces:**
- Produces: `allowed(host: str | None, origin: str | None, extra: frozenset[str]) -> bool`; `cors_headers(origin: str | None, extra: frozenset[str]) -> dict[str, str]`; an `OPTIONS` handler. `extra` comes from `PROXY_EXTRA_ORIGINS`, comma-separated.

- [ ] **Step 1: Write the failing tests**

```python
def test_extra_origin_is_admitted_and_others_are_not(self):
    extra = frozenset({"https://oci.example.ts.net"})
    self.assertTrue(allowed(NAME, "https://oci.example.ts.net", extra))
    self.assertFalse(allowed(NAME, "https://evil.example", extra))
    self.assertFalse(allowed(NAME, "http://oci.example.ts.net", extra))

def test_cors_headers_only_for_an_extra_origin(self):
    extra = frozenset({"https://oci.example.ts.net"})
    self.assertEqual(cors_headers("https://oci.example.ts.net", extra)["Access-Control-Allow-Origin"], "https://oci.example.ts.net")
    self.assertEqual(cors_headers("https://" + NAME, extra), {})
    self.assertEqual(cors_headers(None, extra), {})

def test_preflight_answers_204_with_allowed_methods(self):
    # Start Proxy on a free port against a stub backend; send OPTIONS with Origin and Host.
    self.assertEqual(status, 204)
    self.assertEqual(headers["Access-Control-Allow-Methods"], "GET, POST")
    self.assertEqual(headers["Access-Control-Allow-Headers"], "Content-Type")
```

- [ ] **Step 2: Run** `python3 -m unittest tests.test_tailnet_proxy -v` — expected FAIL (`cors_headers` not defined).
- [ ] **Step 3: Implement.** Responses to an extra origin also carry `Vary: Origin`. `OPTIONS` never reaches the backend. A request with no `Tailscale-User-Login` header is refused with 403 (it only ever arrives through `tailscale serve`).
- [ ] **Step 4: Run tests** — expected PASS. Restart `phone-tailnet-proxy.service`.
- [ ] **Step 5: Spike in a real browser.** From the DS Bot page's console: `await (await fetch("https://<pc>.<tailnet>.ts.net/api/state?light=1")).json()` returns `peers`. If Chrome blocks it under Private Network Access, stop and report before Task 3: the fallback is a same-origin path on the server, which changes Task 2.
- [ ] **Step 6: Commit** in agent-bus: `git add tailnet_proxy.py tests/test_tailnet_proxy.py && git commit -m "Tailnet proxy: admit one extra origin with CORS"`

### Task 2: DS Bot tells the page where PC remotes are

**Files:**
- Create: `ds-bot/src/host/pc-remotes.js`, `ds-bot/test/pc-remotes.test.js`
- Modify: `ds-bot/src/host/channel.js` (the snapshot object at `bots: Object.values(state.bots)...`, line ~50), `docker-compose.override.yml` on the server (`DSBOT_PC_REMOTES`), `docker/AGENT-HUB.md`

**Interfaces:**
- Produces: `parseRemotes(text: string | undefined) -> Array<{ machine: string, url: string }>`; snapshot field `pcRemotes` with that array.

- [ ] **Step 1: Write the failing test**

```js
test('PC remotes come from one variable, and bad entries are dropped', () => {
  assert.deepEqual(parseRemotes('other=https://pc.example.ts.net, bad, x=http://plain.example'), [{ machine: 'other', url: 'https://pc.example.ts.net' }])
  assert.deepEqual(parseRemotes(undefined), [])
})
```

- [ ] **Step 2: Run** `node --import ./test/harness-resolve.mjs --test test/pc-remotes.test.js` — expected FAIL.
- [ ] **Step 3: Implement.** Only `https:` URLs; machine names match `^[\w.-]+$`; no trailing slash.
- [ ] **Step 4: Run** `npm test` — expected 0 failures.
- [ ] **Step 5: Commit** `git commit -m "Expose PC remote addresses to the page"`

### Task 3: Client for one PC remote

**Files:**
- Create: `ds-bot/src/client/pc-remote.js`, `ds-bot/test/pc-remote.test.js`

**Interfaces:**
- Consumes: `{ machine, url }` from Task 2.
- Produces: `createPcRemote({ url, fetch = globalThis.fetch })` returning
  - `state() -> Promise<{ peers: Peer[], pending: Record<string, PendingItem[]> }>` (from `GET /api/state?light=1`)
  - `messages(name: string) -> Promise<Message[]>` (from `GET /api/messages?key=<name>`)
  - `send(name: string, text: string) -> Promise<{ sent: boolean, error?: string }>` (`POST /api/send` body `{ to, message }`)
  - `decide(name: string, decision: 'once' | 'always' | 'reject') -> Promise<{ ok: boolean, error?: string }>` (`POST /api/permission` body `{ to, decision }`)
  - `answer(name: string, answer: string) -> Promise<{ ok: boolean, error?: string }>` (`POST /api/permission` body `{ to, decision: 'answer', answer }`)
  - `Peer = { name, tool, status, detail, directory, hidden }`; `Message = { ts, dir: 'in' | 'out', key, summary, text }`; `PendingItem = { tool, detail, options?, rule? }`.

- [ ] **Step 1: Write the failing tests** with a fake `fetch` that records calls:

```js
test('a session is sent to by name, as JSON', async () => {
  await remote.send('claude::fix', 'hi')
  assert.deepEqual(calls.at(-1), { url: 'https://pc.example/api/send', method: 'POST', body: { to: 'claude::fix', message: 'hi' } })
})
test('an unreachable PC rejects with a plain message', async () => {
  await assert.rejects(failing.state(), /PC unreachable/)
})
test('hidden sessions are dropped from state', async () => {
  assert.deepEqual((await remote.state()).peers.map(p => p.name), ['shown'])
})
```

- [ ] **Step 2: Run** them — expected FAIL.
- [ ] **Step 3: Implement.** Every request sends `Content-Type: application/json` for POST and no credentials; a network error or non-2xx becomes `Error('PC unreachable')` except a 400 from `/api/permission`, which resolves with its body.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** `git commit -m "Client for a PC's agent-bus remote"`

### Task 4: "PC sessions" sidebar section

**Files:**
- Create: `ds-bot/src/client/pc-sessions.js`, `ds-bot/test/pc-sessions.test.js`
- Modify: `ds-bot/src/client/sidebar.js` (render `PcSessions` in `TeamSidebar` after the section blocks), `ds-bot/src/client/index.js` (one `pcSessions` source polled every 5 s while the page is visible, passed through `face()`), `ds-bot/src/client/i18n.js` (Chinese for every new string), `ds-bot/client.js` (rebuilt)

**Interfaces:**
- Consumes: `createPcRemote` (Task 3), snapshot `pcRemotes` (Task 2).
- Produces: `sessionRows(peers: Peer[], pending: Record<string, PendingItem[]>, showAll: boolean) -> Array<{ name, tool, label, state: 'asking' | 'busy' | 'idle' | 'failed' }>`; `actions.openPcSession(machine: string, name: string)`.

- [ ] **Step 1: Write the failing tests**

```js
test('sessions asking for you come first, then busy ones, and idle ones wait behind Show all', () => {
  const rows = sessionRows(peers, { 'claude::b': [{ tool: 'Bash', detail: 'ls' }] }, false)
  assert.deepEqual(rows.map(r => r.name), ['claude::b', 'codex::busy'])
})
test('a hundred sessions render at most 12 rows until Show all', () => {
  assert.equal(sessionRows(hundred, {}, false).length <= 12, true)
  assert.equal(sessionRows(hundred, {}, true).length, 100)
})
test('labels drop the tool prefix and underscores', () => {
  assert.equal(sessionRows([{ name: 'opencode::Fix_coord', tool: 'opencode', status: 'idle' }], {}, true)[0].label, 'Fix coord')
})
```

- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** `sessionRows`, then the `PcSessions` component: a heading per machine, the tool badge from `agent-routes.js`, a dot for state, "PC unreachable" in place of rows when the source errors, and "Show all (n)". No section at all when `pcRemotes` is empty.
- [ ] **Step 4: Run** `npm run build && npm test` — expected 0 failures.
- [ ] **Step 5: Commit** `git commit -m "Show PC sessions in the sidebar"`

### Task 5: Session panel

**Files:**
- Create: `ds-bot/src/client/pc-session-panel.js`, `ds-bot/test/pc-session-panel.test.js`
- Modify: `ds-bot/src/client/index.js` (a `view: 'pc'` branch beside `view === 'browser'`, opened by `openPcSession` with `details: 'pc:<machine>:<name>'`), `ds-bot/src/client/i18n.js`, `ds-bot/client.js` (rebuilt)

**Interfaces:**
- Consumes: `createPcRemote` (Task 3), `openPcSession` (Task 4).
- Produces: `visibleMessages(messages: Message[], expanded: boolean) -> Message[]`; `promptCard(items: PendingItem[]) -> { kind: 'question', detail, options } | { kind: 'approval', items, decisions: ['once', 'always', 'reject'] } | null`.

- [ ] **Step 1: Write the failing tests**

```js
test('a question prompt offers its own options; an approval offers once, always and reject', () => {
  assert.deepEqual(promptCard([{ tool: 'Question', detail: 'Pick', options: ['a', 'b'] }]), { kind: 'question', detail: 'Pick', options: ['a', 'b'] })
  assert.deepEqual(promptCard([{ tool: 'Bash', detail: 'rm x' }]).decisions, ['once', 'always', 'reject'])
  assert.equal(promptCard([]), null)
})
test('only the latest 200 of 1500 messages show until expanded', () => {
  assert.equal(visibleMessages(fifteenHundred, false).length, 200)
  assert.equal(visibleMessages(fifteenHundred, true).length, 1500)
})
test('message text is rendered as text', () => {
  // Render the panel with text '<img src=x onerror=alert(1)>' and assert no img element exists.
})
```

- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** the panel: history (`dir: 'in'` is the session, `'out'` is what was sent to it), a composer that calls `send` and refreshes, and the prompt card calling `decide` or `answer`. A resolved `{ ok: false }` shows "Already answered" and refreshes. Refresh every 3 s while open.
- [ ] **Step 4: Run** `npm run build && npm test` — expected 0 failures.
- [ ] **Step 5: Commit** `git commit -m "Open a PC session: history, send, answer prompts"`

### Task 6: Deploy and check on the phone

**Files:**
- Modify on the server: `docker-compose.override.yml` (`DSBOT_PC_REMOTES=other=https://<pc>.<tailnet>.ts.net`)

- [ ] **Step 1:** Rebuild, copy the plugin over the persisted profile, restart (commands in `docker/AGENT-HUB.md`).
- [ ] **Step 2:** On the phone at `/auto-login`: the PC section lists sessions; open one; its history matches the phone remote; send "reply with: pc ok" and see the reply within one refresh.
- [ ] **Step 3:** From inside the container, `curl https://<pc>.<tailnet>.ts.net/api/state` (with `--resolve` to the PC's tailnet IP) fails: the Bots still cannot use this path.
- [ ] **Step 4:** Merge `agent-hub` into `main` only when the user approves.
