import type { ImportDiagnostic } from '../../shared/types';

interface DiagnosticsPanelProps {
  items: ImportDiagnostic[];
}

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  return (
    <section className="panel utility-panel">
      <div className="panel-header">
        <div>
          <h2>诊断</h2>
          <p className="muted">解析失败文件与异常行</p>
        </div>
      </div>
      <div className="diagnostic-list">
        {props.items.length === 0 ? (
          <p className="empty-state">当前没有解析错误。</p>
        ) : (
          props.items.map((item) => (
            <article key={`${item.filePath}-${item.lineNumber ?? 'na'}`} className="diagnostic-item">
              <strong>{item.filePath}</strong>
              <span>行号：{item.lineNumber ?? '未知'}</span>
              <p>{item.message}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
