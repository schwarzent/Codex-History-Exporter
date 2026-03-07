import { useEffect, useMemo, useState } from 'react';
import type {
  ExportResponse,
  ImportDiagnostic,
  SessionDetail,
  SessionSummary,
  SettingsResponse,
} from '../shared/types';
import {
  exportSession,
  getDiagnostics,
  getSessionDetail,
  getSettings,
  listSessions,
  rebuildIndex,
  setDataDir,
  type SessionFilters,
} from './api';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { SessionDetailView } from './components/SessionDetail';
import { SessionList } from './components/SessionList';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupScreen } from './components/SetupScreen';

const DEFAULT_FILTERS: SessionFilters = {
  q: '',
  cwd: '',
  source: '',
  from: '',
  to: '',
};

export function App() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

  useEffect(() => {
    void refreshSettings();
  }, []);

  useEffect(() => {
    if (!settings?.settings.dataDir) {
      return;
    }

    void refreshSessions();
    void refreshDiagnostics();
  }, [settings, filters]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    void getSessionDetail(selectedId)
      .then((nextDetail) => {
        setDetail(nextDetail);
        setExportResult(null);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const currentDataDir = useMemo(() => settings?.settings.dataDir ?? '', [settings]);

  async function refreshSettings() {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const nextSettings = await getSettings();
      setSettings(nextSettings);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '读取设置失败');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function refreshSessions() {
    setSessionsLoading(true);
    try {
      const nextSessions = await listSessions(filters);
      setSessions(nextSessions.items);
      setTotal(nextSessions.total);
      setSelectedId((current) => {
        if (current && nextSessions.items.some((item) => item.id === current)) {
          return current;
        }

        return nextSessions.items[0]?.id ?? null;
      });
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '加载会话失败');
    } finally {
      setSessionsLoading(false);
    }
  }

  async function refreshDiagnostics() {
    try {
      const nextDiagnostics = await getDiagnostics();
      setDiagnostics(nextDiagnostics.items);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '读取诊断失败');
    }
  }

  async function handleSaveDataDir(dataDir: string) {
    setSettingsError(null);
    setSettingsLoading(true);
    try {
      const nextSettings = await setDataDir(dataDir);
      setSettings(nextSettings);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '保存目录失败');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleRebuild() {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      await rebuildIndex();
      await refreshSettings();
      await refreshSessions();
      await refreshDiagnostics();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '重建索引失败');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleExport(
    sessionId: string,
    format: 'markdown' | 'html' | 'messageonly',
    targetPath?: string,
  ) {
    setExportBusy(true);
    setSettingsError(null);
    try {
      const result = await exportSession(sessionId, format, targetPath);
      setExportResult(result);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExportBusy(false);
    }
  }

  if (settingsLoading && !settings) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Codex History Viewer</h1>
          <p className="muted">正在读取本地配置…</p>
        </section>
      </main>
    );
  }

  if (!settings?.settings.dataDir) {
    return (
      <SetupScreen
        error={settingsError}
        initialValue={currentDataDir}
        loading={settingsLoading}
        onSubmit={handleSaveDataDir}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Codex History Viewer</h1>
          <p className="muted">
            数据目录：{settings.settings.dataDir} · 已索引 {settings.storage.sessionCount} 条
          </p>
        </div>
        <button className="secondary-button" onClick={() => void refreshSessions()} type="button">
          刷新列表
        </button>
      </header>

      <section className="filters">
        <label className="field">
          <span>关键词</span>
          <input
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="搜索消息、工具输出、推理"
          />
        </label>
        <label className="field">
          <span>工作目录</span>
          <input
            value={filters.cwd}
            onChange={(event) => setFilters((current) => ({ ...current, cwd: event.target.value }))}
            placeholder="例如 D:\dev"
          />
        </label>
        <label className="field">
          <span>来源</span>
          <select
            value={filters.source}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                source: event.target.value as SessionFilters['source'],
              }))
            }
          >
            <option value="">全部</option>
            <option value="sessions">sessions</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="field">
          <span>起始日期</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>结束日期</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
      </section>

      {settingsError ? <p className="error-banner">{settingsError}</p> : null}

      <section className="utility-grid">
        <SettingsPanel
          busy={settingsLoading}
          onRebuild={handleRebuild}
          onSaveDataDir={handleSaveDataDir}
          settings={settings}
        />
        <DiagnosticsPanel items={diagnostics} />
      </section>

      <section className="layout">
        <SessionList
          items={sessions}
          loading={sessionsLoading}
          onSelect={setSelectedId}
          selectedId={selectedId}
          total={total}
        />
        <SessionDetailView
          detail={detail}
          exportBusy={exportBusy}
          exportResult={exportResult}
          loading={detailLoading}
          onExport={handleExport}
        />
      </section>
    </main>
  );
}
