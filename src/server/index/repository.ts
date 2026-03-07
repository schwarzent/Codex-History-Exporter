import { DatabaseSync } from 'node:sqlite';
import type {
  DiagnosticsResponse,
  SessionDetail,
  SessionSource,
  SessionsResponse,
  StorageStats,
  TimelineKind,
} from '../../shared/types.js';
import { initializeSchema } from './schema.js';
import type { ParsedSession } from '../history/types.js';
import { readFileSize } from '../storage.js';

interface SessionFilters {
  q?: string;
  cwd?: string;
  source?: SessionSource;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

interface TrackedFileRow {
  file_path: string;
  session_id: string;
  file_mtime_ms: number;
  file_size: number;
}

function mapSummary(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    lastUpdatedAt: String(row.last_updated_at),
    cwd: typeof row.cwd === 'string' ? row.cwd : null,
    source: row.source as SessionSource,
    cliVersion: typeof row.cli_version === 'string' ? row.cli_version : null,
    eventCount: Number(row.event_count),
    hasErrors: Number(row.has_errors) > 0,
    title: String(row.title),
  };
}

function buildMatchExpression(query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/"/g, '""'))
    .filter(Boolean);

  return terms.map((term) => `"${term}"`).join(' AND ');
}

function createWhereClause(filters: SessionFilters, values: Array<string | number>) {
  const conditions: string[] = [];
  if (filters.cwd) {
    conditions.push('s.cwd LIKE ?');
    values.push(`%${filters.cwd}%`);
  }

  if (filters.source) {
    conditions.push('s.source = ?');
    values.push(filters.source);
  }

  if (filters.from) {
    conditions.push('s.started_at >= ?');
    values.push(filters.from);
  }

  if (filters.to) {
    conditions.push('s.started_at <= ?');
    values.push(filters.to);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

export class HistoryRepository {
  private readonly database: DatabaseSync;

  constructor(private readonly databasePath: string) {
    this.database = new DatabaseSync(databasePath, {
      timeout: 3_000,
      enableForeignKeyConstraints: true,
      defensive: true,
    });
    initializeSchema(this.database);
  }

  close() {
    this.database.close();
  }

  clearAll() {
    this.database.exec(`
      DELETE FROM search_index;
      DELETE FROM diagnostics;
      DELETE FROM timeline_items;
      DELETE FROM tracked_files;
      DELETE FROM sessions;
    `);
  }

  getTrackedFiles() {
    const rows = this.database
      .prepare('SELECT file_path, session_id, file_mtime_ms, file_size FROM tracked_files')
      .all() as unknown as TrackedFileRow[];

    return new Map(rows.map((row) => [row.file_path, row]));
  }

  removeFile(filePath: string) {
    const tracked = this.database
      .prepare('SELECT session_id FROM tracked_files WHERE file_path = ?')
      .get(filePath) as { session_id: string } | undefined;

    if (!tracked) {
      return;
    }

    this.database.exec('BEGIN');
    try {
      this.database.prepare('DELETE FROM search_index WHERE session_id = ?').run(tracked.session_id);
      this.database
        .prepare('DELETE FROM diagnostics WHERE session_id = ? OR file_path = ?')
        .run(tracked.session_id, filePath);
      this.database.prepare('DELETE FROM timeline_items WHERE session_id = ?').run(tracked.session_id);
      this.database.prepare('DELETE FROM sessions WHERE id = ?').run(tracked.session_id);
      this.database.prepare('DELETE FROM tracked_files WHERE file_path = ?').run(filePath);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  replaceSession(parsed: ParsedSession) {
    this.removeFile(parsed.filePath);
    this.database.exec('BEGIN');

    try {
      this.database
        .prepare(
          `INSERT INTO sessions (
            id, source, file_path, file_mtime_ms, file_size,
            started_at, last_updated_at, cwd, cli_version,
            event_count, has_errors, title
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          parsed.summary.id,
          parsed.source,
          parsed.filePath,
          parsed.fileMtimeMs,
          parsed.fileSize,
          parsed.summary.startedAt,
          parsed.summary.lastUpdatedAt,
          parsed.summary.cwd,
          parsed.summary.cliVersion,
          parsed.summary.eventCount,
          parsed.summary.hasErrors ? 1 : 0,
          parsed.summary.title,
        );

      const timelineStatement = this.database.prepare(
        `INSERT INTO timeline_items (
          session_id, seq, timestamp, kind, role, title, text_content, raw_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const searchStatement = this.database.prepare(
        `INSERT INTO search_index (session_id, timeline_seq, matched_field, content)
         VALUES (?, ?, ?, ?)`,
      );

      parsed.timeline.forEach((item) => {
        timelineStatement.run(
          parsed.summary.id,
          item.seq,
          item.timestamp,
          item.kind,
          item.role,
          item.title,
          item.textContent,
          item.rawPayload,
        );

        const searchContent = [item.title, item.textContent].filter(Boolean).join('\n');
        if (searchContent) {
          searchStatement.run(parsed.summary.id, String(item.seq), item.kind, searchContent);
        }
      });

      const diagnosticStatement = this.database.prepare(
        `INSERT INTO diagnostics (
          session_id, file_path, line_number, severity, message
        ) VALUES (?, ?, ?, ?, ?)`,
      );

      parsed.diagnostics.forEach((diagnostic) => {
        diagnosticStatement.run(
          parsed.summary.id,
          diagnostic.filePath,
          diagnostic.lineNumber,
          diagnostic.severity,
          diagnostic.message,
        );
      });

      this.database
        .prepare(
          `INSERT INTO tracked_files (
            file_path, session_id, source, file_mtime_ms, file_size
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(file_path) DO UPDATE SET
            session_id = excluded.session_id,
            source = excluded.source,
            file_mtime_ms = excluded.file_mtime_ms,
            file_size = excluded.file_size`,
        )
        .run(
          parsed.filePath,
          parsed.summary.id,
          parsed.source,
          parsed.fileMtimeMs,
          parsed.fileSize,
        );

      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  listSessions(filters: SessionFilters): SessionsResponse {
    const values: Array<string | number> = [];
    const whereClause = createWhereClause(filters, values);
    const limitValues = [...values, filters.pageSize, (filters.page - 1) * filters.pageSize];
    const matchExpression = filters.q ? buildMatchExpression(filters.q) : '';
    const likeExpression = filters.q ? `%${filters.q}%` : '';
    const searchJoin = matchExpression
      ? `JOIN (
           SELECT DISTINCT session_id FROM search_index WHERE search_index MATCH ?
           UNION
           SELECT DISTINCT session_id FROM timeline_items
           WHERE title LIKE ? OR text_content LIKE ?
         ) hits ON hits.session_id = s.id`
      : '';
    const searchValues = matchExpression
      ? [matchExpression, likeExpression, likeExpression]
      : [];
    const selectValues = [...searchValues, ...limitValues];
    const countValues = [...searchValues, ...values];

    const items = this.database
      .prepare(
        `SELECT s.* FROM sessions s
         ${searchJoin}
         ${whereClause}
         ORDER BY s.last_updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...selectValues)
      .map((row) => mapSummary(row as Record<string, unknown>));

    const totalRow = this.database
      .prepare(
        `SELECT COUNT(*) AS total FROM sessions s
         ${searchJoin}
         ${whereClause}`,
      )
      .get(...countValues) as { total: number };

    return {
      items,
      total: Number(totalRow.total),
    };
  }

  getSessionDetail(sessionId: string): SessionDetail | null {
    const summaryRow = this.database
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown> | undefined;

    if (!summaryRow) {
      return null;
    }

    const timeline = this.database
      .prepare(
        `SELECT seq, timestamp, kind, role, title, text_content, raw_payload
         FROM timeline_items
         WHERE session_id = ?
         ORDER BY seq ASC`,
      )
      .all(sessionId)
      .map((row) => ({
        seq: Number((row as Record<string, unknown>).seq),
        timestamp:
          typeof (row as Record<string, unknown>).timestamp === 'string'
            ? String((row as Record<string, unknown>).timestamp)
            : null,
        kind: String((row as Record<string, unknown>).kind) as TimelineKind,
        role:
          typeof (row as Record<string, unknown>).role === 'string'
            ? String((row as Record<string, unknown>).role)
            : null,
        title: String((row as Record<string, unknown>).title),
        textContent:
          typeof (row as Record<string, unknown>).text_content === 'string'
            ? String((row as Record<string, unknown>).text_content)
            : null,
        rawPayload: String((row as Record<string, unknown>).raw_payload),
      }));

    const diagnostics = this.getDiagnostics(sessionId).items;

    return {
      summary: mapSummary(summaryRow),
      timeline,
      rawFilePath: String(summaryRow.file_path),
      diagnostics,
    };
  }

  getDiagnostics(sessionId?: string): DiagnosticsResponse {
    const query = sessionId
      ? 'SELECT file_path, line_number, severity, message FROM diagnostics WHERE session_id = ? ORDER BY file_path, line_number'
      : 'SELECT file_path, line_number, severity, message FROM diagnostics ORDER BY file_path, line_number';
    const rows = this.database
      .prepare(query)
      .all(...(sessionId ? [sessionId] : []))
      .map((row) => ({
        filePath: String((row as Record<string, unknown>).file_path),
        lineNumber:
          typeof (row as Record<string, unknown>).line_number === 'number'
            ? Number((row as Record<string, unknown>).line_number)
            : null,
        severity: ((row as Record<string, unknown>).severity as 'error' | 'warning') ?? 'error',
        message: String((row as Record<string, unknown>).message),
      }));

    return { items: rows };
  }

  getStorageStats(exportPath: string | null): StorageStats {
    const sessionRow = this.database
      .prepare('SELECT COUNT(*) AS count FROM sessions')
      .get() as { count: number };
    const diagnosticRow = this.database
      .prepare('SELECT COUNT(*) AS count FROM diagnostics')
      .get() as { count: number };
    const syncRow = this.database
      .prepare('SELECT value FROM sync_state WHERE key = ?')
      .get('lastSyncedAt') as { value: string } | undefined;

    return {
      databasePath: this.databasePath,
      exportPath,
      databaseBytes: readFileSize(this.databasePath),
      sessionCount: Number(sessionRow.count),
      lastSyncedAt: syncRow?.value ?? null,
      errorCount: Number(diagnosticRow.count),
    };
  }

  setLastSyncedAt(timestamp: string) {
    this.database
      .prepare(
        `INSERT INTO sync_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run('lastSyncedAt', timestamp);
  }
}
