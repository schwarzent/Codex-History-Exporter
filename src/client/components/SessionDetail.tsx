import { useMemo, useState } from 'react';
import type { SessionDetail, TimelineItem } from '../../shared/types';

type DetailTab = 'timeline' | 'raw';

interface SessionDetailProps {
  detail: SessionDetail | null;
  loading: boolean;
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

  return (
    <section className="panel detail-panel">
      <div className="panel-header detail-header">
        <div>
          <h2>{props.detail.summary.title}</h2>
          <p className="muted">{props.detail.summary.cwd ?? '未知工作目录'}</p>
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

      {tab === 'timeline' ? (
        <div className="timeline">
          {props.detail.timeline.map((item) => (
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
