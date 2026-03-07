import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSessionFile } from '../src/server/history/parser.js';
import type { SessionFile } from '../src/server/history/types.js';

function createSessionFile(fileName: string): SessionFile {
  const filePath = path.resolve('tests/fixtures', fileName);
  const stats = fs.statSync(filePath);

  return {
    source: 'sessions',
    filePath,
    fileMtimeMs: Math.trunc(stats.mtimeMs),
    fileSize: stats.size,
  };
}

describe('parseSessionFile', () => {
  it('parses Codex transcript into summary and timeline', () => {
    const parsed = parseSessionFile(createSessionFile('sample-session.jsonl'));

    expect(parsed.summary.id).toBe('session-123');
    expect(parsed.summary.cliVersion).toBe('0.107.0');
    expect(parsed.summary.cwd).toBe('D:\\dev\\Codex-History-Exporter');
    expect(parsed.summary.title).toContain('帮我做一个查看历史记录的项目');
    expect(parsed.timeline).toHaveLength(7);
    expect(parsed.timeline[0]?.kind).toBe('user_message');
    expect(parsed.timeline[2]?.kind).toBe('assistant_reasoning');
    expect(parsed.timeline[3]?.kind).toBe('assistant_message');
    expect(parsed.timeline[4]?.kind).toBe('tool_call');
    expect(parsed.timeline[5]?.kind).toBe('tool_output');
    expect(parsed.timeline[6]?.kind).toBe('assistant_reasoning');
    expect(parsed.diagnostics).toHaveLength(0);
  });

  it('surfaces invalid json as diagnostics', () => {
    const parsed = parseSessionFile(createSessionFile('invalid-session.jsonl'));

    expect(parsed.summary.id).toBe('broken-session');
    expect(parsed.diagnostics).toHaveLength(1);
    expect(parsed.diagnostics[0]?.lineNumber).toBe(2);
    expect(parsed.summary.hasErrors).toBe(true);
  });
});
