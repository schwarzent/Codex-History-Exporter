import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SourceDirectory, SessionFile } from './types.js';

const SESSION_FILE_PATTERN = /^rollout-.*\.jsonl$/i;

function readDirectoryRecursively(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return readDirectoryRecursively(entryPath);
    }

    return SESSION_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

export function getCodexHome() {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
}

export function resolveSourceDirectories(): SourceDirectory[] {
  const codexHome = getCodexHome();

  return [
    { source: 'sessions', dirPath: path.join(codexHome, 'sessions') },
    { source: 'archived', dirPath: path.join(codexHome, 'archived_sessions') },
  ];
}

export function scanSessionFiles() {
  return resolveSourceDirectories().flatMap<SessionFile>((sourceDirectory) => {
    if (!fs.existsSync(sourceDirectory.dirPath)) {
      return [];
    }

    return readDirectoryRecursively(sourceDirectory.dirPath).map((filePath) => {
      const stats = fs.statSync(filePath);

      return {
        source: sourceDirectory.source,
        filePath,
        fileMtimeMs: Math.trunc(stats.mtimeMs),
        fileSize: stats.size,
      };
    });
  });
}
