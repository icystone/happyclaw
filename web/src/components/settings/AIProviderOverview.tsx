import { useEffect, useState } from 'react';
import { Bot, Cpu, ShieldCheck } from 'lucide-react';

import { api } from '../../api/client';
import type {
  ClaudeConfigPublic,
  CodexConfigPublic,
  SettingsNotification,
} from './types';
import { getErrorMessage } from './types';

interface AIProviderOverviewProps extends SettingsNotification {}

function getClaudeStatusLabel(config: ClaudeConfigPublic | null): string {
  if (!config) return '加载中';
  if (config.hasClaudeOAuthCredentials) return '官方 OAuth';
  if (config.hasClaudeCodeOauthToken) return '官方 setup-token';
  if (config.hasAnthropicAuthToken && config.anthropicBaseUrl) return '第三方网关';
  return '未配置';
}

function getCodexStatusLabel(config: CodexConfigPublic | null): string {
  if (!config) return '加载中';
  return config.hasApiKey ? '已配置' : '未配置';
}

export function AIProviderOverview({
  setError,
}: AIProviderOverviewProps) {
  const [defaultRuntime, setDefaultRuntime] = useState<'claude' | 'codex'>('claude');
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfigPublic | null>(null);
  const [codexConfig, setCodexConfig] = useState<CodexConfigPublic | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ defaultRuntime: 'claude' | 'codex' }>('/api/config/runtime-default'),
      api.get<ClaudeConfigPublic>('/api/config/claude'),
      api.get<CodexConfigPublic>('/api/config/codex'),
    ])
      .then(([runtimeData, claudeData, codexData]) => {
        setDefaultRuntime(runtimeData.defaultRuntime);
        setClaudeConfig(claudeData);
        setCodexConfig(codexData);
      })
      .catch((err) => {
        setError(getErrorMessage(err, '加载 AI 提供商总览失败'));
      });
  }, [setError]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-brand-50 text-primary">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI 提供商总览</h2>
          <p className="text-sm text-muted-foreground mt-1">
            先看默认策略，再分别管理 Claude 和 Codex 的接入状态。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3.5 h-3.5" />
            默认 Runtime
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {defaultRuntime === 'codex' ? 'Codex' : 'Claude'}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            Claude Runtime
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {getClaudeStatusLabel(claudeConfig)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3.5 h-3.5" />
            Codex Runtime
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {getCodexStatusLabel(codexConfig)}
          </div>
        </div>
      </div>
    </div>
  );
}
