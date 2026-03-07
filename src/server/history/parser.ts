import fs from 'node:fs';
import path from 'node:path';
import type {
  ImportDiagnostic,
  TimelineItem,
} from '../../shared/types.js';
import { collectText, excerpt } from './text.js';
import type { ParsedSession, SessionFile } from './types.js';

type JsonRecord = Record<string, unknown>;

function createDiagnostic(
  filePath: string,
  lineNumber: number | null,
  message: string,
): ImportDiagnostic {
  return {
    filePath,
    lineNumber,
    severity: 'error',
    message,
  };
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readTimestamp(entry: JsonRecord) {
  const direct = typeof entry.timestamp === 'string' ? entry.timestamp : null;
  if (direct) {
    return direct;
  }

  const payload = asRecord(entry.payload);
  return typeof payload?.timestamp === 'string' ? payload.timestamp : null;
}

function readMessageText(payload: JsonRecord) {
  const content = Array.isArray(payload.content) ? payload.content : [];
  const fragments = content.flatMap((block) => collectText(block));
  return fragments.length > 0 ? fragments.join('\n\n') : null;
}

function mapRole(kind: string | null, role: string | null) {
  if (kind === 'assistant_reasoning') {
    return 'assistant';
  }

  return role;
}

function createTimelineItem(
  seq: number,
  timestamp: string | null,
  kind: TimelineItem['kind'],
  role: string | null,
  title: string,
  textContent: string | null,
  rawPayload: unknown,
): TimelineItem {
  return {
    seq,
    timestamp,
    kind,
    role: mapRole(kind, role),
    title,
    textContent,
    rawPayload: JSON.stringify(rawPayload),
  };
}

function fromEventMessage(
  seq: number,
  timestamp: string | null,
  payload: JsonRecord,
): TimelineItem | null {
  const eventType = typeof payload.type === 'string' ? payload.type : null;
  if (!eventType) {
    return null;
  }

  if (eventType === 'user_message') {
    return createTimelineItem(
      seq,
      timestamp,
      'user_message',
      'user',
      '用户消息',
      typeof payload.message === 'string' ? payload.message : null,
      payload,
    );
  }

  if (eventType === 'agent_message') {
    const phase = typeof payload.phase === 'string' ? payload.phase : null;
    const title = phase ? `助手消息 · ${phase}` : '助手消息';
    return createTimelineItem(
      seq,
      timestamp,
      'assistant_message',
      'assistant',
      title,
      typeof payload.message === 'string' ? payload.message : null,
      payload,
    );
  }

  if (eventType === 'agent_reasoning') {
    return createTimelineItem(
      seq,
      timestamp,
      'assistant_reasoning',
      'assistant',
      '助手推理',
      typeof payload.text === 'string' ? payload.text : null,
      payload,
    );
  }

  return createTimelineItem(seq, timestamp, 'event', null, `事件 · ${eventType}`, null, payload);
}

function fromResponseItem(
  seq: number,
  timestamp: string | null,
  payload: JsonRecord,
): TimelineItem | null {
  const payloadType = typeof payload.type === 'string' ? payload.type : null;
  if (!payloadType) {
    return null;
  }

  if (payloadType === 'message') {
    const role = typeof payload.role === 'string' ? payload.role : null;
    const titleMap: Record<string, string> = {
      assistant: '助手输出',
      developer: '开发者消息',
      user: '用户输入',
    };

    return createTimelineItem(
      seq,
      timestamp,
      role === 'user'
        ? 'user_message'
        : role === 'developer'
          ? 'developer_message'
          : 'assistant_message',
      role,
      titleMap[role ?? ''] ?? '消息',
      readMessageText(payload),
      payload,
    );
  }

  if (payloadType === 'reasoning') {
    const fragments = collectText(payload.summary).concat(collectText(payload.content));
    const textContent = fragments.length > 0 ? fragments.join('\n\n') : null;
    const title = textContent ? '模型推理' : '模型推理（加密）';
    return createTimelineItem(
      seq,
      timestamp,
      'assistant_reasoning',
      'assistant',
      title,
      textContent,
      payload,
    );
  }

  if (payloadType === 'function_call') {
    const name = typeof payload.name === 'string' ? payload.name : 'unknown';
    return createTimelineItem(
      seq,
      timestamp,
      'tool_call',
      'assistant',
      `工具调用 · ${name}`,
      typeof payload.arguments === 'string' ? payload.arguments : null,
      payload,
    );
  }

  if (payloadType === 'function_call_output') {
    return createTimelineItem(
      seq,
      timestamp,
      'tool_output',
      'tool',
      '工具输出',
      typeof payload.output === 'string' ? payload.output : null,
      payload,
    );
  }

  return createTimelineItem(seq, timestamp, 'event', null, `响应项 · ${payloadType}`, null, payload);
}

function fallbackSessionId(filePath: string) {
  return path.basename(filePath, '.jsonl');
}

function resolveTitle(timeline: TimelineItem[], filePath: string) {
  const preferred = timeline.find((item) =>
    item.kind === 'user_message' || item.kind === 'assistant_message',
  );

  return excerpt(preferred?.textContent ?? path.basename(filePath));
}

export function parseSessionFile(file: SessionFile): ParsedSession {
  const diagnostics: ImportDiagnostic[] = [];
  const timeline: TimelineItem[] = [];
  const lines = fs.readFileSync(file.filePath, 'utf8').split(/\r?\n/);
  let sessionId: string | null = null;
  let cwd: string | null = null;
  let cliVersion: string | null = null;
  let startedAt: string | null = null;
  let lastUpdatedAt: string | null = null;
  let eventCount = 0;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    let parsed: JsonRecord;
    try {
      parsed = JSON.parse(line) as JsonRecord;
    } catch {
      diagnostics.push(createDiagnostic(file.filePath, index + 1, 'JSON 解析失败'));
      return;
    }

    eventCount += 1;
    const timestamp = readTimestamp(parsed);
    startedAt ??= timestamp;
    lastUpdatedAt = timestamp ?? lastUpdatedAt;
    const entryType = typeof parsed.type === 'string' ? parsed.type : null;
    const payload = asRecord(parsed.payload);

    if (!entryType) {
      diagnostics.push(createDiagnostic(file.filePath, index + 1, '缺少顶层 type 字段'));
      return;
    }

    if (entryType === 'session_meta' && payload) {
      sessionId = typeof payload.id === 'string' ? payload.id : sessionId;
      cwd = typeof payload.cwd === 'string' ? payload.cwd : cwd;
      cliVersion = typeof payload.cli_version === 'string' ? payload.cli_version : cliVersion;
      startedAt = typeof payload.timestamp === 'string' ? payload.timestamp : startedAt;
      return;
    }

    if (!payload) {
      diagnostics.push(createDiagnostic(file.filePath, index + 1, `${entryType} 缺少 payload 对象`));
      return;
    }

    const item =
      entryType === 'event_msg'
        ? fromEventMessage(timeline.length, timestamp, payload)
        : entryType === 'response_item'
          ? fromResponseItem(timeline.length, timestamp, payload)
          : null;

    if (item) {
      timeline.push(item);
    }
  });

  const summary = {
    id: sessionId ?? fallbackSessionId(file.filePath),
    startedAt: startedAt ?? new Date(file.fileMtimeMs).toISOString(),
    lastUpdatedAt: lastUpdatedAt ?? new Date(file.fileMtimeMs).toISOString(),
    cwd,
    source: file.source,
    cliVersion,
    eventCount,
    hasErrors: diagnostics.length > 0,
    title: resolveTitle(timeline, file.filePath),
  };

  return {
    source: file.source,
    filePath: file.filePath,
    fileMtimeMs: file.fileMtimeMs,
    fileSize: file.fileSize,
    summary,
    timeline,
    diagnostics,
  };
}
