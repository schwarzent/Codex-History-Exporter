import type {
  DiagnosticsResponse,
  ExportResponse,
  SessionDetail,
  SessionsResponse,
  SettingsResponse,
} from '../shared/types';

export interface SessionFilters {
  q: string;
  cwd: string;
  source: '' | 'sessions' | 'archived';
  from: string;
  to: string;
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `请求失败：${response.status}`);
  }

  return (await response.json()) as T;
}

export function getSettings() {
  return fetchJson<SettingsResponse>('/api/settings');
}

export function setDataDir(dataDir: string) {
  return fetchJson<SettingsResponse>('/api/settings/data-dir', {
    method: 'POST',
    body: JSON.stringify({ dataDir }),
  });
}

export function listSessions(filters: SessionFilters) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }

  if (filters.cwd) {
    params.set('cwd', filters.cwd);
  }

  if (filters.source) {
    params.set('source', filters.source);
  }

  if (filters.from) {
    params.set('from', filters.from);
  }

  if (filters.to) {
    params.set('to', filters.to);
  }

  return fetchJson<SessionsResponse>(`/api/sessions?${params.toString()}`);
}

export function getSessionDetail(sessionId: string) {
  return fetchJson<SessionDetail>(`/api/sessions/${sessionId}`);
}

export function rebuildIndex() {
  return fetchJson<{ storage: SettingsResponse['storage'] }>('/api/index/rebuild', {
    method: 'POST',
  });
}

export function getDiagnostics() {
  return fetchJson<DiagnosticsResponse>('/api/diagnostics');
}

export function exportSession(
  sessionId: string,
  format: 'markdown' | 'html' | 'messageonly',
  targetPath?: string,
) {
  return fetchJson<ExportResponse>(`/api/sessions/${sessionId}/export`, {
    method: 'POST',
    body: JSON.stringify({ format, targetPath }),
  });
}
