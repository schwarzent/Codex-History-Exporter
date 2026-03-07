import path from 'node:path';
import type {
  AppSettings,
  ExportResponse,
  SessionDetail,
  SessionsResponse,
  SettingsResponse,
} from '../../shared/types.js';
import { loadSettings, saveSettings } from '../config.js';
import { exportSessionDetail } from '../exporter.js';
import { parseSessionFile } from '../history/parser.js';
import { scanSessionFiles } from '../history/scanner.js';
import { HistoryRepository } from '../index/repository.js';
import { ensureStorageLayout, resolveStoragePaths } from '../storage.js';

interface ListSessionOptions {
  q?: string;
  cwd?: string;
  source?: 'sessions' | 'archived';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function normalizeDateBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value) {
    return undefined;
  }

  const plainDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!plainDatePattern.test(value)) {
    return value;
  }

  return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

function openRepository(settings: AppSettings) {
  const paths = ensureStorageLayout(settings);
  if (!paths.databasePath) {
    throw new ConfigurationError('尚未设置数据目录');
  }

  return {
    repository: new HistoryRepository(paths.databasePath),
    storagePaths: paths,
  };
}

function buildSettingsResponse(settings: AppSettings): SettingsResponse {
  const paths = resolveStoragePaths(settings);
  if (!paths.databasePath) {
    return {
      settings,
      storage: {
        databasePath: null,
        exportPath: null,
        databaseBytes: 0,
        sessionCount: 0,
        lastSyncedAt: null,
        errorCount: 0,
      },
    };
  }

  const { repository, storagePaths } = openRepository(settings);
  try {
    return {
      settings,
      storage: repository.getStorageStats(storagePaths.exportPath),
    };
  } finally {
    repository.close();
  }
}

export function initializeHistoryState() {
  const settings = loadSettings();
  if (!settings.dataDir) {
    return buildSettingsResponse(settings);
  }

  rebuildIndex(false);
  return buildSettingsResponse(settings);
}

export function getSettings() {
  return buildSettingsResponse(loadSettings());
}

export function setDataDir(dataDir: string) {
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw new ConfigurationError('数据目录必须是绝对路径');
  }

  const settings = saveSettings({
    ...loadSettings(),
    dataDir: path.resolve(dataDir),
  });

  rebuildIndex(true);
  return buildSettingsResponse(settings);
}

export function rebuildIndex(force: boolean) {
  const settings = loadSettings();
  const { repository } = openRepository(settings);

  try {
    if (force) {
      repository.clearAll();
    }

    const trackedFiles = repository.getTrackedFiles();
    const sessionFiles = scanSessionFiles();
    const seenPaths = new Set(sessionFiles.map((file) => file.filePath));

    sessionFiles.forEach((file) => {
      const tracked = trackedFiles.get(file.filePath);
      const isCurrent =
        tracked &&
        tracked.file_mtime_ms === file.fileMtimeMs &&
        tracked.file_size === file.fileSize;

      if (!force && isCurrent) {
        return;
      }

      repository.replaceSession(parseSessionFile(file));
    });

    trackedFiles.forEach((_value, filePath) => {
      if (!seenPaths.has(filePath)) {
        repository.removeFile(filePath);
      }
    });

    repository.setLastSyncedAt(new Date().toISOString());
    return repository.getStorageStats(resolveStoragePaths(settings).exportPath);
  } finally {
    repository.close();
  }
}

export function listSessions(options: ListSessionOptions): SessionsResponse {
  const settings = loadSettings();
  if (!settings.dataDir) {
    return { items: [], total: 0 };
  }

  const { repository } = openRepository(settings);
  try {
    return repository.listSessions({
      q: options.q,
      cwd: options.cwd,
      source: options.source,
      from: normalizeDateBoundary(options.from, false),
      to: normalizeDateBoundary(options.to, true),
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 50,
    });
  } finally {
    repository.close();
  }
}

export function getSessionDetail(sessionId: string): SessionDetail | null {
  const settings = loadSettings();
  if (!settings.dataDir) {
    return null;
  }

  const { repository } = openRepository(settings);
  try {
    return repository.getSessionDetail(sessionId);
  } finally {
    repository.close();
  }
}

export function getDiagnostics() {
  const settings = loadSettings();
  if (!settings.dataDir) {
    return { items: [] };
  }

  const { repository } = openRepository(settings);
  try {
    return repository.getDiagnostics();
  } finally {
    repository.close();
  }
}

export function exportSession(
  sessionId: string,
  format: 'markdown' | 'html',
  targetPath?: string,
): ExportResponse {
  const settings = loadSettings();
  const { repository, storagePaths } = openRepository(settings);

  try {
    const detail = repository.getSessionDetail(sessionId);
    if (!detail) {
      throw new ConfigurationError('未找到对应会话');
    }

    const defaultExtension = format === 'markdown' ? 'md' : 'html';
    const resolvedPath =
      targetPath && targetPath.trim()
        ? path.isAbsolute(targetPath)
          ? targetPath
          : (() => {
              throw new ConfigurationError('导出路径必须是绝对路径');
            })()
        : path.join(storagePaths.exportPath ?? settings.dataDir ?? process.cwd(), `${sessionId}.${defaultExtension}`);

    return exportSessionDetail(detail, resolvedPath, format);
  } finally {
    repository.close();
  }
}
