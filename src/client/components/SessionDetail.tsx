import { FormEvent, useMemo, useState } from 'react';
import type { ExportResponse, SessionDetail, TimelineItem } from '../../shared/types';

type DetailTab = 'timeline' | 'raw';

interface SessionDetailProps {
  detail: SessionDetail | null;
  exportBusy: boolean;
  exportResult: ExportResponse | null;
  loading: boolean;
  onExport: (
    sessionId: string,
    format: 'markdown' | 'html',
    targetPath?: string,
  ) => Promise<void>;
}

function renderTimestamp(value: string | null) {
  if (!value) {
    return '无时间戳';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function timelineClassName(item: TimelineItem) {
  return `timeline-item timeline-${item.kind}`;
}

export function SessionDetailView(props: SessionDetailProps) {
  const [tab, setTab] = useState<DetailTab>('timeline');
  const [format, setFormat] = useState<'markdown' | 'html'>('markdown');
  const [targetPath, setTargetPath] = useState('');

  const rawJson = useMemo(() => {
    if (!props.detail) {
      return '';
    }

    return JSON.stringify(
      props.detail.timeline.map((item) => ({
        seq: item.seq,
        title: item.title,
        rawPayload: JSON.parse(item.rawPayload),
      })),
      null,
      2,
    );
  }, [props.detail]);

  if (props.loading) {
    return (
      <section className="panel detail-panel">
        <p className="empty-state">正在加载详情…</p>
      </section>
    );
  }

  if (!props.detail) {
    return (
      <section className="panel detail-panel">
        <p className="empty-state">选择左侧会话后显示详情。</p>
      </section>
    );
  }

  const detail = props.detail;

  async function handleExport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onExport(detail.summary.id, format, targetPath.trim() || undefined);
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-header detail-header">
        <div>
          <h2>{detail.summary.title}</h2>
          <p className="muted">{detail.summary.cwd ?? '未知工作目录'}</p>
        </div>
        <div className="segmented-control">
          <button
            className={tab === 'timeline' ? 'active' : ''}
            onClick={() => setTab('timeline')}
            type="button"
          >
            时间线
          </button>
          <button
            className={tab === 'raw' ? 'active' : ''}
            onClick={() => setTab('raw')}
            type="button"
          >
            原始 JSON
          </button>
        </div>
      </div>

      <form className="export-form" onSubmit={handleExport}>
        <label className="field">
          <span>导出格式</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as 'markdown' | 'html')}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </label>
        <label className="field export-target">
          <span>目标路径（可选）</span>
          <input
            placeholder="留空则写入数据目录 exports/"
            value={targetPath}
            onChange={(event) => setTargetPath(event.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={props.exportBusy} type="submit">
          {props.exportBusy ? '导出中…' : '导出当前会话'}
        </button>
      </form>

      {props.exportResult ? (
        <p className="success-banner">已导出到：{props.exportResult.filePath}</p>
      ) : null}

      {detail.diagnostics.length > 0 ? (
        <div className="session-diagnostics">
          <strong>当前会话诊断</strong>
          {detail.diagnostics.map((item) => (
            <p key={`${item.filePath}-${item.lineNumber ?? 'na'}`}>
              {item.filePath} · 行 {item.lineNumber ?? '未知'} · {item.message}
            </p>
          ))}
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div className="timeline">
          {detail.timeline.map((item) => (
            <article key={`${item.seq}-${item.title}`} className={timelineClassName(item)}>
              <div className="timeline-meta">
                <span>{item.title}</span>
                <span>{renderTimestamp(item.timestamp)}</span>
              </div>
              {item.textContent ? <pre>{item.textContent}</pre> : <p className="muted">无文本内容</p>}
            </article>
          ))}
        </div>
      ) : (
        <pre className="raw-view">{rawJson}</pre>
      )}
    </section>
  );
}
