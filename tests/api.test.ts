import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';

interface TestPaths {
  rootDir: string;
  codexHome: string;
  dataDir: string;
  configPath: string;
}

let testPaths: TestPaths;

function createTempLayout() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-history-viewer-'));
  const codexHome = path.join(rootDir, '.codex');
  const sessionDir = path.join(codexHome, 'sessions', '2026', '03', '07');
  const dataDir = path.join(rootDir, 'viewer-data');
  const configPath = path.join(rootDir, 'config.local.json');

  fs.mkdirSync(sessionDir, { recursive: true });
  fs.copyFileSync(
    path.resolve('tests/fixtures/sample-session.jsonl'),
    path.join(sessionDir, 'rollout-2026-03-07T02-00-00-session-123.jsonl'),
  );
  fs.copyFileSync(
    path.resolve('tests/fixtures/invalid-session.jsonl'),
    path.join(sessionDir, 'rollout-2026-03-07T02-10-00-broken-session.jsonl'),
  );

  return {
    rootDir,
    codexHome,
    dataDir,
    configPath,
  };
}

function cleanupDirectory(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

describe('history api', () => {
  beforeEach(() => {
    testPaths = createTempLayout();
    process.env.CODEX_HOME = testPaths.codexHome;
    process.env.CODEX_HISTORY_VIEWER_CONFIG = testPaths.configPath;
  });

  afterEach(() => {
    delete process.env.CODEX_HOME;
    delete process.env.CODEX_HISTORY_VIEWER_CONFIG;
    cleanupDirectory(testPaths.rootDir);
  });

  it('indexes configured sessions and exposes list/detail endpoints', async () => {
    const app = createApp();

    const initialSettings = await request(app).get('/api/settings');
    expect(initialSettings.status).toBe(200);
    expect(initialSettings.body.settings.dataDir).toBeNull();

    const configured = await request(app)
      .post('/api/settings/data-dir')
      .send({ dataDir: testPaths.dataDir });
    expect(configured.status).toBe(200);
    expect(configured.body.settings.dataDir).toBe(testPaths.dataDir);
    expect(configured.body.storage.sessionCount).toBe(2);
    expect(configured.body.storage.errorCount).toBe(1);

    const sessions = await request(app).get('/api/sessions').query({ q: '查看历史记录' });
    expect(sessions.status).toBe(200);
    expect(sessions.body.total).toBe(1);
    expect(sessions.body.items[0].id).toBe('session-123');

    const detail = await request(app).get('/api/sessions/session-123');
    expect(detail.status).toBe(200);
    expect(detail.body.timeline).toHaveLength(7);
    expect(detail.body.rawFilePath).toContain('rollout-2026-03-07T02-00-00-session-123.jsonl');

    const diagnostics = await request(app).get('/api/diagnostics');
    expect(diagnostics.status).toBe(200);
    expect(diagnostics.body.items).toHaveLength(1);

    const exported = await request(app)
      .post('/api/sessions/session-123/export')
      .send({ format: 'markdown' });
    expect(exported.status).toBe(200);
    expect(exported.body.filePath).toContain('session-123.md');
    expect(fs.existsSync(exported.body.filePath)).toBe(true);
  });
});
