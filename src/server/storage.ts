import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '../shared/types.js';

const DATABASE_FILE_NAME = 'codex-history.sqlite';

export interface StoragePaths {
  databasePath: string | null;
  exportPath: string | null;
}

export function resolveStoragePaths(settings: AppSettings): StoragePaths {
  if (!settings.dataDir) {
    return {
      databasePath: null,
      exportPath: null,
    };
  }

  return {
    databasePath: path.join(settings.dataDir, DATABASE_FILE_NAME),
    exportPath: path.join(settings.dataDir, settings.exportDirName),
  };
}

export function ensureStorageLayout(settings: AppSettings) {
  if (!settings.dataDir) {
    throw new Error('尚未设置数据目录');
  }

  fs.mkdirSync(settings.dataDir, { recursive: true });
  const paths = resolveStoragePaths(settings);
  if (paths.exportPath) {
    fs.mkdirSync(paths.exportPath, { recursive: true });
  }

  return paths;
}

export function readFileSize(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) {
    return 0;
  }

  return fs.statSync(filePath).size;
}
