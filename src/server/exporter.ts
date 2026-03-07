import fs from 'node:fs';
import path from 'node:path';
import type { ExportResponse, SessionDetail } from '../shared/types.js';

type ExportFormat = 'markdown' | 'html' | 'messageonly';

function isMessageOnlyItem(detailKind: SessionDetail['timeline'][number]['kind']) {
  return detailKind === 'user_message' || detailKind === 'assistant_message';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderMarkdown(detail: SessionDetail) {
  const lines = [
    `# ${detail.summary.title}`,
    '',
    `- 会话 ID：\`${detail.summary.id}\``,
    `- 工作目录：\`${detail.summary.cwd ?? '未知'}\``,
    `- 原始文件：\`${detail.rawFilePath}\``,
    '',
  ];

  detail.timeline.forEach((item) => {
    lines.push(`## ${item.title}`);
    lines.push('');
    lines.push(`- 时间：${item.timestamp ?? '无时间戳'}`);
    lines.push(`- 类型：${item.kind}`);
    if (item.textContent) {
      lines.push('');
      lines.push('```text');
      lines.push(item.textContent);
      lines.push('```');
    }
    lines.push('');
  });

  return lines.join('\n');
}

function renderMessageOnlyMarkdown(detail: SessionDetail) {
  const lines = [
    `# ${detail.summary.title}`,
    '',
    `- 会话 ID：\`${detail.summary.id}\``,
    `- 工作目录：\`${detail.summary.cwd ?? '未知'}\``,
    `- 原始文件：\`${detail.rawFilePath}\``,
    `- 导出模式：\`messageonly\``,
    '',
  ];

  detail.timeline
    .filter((item) => isMessageOnlyItem(item.kind))
    .forEach((item) => {
      const speaker = item.kind === 'user_message' ? 'User' : 'Codex';
      lines.push(`## ${speaker}`);
      lines.push('');
      lines.push(`- 时间：${item.timestamp ?? '无时间戳'}`);
      if (item.textContent) {
        lines.push('');
        lines.push(item.textContent);
      }
      lines.push('');
    });

  return lines.join('\n');
}

function renderHtml(detail: SessionDetail) {
  const items = detail.timeline
    .map(
      (item) => `
        <article class="item item-${item.kind}">
          <header>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.timestamp ?? '无时间戳')}</span>
          </header>
          <pre>${escapeHtml(item.textContent ?? '无文本内容')}</pre>
        </article>
      `,
    )
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(detail.summary.title)}</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; margin: 0; background: #0f172a; color: #e8ecf1; }
      main { max-width: 1100px; margin: 0 auto; padding: 24px; }
      .meta { color: #cbd5e1; margin-bottom: 24px; }
      .item { border: 1px solid rgba(148,163,184,.24); border-left-width: 4px; border-radius: 16px; padding: 16px; margin-bottom: 12px; background: rgba(15,23,42,.72); }
      .item header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .item-user_message { border-left-color: #38bdf8; }
      .item-assistant_message { border-left-color: #34d399; }
      .item-assistant_reasoning { border-left-color: #f59e0b; }
      .item-tool_call, .item-tool_output { border-left-color: #a78bfa; }
      pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(detail.summary.title)}</h1>
      <p class="meta">会话 ID：${escapeHtml(detail.summary.id)} · 工作目录：${escapeHtml(detail.summary.cwd ?? '未知')}</p>
      ${items}
    </main>
  </body>
</html>`;
}

export function exportSessionDetail(
  detail: SessionDetail,
  exportPath: string,
  format: ExportFormat,
): ExportResponse {
  const dirname = path.dirname(exportPath);
  fs.mkdirSync(dirname, { recursive: true });
  const content =
    format === 'markdown'
      ? renderMarkdown(detail)
      : format === 'messageonly'
        ? renderMessageOnlyMarkdown(detail)
        : renderHtml(detail);
  fs.writeFileSync(exportPath, content, 'utf8');

  return {
    filePath: exportPath,
    format,
  };
}
