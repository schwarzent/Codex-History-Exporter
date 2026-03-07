import { FormEvent, useState } from 'react';

interface SetupScreenProps {
  initialValue: string;
  loading: boolean;
  error: string | null;
  onSubmit: (dataDir: string) => Promise<void>;
}

export function SetupScreen(props: SetupScreenProps) {
  const [dataDir, setDataDir] = useState(props.initialValue);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onSubmit(dataDir.trim());
  }

  return (
    <main className="shell">
      <section className="card setup-card">
        <div className="card-header">
          <p className="eyebrow">首次启动</p>
          <h1>设置本地数据目录</h1>
        </div>
        <p className="muted">
          查看器不会复制 Codex 原始 JSONL。它只会把索引库与导出文件写入你指定的目录。
        </p>
        <form className="setup-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>数据目录</span>
            <input
              placeholder="例如 D:\CodexHistoryData"
              value={dataDir}
              onChange={(event) => setDataDir(event.target.value)}
            />
          </label>
          {props.error ? <p className="error-text">{props.error}</p> : null}
          <button className="primary-button" disabled={props.loading} type="submit">
            {props.loading ? '正在初始化…' : '保存并建立索引'}
          </button>
        </form>
      </section>
    </main>
  );
}
