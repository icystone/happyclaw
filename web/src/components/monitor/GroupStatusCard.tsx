import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface GroupStatusCardProps {
  group: {
    jid: string;
    runtime?: 'claude' | 'codex';
    active: boolean;
    pendingMessages: boolean;
    pendingTasks: number;
    containerName: string | null;
    displayName: string | null;
  };
}

export function GroupStatusCard({ group }: GroupStatusCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 mr-2">
          <span className="text-sm font-medium text-foreground truncate block">
            {group.jid}
          </span>
          {group.runtime && (
            <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${group.runtime === 'codex' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {group.runtime === 'codex' ? 'Codex' : 'Claude'}
            </span>
          )}
        </div>
        {group.active ? (
          <Badge variant="default" className="bg-success-bg text-success hover:bg-success-bg shrink-0">
            运行中
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            空闲
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>队列</span>
          <span className="text-foreground">
            {group.pendingTasks} 个任务 / {group.pendingMessages ? '有新消息' : '无新消息'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>进程标识</span>
          <span className="text-foreground font-mono truncate ml-2 max-w-[60%] text-right">
            {group.displayName || group.containerName || '-'}
          </span>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
