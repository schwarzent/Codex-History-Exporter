# Codex History Exporter

用codex做的自用工具
- 本地 Web 应用，用于浏览、检索、诊断和导出 Codex CLI 保存在本机的历史记录。

## 功能

- 浏览 `~/.codex/sessions` 与 `~/.codex/archived_sessions` 中的 JSONL 会话
- 本地 SQLite FTS5 索引与关键词检索
- 会话详情时间线与原始 JSON 查看
- 自定义数据目录，避免查看器自己的索引和导出文件默认落到 C 盘
- Markdown / HTML 导出
- 解析错误诊断

## 运行要求

- Node.js 22+
- npm 11+

项目使用 `node:sqlite`，运行时会出现 experimental 警告，这是当前设计的一部分。

## 开发

```bash
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

首次启动时需要先填写一个**绝对路径**作为查看器的数据目录。应用只会在该目录内写入：

- `codex-history.sqlite`
- `exports/`

应用不会复制或修改 Codex 原始历史文件。



## 参考

- npm `run` / `run-script` 官方文档：`https://docs.npmjs.com/cli/v11/commands/npm-run-script`
- npm scripts 官方文档：`https://docs.npmjs.com/cli/v11/using-npm/scripts`
