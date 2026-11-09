# syntax=docker/dockerfile:1

# Build: installs dsh and packs the plugin, then initializes a template DSH_HOME
# (the web profile with ds-bot installed) that the entrypoint copies into /data
# on first start. Build context is the repository root:
#   docker build -f docker/Dockerfile -t ds-bot:local .
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG DSH_VERSION=0.2.2-rc.1

RUN corepack enable \
    && npm config set registry "$NPM_REGISTRY" --global \
    && COREPACK_NPM_REGISTRY="$NPM_REGISTRY" pnpm config set registry "$NPM_REGISTRY" --global \
    && npm install -g "@deepseek-ai/dsh@${DSH_VERSION}" \
        --allow-scripts=@deepseek-ai/dsh-subprocess-local,node-pty,koffi,@google/genai,protobufjs

COPY ds-bot/ /src/ds-bot/

# ds-bot has no build step at install (client.js is committed), so pack it as-is
# and let `dsh plugin add` set up the web profile from dsh's own template.
RUN cd /src/ds-bot \
    && mkdir -p /opt/ds-bot \
    && npm pack --pack-destination /opt/ds-bot \
    && mv /opt/ds-bot/ds-bot-*.tgz /opt/ds-bot/ds-bot.tgz \
    && DSH_HOME=/opt/dsh-template dsh plugin --profile web add /opt/ds-bot/ds-bot.tgz

FROM ${NODE_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash git curl ca-certificates \
        python3 python3-pip python3-venv \
        build-essential jq ripgrep unzip zip ffmpeg less procps gosu \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY --from=build /usr/local/ /usr/local/
COPY --from=build /opt/dsh-template /opt/dsh-template
COPY --from=build /opt/ds-bot/ds-bot.tgz /opt/ds-bot/ds-bot.tgz
# Persisted profiles from earlier images still refer to the old archive path.
RUN ln -s /opt/ds-bot/ds-bot.tgz /tmp/ds-bot.tgz
# Agent CLIs that run the Bots. Pinned: update by changing the version and rebuilding.
RUN npm install -g @anthropic-ai/claude-code@2.1.319
RUN npm install -g @openai/codex@0.167.0
RUN npm install -g opencode-ai@1.19.5
RUN set -e; \
    case "$(dpkg --print-architecture)" in \
      arm64) p=linux-arm/cli_linux_arm64; s=c2fac818b3c1bb224079df03a714ccba99728b6a3a41d86d247ab2feb8582a43840c5032f1c2b75e72667623d5503e7ffda2712c4f37b6ee19f99c3fcfb25bae ;; \
      amd64) p=linux-x64/cli_linux_x64; s=e363e1b17daaac2589f18e6973429c039fd5a5e5c15e9c0852fa349836f3992b10fe84732bc8d8c8208e149f0304f15aba9dec696d12efeed03917492c0580eb ;; \
    esac; \
    curl -fsSL -o /tmp/agy.tgz "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.3-6604829099950080/$p.tar.gz"; \
    echo "$s  /tmp/agy.tgz" | sha512sum -c -; \
    tar -xzf /tmp/agy.tgz -C /usr/local/bin antigravity; \
    mv /usr/local/bin/antigravity /usr/local/bin/agy; \
    rm /tmp/agy.tgz
ENV DISABLE_AUTOUPDATER=1 OPENCODE_DISABLE_AUTOUPDATE=1 AGY_CLI_DISABLE_AUTO_UPDATE=1
# agent-bus is private: docker/agent-bus/ is a local, git-ignored copy that must exist at build time.
COPY docker/agent-bus/ /opt/agent-bus/
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/docker.patch.yml /opt/ds-bot/docker.patch.yml

ENV DSH_HOME=/data \
    DSH_PERMISSION_MODE=danger-full-access

WORKDIR /workspace
EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

LABEL org.opencontainers.image.title="DS Bot" \
      org.opencontainers.image.description="A team of long-lived Bots on DeepSeek Harness, served by dsh web" \
      org.opencontainers.image.source="https://github.com/Fei2411/DS-Bot" \
      org.opencontainers.image.licenses="Apache-2.0"
