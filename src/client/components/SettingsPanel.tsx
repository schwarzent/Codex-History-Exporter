import { FormEvent, useEffect, useState } from 'react';
import type { SettingsResponse } from '../../shared/types';

interface SettingsPanelProps {
  settings: SettingsResponse;
  busy: boolean;
  onRebuild: () => Promise<void>;
  onSaveDataDir: (dataDir: string) => Promise<void>;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [dataDir, setDataDir] = useState(props.settings.settings.dataDir ?? '');

  useEffect(() => {
    setDataDir(props.settings.settings.dataDir ?? '');
  }, [props.settings.settings.dataDir]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onSaveDataDir(dataDir.trim());
  }

  return (
    <section className="panel utility-panel">
      <div className="panel-header">
        <div>
          <h2>设置</h2>
          <p className="muted">数据目录与索引状态</p>
        </div>
      </div>
      <form className="utility-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>数据目录</span>
          <input value={dataDir} onChange={(event) => setDataDir(event.target.value)} />
        </label>
        <div className="button-row">
          <button className="primary-button" disabled={props.busy} type="submit">
            保存目录
          </button>
          <button
            className="secondary-button"
            disabled={props.busy}
            onClick={() => void props.onRebuild()}
            type="button"
          >
            重建索引
          </button>
        </div>
      </form>
      <dl className="stats-grid">
        <div>
          <dt>数据库体积</dt>
          <dd>{formatBytes(props.settings.storage.databaseBytes)}</dd>
        </div>
        <div>
          <dt>会话数</dt>
          <dd>{props.settings.storage.sessionCount}</dd>
        </div>
        <div>
          <dt>错误数</dt>
          <dd>{props.settings.storage.errorCount}</dd>
        </div>
        <div>
          <dt>最后同步</dt>
          <dd>{props.settings.storage.lastSyncedAt ?? '尚未同步'}</dd>
        </div>
      </dl>
    </section>
  );
}
