/**
 * Session file cleanup — shared between the Web UI reset-session route and the
 * IM `/clear` slash command. Removes everything under the session's runtime
 * state dir (`data/sessions/{folder}/.claude/` for Claude, or the codex
 * equivalent), or the agent-scoped subdir, except `settings.json`, which the
 * container runner recreates anyway but is cheap to preserve.
 *
 * Errors on individual entries are logged and skipped so a single permission
 * problem (e.g. on a stale symlink) doesn't abort the whole reset.
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config.js';
import { logger } from './logger.js';
import { getGroupRuntimeByFolder } from './db.js';
import { getSessionRuntimeDir } from './agent-runtime.js';

export function clearSessionFiles(folder: string, agentId?: string): void {
  const runtimeDir = getSessionRuntimeDir(
    path.join(DATA_DIR, 'sessions'),
    folder,
    getGroupRuntimeByFolder(folder) as 'claude' | 'codex',
    agentId,
  );
  if (!fs.existsSync(runtimeDir)) return;

  const keep = new Set(['settings.json']);
  for (const entry of fs.readdirSync(runtimeDir)) {
    if (keep.has(entry)) continue;
    try {
      fs.rmSync(path.join(runtimeDir, entry), {
        recursive: true,
        force: true,
      });
    } catch (err) {
      logger.warn(
        { entry, folder, agentId, err },
        'Failed to remove session file, skipping',
      );
    }
  }
}
