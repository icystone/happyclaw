import { useCallback, useEffect, useMemo, useState } from 'react';
import { HardDrive, Loader2, RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '../../api/client';
import type { CodexConfigPublic, SettingsNotification } from './types';
import { getErrorMessage } from './types';

interface CodexProviderSectionProps extends SettingsNotification {}

function formatDateTime(value: string | null): string {
  if (!value) return '未记录';
  return new Date(value).toLocaleString('zh-CN');
}

export function CodexProviderSection({
  setNotice,
  setError,
}: CodexProviderSectionProps) {
  const [config, setConfig] = useState<CodexConfigPublic | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [command, setCommand] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localCodex, setLocalCodex] = useState<{
    detected: boolean;
    hasApiKey: boolean;
    apiKeyMasked: string | null;
    baseUrl: string | null;
    model: string | null;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, localData] = await Promise.all([
        api.get<CodexConfigPublic>('/api/config/codex'),
        api.get<{
          detected: boolean;
          hasApiKey: boolean;
          apiKeyMasked: string | null;
          baseUrl: string | null;
          model: string | null;
        }>('/api/config/codex/detect-local'),
      ]);
      setConfig(configData);
      setBaseUrl(configData.baseUrl || '');
      setModel(configData.model || 'gpt-5.4');
      setCommand(configData.command || 'codex');
      setLocalCodex(localData);
    } catch (err) {
      setError(getErrorMessage(err, '加载 Codex 配置失败'));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updatedAt = useMemo(
    () => formatDateTime(config?.updatedAt ?? null),
    [config?.updatedAt],
  );

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await api.put<CodexConfigPublic>('/api/config/codex', {
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        command: command.trim(),
      });
      if (apiKey.trim()) {
        await api.put<CodexConfigPublic>('/api/config/codex/secrets', {
          apiKey: apiKey.trim(),
        });
        setApiKey('');
      }
      setConfig(saved);
      setNotice('Codex 配置已保存。');
      await loadConfig();
    } catch (err) {
      setError(getErrorMessage(err, '保存 Codex 配置失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleImportLocal = async () => {
    setImporting(true);
    setNotice(null);
    setError(null);
    try {
      await api.post('/api/config/codex/import-local');
      setNotice('已导入本机 Codex 配置。');
      await loadConfig();
    } catch (err) {
      setError(getErrorMessage(err, '导入本机 Codex 配置失败'));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        正在加载 Codex 配置...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Codex Runtime</h2>
          <p className="text-sm text-muted-foreground mt-1">
            使用本机 `codex` CLI 的原生配置格式：`~/.codex/auth.json` 与 `~/.codex/config.toml`。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadConfig}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-sm">
        <div>最近更新：{updatedAt}</div>
        <div>已配置 API Key：{config?.hasApiKey ? `是（${config.apiKeyMasked || '***'}）` : '否'}</div>
      </div>

      {localCodex?.detected && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <HardDrive className="w-4 h-4 mt-0.5 text-emerald-600" />
            <div className="text-sm text-emerald-900">
              <div className="font-medium">检测到本机 Codex 配置</div>
              <div className="mt-1">
                API Key：{localCodex.apiKeyMasked || '未检测到'}；Base URL：
                {localCodex.baseUrl || '默认'}；Model：{localCodex.model || '默认'}
              </div>
            </div>
          </div>
          <Button type="button" size="sm" onClick={handleImportLocal} disabled={importing || !localCodex.hasApiKey}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            一键导入本机配置
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">CLI Command</label>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="codex（仅 Host 模式，支持前缀如 sc codex）"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Host 模式下执行的命令，默认 codex。设为 sc codex 则实际执行 sc codex exec --json ...
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Base URL</label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="留空表示使用 OpenAI 默认地址"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Model</label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 gpt-5.4"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">API Key</label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.hasApiKey ? '留空则保留当前 API Key' : '输入 OPENAI_API_KEY'}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          保存 Codex 配置
        </Button>
      </div>
    </div>
  );
}
