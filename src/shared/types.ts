export type SessionSource = 'sessions' | 'archived';

export type TimelineKind =
  | 'user_message'
  | 'assistant_message'
  | 'developer_message'
  | 'assistant_reasoning'
  | 'tool_call'
  | 'tool_output'
  | 'event';

export interface AppSettings {
  dataDir: string | null;
  exportDirName: string;
}

export interface StorageStats {
  databasePath: string | null;
  exportPath: string | null;
  databaseBytes: number;
  sessionCount: number;
  lastSyncedAt: string | null;
  errorCount: number;
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  lastUpdatedAt: string;
  cwd: string | null;
  source: SessionSource;
  cliVersion: string | null;
  eventCount: number;
  hasErrors: boolean;
  title: string;
}

export interface TimelineItem {
  seq: number;
  timestamp: string | null;
  kind: TimelineKind;
  role: string | null;
  title: string;
  textContent: string | null;
  rawPayload: string;
}

export interface ImportDiagnostic {
  filePath: string;
  lineNumber: number | null;
  severity: 'error' | 'warning';
  message: string;
}

export interface SessionDetail {
  summary: SessionSummary;
  timeline: TimelineItem[];
  rawFilePath: string;
  diagnostics: ImportDiagnostic[];
}

export interface SearchHit {
  sessionId: string;
  timelineSeq: number;
  snippet: string;
  matchedField: string;
}

export interface SessionsResponse {
  items: SessionSummary[];
  total: number;
}

export interface DiagnosticsResponse {
  items: ImportDiagnostic[];
}

export interface SettingsResponse {
  settings: AppSettings;
  storage: StorageStats;
}

export interface ExportResponse {
  filePath: string;
  format: 'markdown' | 'html' | 'messageonly';
}
