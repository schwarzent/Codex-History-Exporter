import type { SessionSummary } from '../../shared/types';

interface SessionListProps {
  items: SessionSummary[];
  loading: boolean;
  selectedId: string | null;
  total: number;
  onSelect: (sessionId: string) => void;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function SessionList(props: SessionListProps) {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <div>
          <h2>会话列表</h2>
          <p className="muted">共 {props.total} 条</p>
        </div>
      </div>
      <div className="session-list">
        {props.loading ? <p className="empty-state">正在加载会话…</p> : null}
        {!props.loading && props.items.length === 0 ? (
          <p className="empty-state">当前筛选条件下没有结果。</p>
        ) : null}
        {props.items.map((item) => (
          <button
            key={item.id}
            className={`session-item${props.selectedId === item.id ? ' active' : ''}`}
            onClick={() => props.onSelect(item.id)}
            type="button"
          >
            <div className="session-item-top">
              <strong>{item.title}</strong>
              {item.hasErrors ? <span className="pill warning">有错误</span> : null}
            </div>
            <div className="session-item-meta">
              <span>{formatTime(item.lastUpdatedAt)}</span>
              <span>{item.source}</span>
            </div>
            <p className="session-item-cwd">{item.cwd ?? '未知工作目录'}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
