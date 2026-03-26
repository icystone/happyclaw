#!/bin/bash
set -e

# Set permissive umask so files created by the container (node user, uid 1000)
# are writable by the host backend (agent user, uid 1002).
# Without this, the host cannot delete/modify files created by the container.
umask 0000

# Fix ownership on mounted volumes.
# Host uid may differ from container node user (uid 1000), especially in
# rootless podman where uid remapping causes EACCES on bind mounts.
# Running as root here so chown works regardless of host uid.
chown -R node:node /home/node/.claude 2>/dev/null || true
chown -R node:node /home/node/.codex 2>/dev/null || true
chown -R node:node /workspace/group /workspace/global /workspace/memory /workspace/ipc 2>/dev/null || true

# Source environment variables from mounted env file
if [ -f /workspace/env-dir/env ]; then
  set -a
  source /workspace/env-dir/env
  set +a
fi

# Buffer stdin to file (container requires EOF to flush stdin pipe)
cat > /tmp/input.json
chmod 644 /tmp/input.json

# Fix permissions on exit: both Claude Code and Codex may create files with
# mode 0600 (e.g. settings.json), which the host backend cannot read.
# The trap runs as root after the process exits.
cleanup() {
  chmod -R a+rwX /home/node/.claude 2>/dev/null || true
  chmod -R a+rwX /home/node/.codex 2>/dev/null || true
  chmod -R a+rwX /workspace/group 2>/dev/null || true
}
trap cleanup EXIT

# === Codex mode: run codex CLI directly, skip skills & TypeScript compilation ===
if [ "${HAPPYCLAW_RUNTIME:-}" = "codex" ]; then
  mkdir -p /home/node/.codex/skills
  for dir in /opt/builtin-skills /workspace/project-skills /workspace/user-skills; do
    if [ -d "$dir" ]; then
      for skill in "$dir"/*/; do
        if [ -d "$skill" ]; then
          name=$(basename "$skill")
          target="/home/node/.codex/skills/$name"
          if [ -e "$target" ] && [ ! -L "$target" ]; then
            rm -rf "$target" 2>/dev/null || true
          fi
          ln -sfn "$skill" "$target" 2>/dev/null || true
        fi
      done
    fi
  done
  chown -R node:node /home/node/.codex/skills 2>/dev/null || true

  PROMPT=$(jq -r '.prompt' /tmp/input.json)
  SESSION_ID=$(jq -r '.sessionId // empty' /tmp/input.json)

  # Extract base64 images to temp files and build -i arguments
  IMAGE_ARGS=()
  IMAGE_COUNT=$(jq '.images | length' /tmp/input.json)
  if [ "$IMAGE_COUNT" -gt 0 ]; then
    for i in $(seq 0 $((IMAGE_COUNT - 1))); do
      MIME=$(jq -r ".images[$i].mimeType // \"image/jpeg\"" /tmp/input.json)
      EXT=".jpg"
      case "$MIME" in
        image/png) EXT=".png" ;;
        image/gif) EXT=".gif" ;;
        image/webp) EXT=".webp" ;;
      esac
      jq -r ".images[$i].data" /tmp/input.json | base64 -d > "/tmp/image-${i}${EXT}"
      IMAGE_ARGS+=("-i" "/tmp/image-${i}${EXT}")
    done
  fi

  if [ -n "$SESSION_ID" ]; then
    runuser -u node -- codex exec resume --json --skip-git-repo-check "${IMAGE_ARGS[@]}" "$SESSION_ID" "$PROMPT"
  else
    runuser -u node -- codex exec --json --skip-git-repo-check "${IMAGE_ARGS[@]}" "$PROMPT"
  fi
  exit $?
fi

# === Claude mode (original path) ===

# Discover and link skills (builtin → project → user, higher priority overwrites)
# Only remove entries that conflict with mounted skills (non-symlink with same name),
# preserving any skills the agent created directly in .claude/skills/.
mkdir -p /home/node/.claude/skills
for dir in /opt/builtin-skills /workspace/project-skills /workspace/user-skills; do
  if [ -d "$dir" ]; then
    for skill in "$dir"/*/; do
      if [ -d "$skill" ]; then
        name=$(basename "$skill")
        target="/home/node/.claude/skills/$name"
        # Remove conflicting non-symlink entry (e.g. real directory from a failed agent edit)
        if [ -e "$target" ] && [ ! -L "$target" ]; then
          rm -rf "$target" 2>/dev/null || true
        fi
        ln -sfn "$skill" "$target" 2>/dev/null || true
      fi
    done
  fi
done
chown -R node:node /home/node/.claude/skills 2>/dev/null || true

# Compile TypeScript (agent-runner source may be hot-mounted from host)
cd /app && npx tsc --outDir /tmp/dist 2>&1 >&2
ln -s /app/node_modules /tmp/dist/node_modules
ln -s /app/prompts /tmp/prompts
chmod -R a-w /tmp/dist

# Drop privileges and execute agent-runner as node user
runuser -u node -- node /tmp/dist/index.js < /tmp/input.json
