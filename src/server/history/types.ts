import type {
  ImportDiagnostic,
  SessionSource,
  SessionSummary,
  TimelineItem,
} from '../../shared/types.js';

export interface SessionFile {
  source: SessionSource;
  filePath: string;
  fileMtimeMs: number;
  fileSize: number;
}

export interface ParsedSession {
  source: SessionSource;
  filePath: string;
  fileMtimeMs: number;
  fileSize: number;
  summary: SessionSummary;
  timeline: TimelineItem[];
  diagnostics: ImportDiagnostic[];
}

export interface SourceDirectory {
  source: SessionSource;
  dirPath: string;
}
