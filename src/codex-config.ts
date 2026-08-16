import fs from 'fs';
import path from 'path';

import { DATA_DIR } from './config.js';

const CONFIG_DIR = path.join(DATA_DIR, 'config');
const CODEX_CONFIG_FILE = path.join(CONFIG_DIR, 'codex-provider.json');

export interface CodexProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  command: string;
  updatedAt: string | null;
}

export interface CodexProviderPublicConfig {
  baseUrl: string;
  model: string;
  command: string;
  updatedAt: string | null;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}

export interface LocalCodexStatus {
  detected: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  baseUrl: string | null;
  model: string | null;
}

const DEFAULT_CODEX_CONFIG: CodexProviderConfig = {
  baseUrl: '',
  apiKey: '',
  model: 'gpt-5.4',
  command: 'codex',
  updatedAt: null,
};

function maskSecret(value: string): string | null {
  if (!value) return null;
  if (value.length <= 8) {
    return `${'*'.repeat(Math.max(value.length - 2, 1))}${value.slice(-2)}`;
  }
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(value.length - 7, 4))}${value.slice(-4)}`;
}

function sanitizeValue(value: string): string {
  return value.replace(/[\r\n\0]/g, '').trim();
}

function validateCodexProviderConfig(config: CodexProviderConfig): string[] {
  const errors: string[] = [];
  if (config.baseUrl) {
    try {
      const parsed = new URL(config.baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('CODEX_BASE_URL 必须是 http 或 https 地址');
      }
    } catch {
      errors.push('CODEX_BASE_URL 格式不正确');
    }
  }
  if (config.model.length > 128) {
    errors.push('模型名称过长');
  }
  return errors;
}

export function getCodexProviderConfig(): CodexProviderConfig {
  try {
    if (!fs.existsSync(CODEX_CONFIG_FILE)) return { ...DEFAULT_CODEX_CONFIG };
    const raw = JSON.parse(
      fs.readFileSync(CODEX_CONFIG_FILE, 'utf-8'),
    ) as Partial<CodexProviderConfig>;
    return {
      baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
      model:
        typeof raw.model === 'string' && raw.model.trim()
          ? raw.model
          : DEFAULT_CODEX_CONFIG.model,
      command:
        typeof raw.command === 'string' && raw.command.trim()
          ? raw.command
          : DEFAULT_CODEX_CONFIG.command,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    };
  } catch {
    return { ...DEFAULT_CODEX_CONFIG };
  }
}

export function toPublicCodexProviderConfig(
  config: CodexProviderConfig,
): CodexProviderPublicConfig {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    command: config.command || DEFAULT_CODEX_CONFIG.command,
    updatedAt: config.updatedAt,
    hasApiKey: !!config.apiKey,
    apiKeyMasked: maskSecret(config.apiKey),
  };
}

export function saveCodexProviderConfig(
  next: Omit<CodexProviderConfig, 'updatedAt'>,
): CodexProviderConfig {
  const config: CodexProviderConfig = {
    baseUrl: sanitizeValue(next.baseUrl),
    apiKey: sanitizeValue(next.apiKey),
    model: sanitizeValue(next.model) || DEFAULT_CODEX_CONFIG.model,
    command: sanitizeValue(next.command || '') || DEFAULT_CODEX_CONFIG.command,
    updatedAt: new Date().toISOString(),
  };
  const errors = validateCodexProviderConfig(config);
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CODEX_CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, CODEX_CONFIG_FILE);
  return config;
}

function readLocalCodexAuth(): { apiKey: string | null } {
  const authPath = path.join(process.env.HOME || '/root', '.codex', 'auth.json');
  try {
    if (!fs.existsSync(authPath)) return { apiKey: null };
    const raw = JSON.parse(fs.readFileSync(authPath, 'utf-8')) as Record<string, unknown>;
    const apiKey =
      typeof raw.OPENAI_API_KEY === 'string' ? raw.OPENAI_API_KEY.trim() : null;
    return { apiKey: apiKey || null };
  } catch {
    return { apiKey: null };
  }
}

function parseTomlString(content: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^${escaped}\\s*=\\s*\"([^\"]*)\"`, 'm'));
  return match?.[1]?.trim() || null;
}

function readLocalCodexConfigToml(): { baseUrl: string | null; model: string | null } {
  const configPath = path.join(process.env.HOME || '/root', '.codex', 'config.toml');
  try {
    if (!fs.existsSync(configPath)) return { baseUrl: null, model: null };
    const content = fs.readFileSync(configPath, 'utf-8');
    const provider = parseTomlString(content, 'model_provider');
    const model = parseTomlString(content, 'model');
    let baseUrl: string | null = null;
    if (provider) {
      const sectionMatch = content.match(
        new RegExp(`\\[model_providers\\.${provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]([\\s\\S]*?)(?:\\n\\[|$)`),
      );
      if (sectionMatch?.[1]) {
        baseUrl = parseTomlString(sectionMatch[1], 'base_url');
      }
    }
    return { baseUrl, model };
  } catch {
    return { baseUrl: null, model: null };
  }
}

export function detectLocalCodex(): LocalCodexStatus {
  const { apiKey } = readLocalCodexAuth();
  const { baseUrl, model } = readLocalCodexConfigToml();
  const codexDir = path.join(process.env.HOME || '/root', '.codex');
  const detected = fs.existsSync(codexDir);
  return {
    detected,
    hasApiKey: !!apiKey,
    apiKeyMasked: apiKey ? maskSecret(apiKey) : null,
    baseUrl,
    model,
  };
}

export function importLocalCodexConfig(): Omit<CodexProviderConfig, 'updatedAt'> | null {
  const { apiKey } = readLocalCodexAuth();
  const { baseUrl, model } = readLocalCodexConfigToml();
  if (!apiKey) return null;
  return {
    baseUrl: baseUrl || '',
    apiKey,
    model: model || DEFAULT_CODEX_CONFIG.model,
    command: DEFAULT_CODEX_CONFIG.command,
  };
}

export function writeCodexAuthFile(
  codexDir: string,
  apiKey: string,
): void {
  fs.mkdirSync(codexDir, { recursive: true });
  const filePath = path.join(codexDir, 'auth.json');
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        auth_mode: 'apikey',
        OPENAI_API_KEY: apiKey,
      },
      null,
      2,
    ) + '\n',
    { encoding: 'utf-8', mode: 0o600 },
  );
  fs.renameSync(tmp, filePath);
}

export function writeCodexConfigFile(
  codexDir: string,
  config: CodexProviderConfig,
  options?: {
    sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
  },
): void {
  fs.mkdirSync(codexDir, { recursive: true });
  const providerId = 'happyclaw';
  const lines: string[] = [
    'approval_policy = "never"',
    `sandbox_mode = "${options?.sandboxMode || 'workspace-write'}"`,
    `model = "${config.model || DEFAULT_CODEX_CONFIG.model}"`,
  ];

  if (config.baseUrl) {
    lines.push(`model_provider = "${providerId}"`);
    lines.push('');
    lines.push(`[model_providers.${providerId}]`);
    lines.push('name = "OpenAI"');
    lines.push(`base_url = "${config.baseUrl}"`);
    lines.push('wire_api = "responses"');
  }

  const filePath = path.join(codexDir, 'config.toml');
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, `${lines.join('\n')}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.renameSync(tmp, filePath);
}
