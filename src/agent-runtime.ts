import path from 'path';
import fs from 'fs';
import { DATA_DIR } from './config.js';

export type AgentRuntimeId = 'claude' | 'codex';

export interface AgentRuntimeMetadata {
  id: AgentRuntimeId;
  label: string;
  memoryFileName: string;
  stateDirName: string;
}

export const DEFAULT_AGENT_RUNTIME: AgentRuntimeId = 'claude';
const AGENT_RUNTIME_CONFIG_DIR = path.join(DATA_DIR, 'config');
const AGENT_RUNTIME_CONFIG_FILE = path.join(
  AGENT_RUNTIME_CONFIG_DIR,
  'agent-runtime.json',
);

const RUNTIME_METADATA: Record<AgentRuntimeId, AgentRuntimeMetadata> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    memoryFileName: 'CLAUDE.md',
    stateDirName: '.claude',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    memoryFileName: 'AGENTS.md',
    stateDirName: '.codex',
  },
};

export function normalizeAgentRuntime(
  value: string | null | undefined,
): AgentRuntimeId {
  return value === 'codex' ? 'codex' : DEFAULT_AGENT_RUNTIME;
}

export function getAgentRuntimeMetadata(
  runtime?: AgentRuntimeId | null,
): AgentRuntimeMetadata {
  return RUNTIME_METADATA[normalizeAgentRuntime(runtime)];
}

export function getRuntimeMemoryFileName(
  runtime?: AgentRuntimeId | null,
): string {
  return getAgentRuntimeMetadata(runtime).memoryFileName;
}

export function getRuntimeStateDirName(
  runtime?: AgentRuntimeId | null,
): string {
  return getAgentRuntimeMetadata(runtime).stateDirName;
}

export function getAllRuntimeMemoryFileNames(): string[] {
  return Array.from(
    new Set(
      Object.values(RUNTIME_METADATA).map((item) => item.memoryFileName),
    ),
  );
}

export function getAllRuntimeStateDirNames(): string[] {
  return Array.from(
    new Set(Object.values(RUNTIME_METADATA).map((item) => item.stateDirName)),
  );
}

export function getSessionRuntimeDir(
  sessionsRoot: string,
  folder: string,
  runtime?: AgentRuntimeId | null,
  agentId?: string,
): string {
  const stateDirName = getRuntimeStateDirName(runtime);
  return agentId
    ? path.join(sessionsRoot, folder, 'agents', agentId, stateDirName)
    : path.join(sessionsRoot, folder, stateDirName);
}

export function getSessionRuntimeHomeDir(
  sessionsRoot: string,
  folder: string,
  agentId?: string,
): string {
  return agentId
    ? path.join(sessionsRoot, folder, 'agents', agentId)
    : path.join(sessionsRoot, folder);
}

export function runtimeUsesHostRunner(
  _runtime?: AgentRuntimeId | null,
): boolean {
  return false;
}

export function getDefaultAgentRuntime(): AgentRuntimeId {
  try {
    if (!fs.existsSync(AGENT_RUNTIME_CONFIG_FILE)) return DEFAULT_AGENT_RUNTIME;
    const raw = JSON.parse(
      fs.readFileSync(AGENT_RUNTIME_CONFIG_FILE, 'utf-8'),
    ) as { defaultRuntime?: string };
    return normalizeAgentRuntime(raw.defaultRuntime);
  } catch {
    return DEFAULT_AGENT_RUNTIME;
  }
}

export function saveDefaultAgentRuntime(
  runtime: AgentRuntimeId,
): AgentRuntimeId {
  const normalized = normalizeAgentRuntime(runtime);
  fs.mkdirSync(AGENT_RUNTIME_CONFIG_DIR, { recursive: true });
  const tmp = `${AGENT_RUNTIME_CONFIG_FILE}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify({ defaultRuntime: normalized }, null, 2) + '\n',
    'utf-8',
  );
  fs.renameSync(tmp, AGENT_RUNTIME_CONFIG_FILE);
  return normalized;
}

export function getGroupMemoryFilePath(
  groupsRoot: string,
  folder: string,
  runtime?: AgentRuntimeId | null,
): string {
  return path.join(groupsRoot, folder, getRuntimeMemoryFileName(runtime));
}

export function getUserGlobalMemoryFilePath(
  userGlobalRoot: string,
  userId: string,
  runtime?: AgentRuntimeId | null,
): string {
  return path.join(
    userGlobalRoot,
    userId,
    getRuntimeMemoryFileName(runtime),
  );
}
