import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '../shared/types.js';

const CONFIG_FILE_NAME = 'config.local.json';
const DEFAULT_EXPORT_DIR = 'exports';

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { dataDir: null, exportDirName: DEFAULT_EXPORT_DIR };
  }

  const record = value as Record<string, unknown>;
  return {
    dataDir: typeof record.dataDir === 'string' ? record.dataDir : null,
    exportDirName:
      typeof record.exportDirName === 'string' ? record.exportDirName : DEFAULT_EXPORT_DIR,
  };
}

export function getConfigPath() {
  return process.env.CODEX_HISTORY_VIEWER_CONFIG ?? path.resolve(process.cwd(), CONFIG_FILE_NAME);
}

export function loadSettings() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { dataDir: null, exportDirName: DEFAULT_EXPORT_DIR };
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  return normalizeSettings(JSON.parse(raw));
}

export function saveSettings(settings: AppSettings) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return settings;
}
