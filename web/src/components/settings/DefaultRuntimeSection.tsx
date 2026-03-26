import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SettingsNotification } from './types';
import { api } from '../../api/client';
import { getErrorMessage } from './types';

interface DefaultRuntimeSectionProps extends SettingsNotification {
  compact?: boolean;
}

export function DefaultRuntimeSection({
  setNotice,
  setError,
  compact = false,
}: DefaultRuntimeSectionProps) {
  const [runtime, setRuntime] = useState<'claude' | 'codex'>('claude');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ defaultRuntime: 'claude' | 'codex' }>('/api/config/runtime-default')
      .then((data) => setRuntime(data.defaultRuntime))
      .catch((err) =>
        setError(getErrorMessage(err, '加载默认 Runtime 配置失败')),
      )
      .finally(() => setLoading(false));
  }, [setError]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const result = await api.put<{
        defaultRuntime: 'claude' | 'codex';
        updatedJids: string[];
      }>('/api/config/runtime-default', {
        defaultRuntime: runtime,
      });
      setRuntime(result.defaultRuntime);
      setNotice(
        `默认 Runtime 已切换为 ${result.defaultRuntime === 'codex' ? 'Codex' : 'Claude'}，并同步更新了 ${result.updatedJids.length} 个主工作区/IM 默认会话。`,
      );
    } catch (err) {
      setError(getErrorMessage(err, '保存默认 Runtime 失败'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        正在加载默认 Runtime...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">默认主工作区 Runtime</h2>
          <p className="text-sm text-muted-foreground">
            新建用户主工作区、飞书/Telegram/QQ 默认会话会优先跟随这里的设置。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRuntime('claude')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            runtime === 'claude'
              ? 'border-primary bg-brand-50'
              : 'border-border hover:bg-accent/40'
          }`}
        >
          <div className="text-sm font-medium">Claude</div>
          <p className="text-xs text-muted-foreground mt-1">
            默认沿用 Claude Code 处理主工作区和 IM 默认对话
          </p>
        </button>
        <button
          type="button"
          onClick={() => setRuntime('codex')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            runtime === 'codex'
              ? 'border-primary bg-brand-50'
              : 'border-border hover:bg-accent/40'
          }`}
        >
          <div className="text-sm font-medium">Codex</div>
          <p className="text-xs text-muted-foreground mt-1">
            默认改为由 Codex 处理主工作区和 IM 默认对话
          </p>
        </button>
      </div>

      {!compact && (
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            保存默认 Runtime
          </Button>
        </div>
      )}
    </div>
  );
}
