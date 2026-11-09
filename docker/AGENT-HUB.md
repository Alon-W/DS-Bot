# Agent bots on a server

This fork runs DS Bot's Bots on agent CLIs (Claude Code, Codex, OpenCode) with no
DeepSeek key, and joins them to [agent-bus](https://github.com/Alon-W/agent-bus), which
is private. Machines reach each other over Tailscale.

## Build

`docker/agent-bus/` is a git-ignored local copy of agent-bus and must exist first
(`agent_bus.py`, `phone_remote.py`, `CONTEXT.md`, `web/`).

Create `docker-compose.override.yml` (git-ignored). `!override` matters: Compose adds
`ports` lists together, so without it the public port stays open.

```yaml
services:
  ds-bot:
    ports: !override
      - "127.0.0.1:13080:3080"
      - "127.0.0.1:8787:8787"
    environment:
      DSH_TRUSTED_HOST: "localhost,127.0.0.1,<tailscale-ip>,<host>,<host>.<tailnet>.ts.net"
      DSBOT_PC_REMOTES: "other=https://<pc>.<tailnet>.ts.net"
    volumes:
      - node-home:/home/node
volumes:
  node-home:
```

`DSBOT_PC_REMOTES` is optional. Its comma-separated machine names must match the
names on the bus; each URL is the PC's HTTPS Tailscale proxy address. The browser
connects directly to the proxy, which must allow the DS Bot origin.

```sh
sudo docker compose up -d --build
```

Sign in each CLI yourself with `sudo docker compose exec -u node ds-bot <cli>`. For Antigravity, use `agy acp --login`.

After a rebuild that changes `ds-bot/`, copy the plugin over the persisted profile and
restart. `dsh plugin add` fails on a pnpm store mismatch.

```sh
sudo docker compose exec -T -u node ds-bot sh -ec 'P=/data/profiles/web/node_modules; rm -rf $P/ds-bot.new; cp -a /opt/dsh-template/profiles/web/node_modules/ds-bot $P/ds-bot.new; rm -rf $P/ds-bot; mv $P/ds-bot.new $P/ds-bot'
sudo docker compose restart
```

## Tailscale

Tag the server and limit it, because the container can use the server's tailnet access:

```json
{"src": ["tag:ds-bot"], "dst": ["<pc-tailscale-ip>"], "ip": ["tcp:8787"]}
```

Your own devices need a separate `autogroup:member` rule, and no rule may use `*` as a
source.

```sh
sudo tailscale up --hostname=<host> --advertise-tags=tag:ds-bot --accept-dns=false
sudo tailscale serve --bg --tcp 13080 tcp://127.0.0.1:13080
sudo tailscale serve --bg --tcp 8787 tcp://127.0.0.1:8787
```

## Logging in from your own devices

`docker/tailnet-login.py` logs a logged-in Tailscale user in to DS Bot, with no token to
copy. Run it as a service on the host, as a user with passwordless `sudo docker`, then:

```sh
sudo tailscale serve --bg --https=443 http://127.0.0.1:13080
sudo tailscale serve --bg --https=443 --set-path=/auto-login http://127.0.0.1:13081
```

Bookmark `https://<host>.<tailnet>.ts.net/auto-login`. Tagged machines do not get the
user header that this relies on.

## Linking machines

Do not use `--machine`: it needs the full token and announces a LAN address. Write
`~/.agent-bus/machines.json` on each side, with the other side's link token from
`~/.agent-bus/phone-remote/link_token`. The key must match the other side's `self`.

```json
{"self": "<this-machine>", "machines": {"<other-machine>": "http://<its-tailscale-ip>:8787/?token=<its-link-token>"}}
```

Never point a link at a `phone_remote.py` running with `--home`: it has no token check,
so full-access Bots would control that machine.

## Bots on the bus

Add an MCP capability named `agentbus` with command `python3` and arguments
`/opt/agent-bus/agent_bus.py` and `mcp` (one per line), then add it to each Bot. A Bot's
bus address is `dsbot-<name>`, such as `dsbot-chief`. Automatic memory review runs through each Bot's own CLI,
in a throwaway read-only session, after each turn.
