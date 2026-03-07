# Codex History Viewer

本地 Web 应用，用于浏览、检索、诊断和导出 Codex CLI 保存在本机的历史记录。

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

## PowerShell 详细运行教学

以下步骤以 **PowerShell 7** 为例，Windows PowerShell 5 也可使用。

### 1. 进入项目目录

```powershell
Set-Location "D:\dev\Codex-History-Exporter"
```

如果路径中包含空格或中文，继续保持双引号。

### 2. 确认 Node 和 npm 版本

```powershell
node -v
npm -v
```

本项目要求：

- `Node.js 22+`
- `npm 11+`

如果版本不够，先升级，再继续。

### 3. 首次安装依赖

```powershell
npm install
```

安装完成后，项目根目录会出现 `node_modules` 和 `package-lock.json`。

### 4. 启动开发模式

```powershell
npm run dev
```

这条命令会同时启动：

- 前端开发服务器：`http://localhost:5173`
- 后端 API 服务：`http://localhost:3000`

正常情况下，PowerShell 中会看到类似输出：

```text
VITE v7.x ready
Local:   http://localhost:5173/
Server listening on http://localhost:3000
```

然后在浏览器打开：

```text
http://localhost:5173
```

### 5. 首次启动后的页面操作

首次打开页面时，会先看到“设置本地数据目录”。

这里填写一个**绝对路径**，例如：

```text
D:\CodexHistoryData
```

点击“保存并建立索引”后，应用会在该目录下创建：

- `codex-history.sqlite`
- `exports\`

然后扫描：

- `C:\Users\<你的用户名>\.codex\sessions\`
- `C:\Users\<你的用户名>\.codex\archived_sessions\`

注意：

- 应用只读取原始 Codex 历史
- 应用不会复制原始 JSONL 到你的自定义目录
- 应用不会修改 `.codex` 下的历史文件

### 6. 开发模式下如何停止

在 PowerShell 当前窗口按：

```text
Ctrl + C
```

如果终端出现：

```text
Terminate batch job (Y/N)?
```

输入：

```text
y
```

然后回车。

因为 `npm run dev` 会同时拉起前后端两个进程，在 Windows 上这是正常表现。

### 7. 运行测试

```powershell
npm run test
```

只做类型检查：

```powershell
npm run check-types
```

### 8. 构建生产版本

```powershell
npm run build
```

构建完成后会生成：

- 前端产物：`dist/client`
- 后端产物：`dist/server`

### 9. 启动生产版本

先构建，再启动：

```powershell
npm run build
npm start
```

默认访问地址：

```text
http://localhost:3000
```

生产模式下，后端会直接托管构建后的前端页面。

### 10. PowerShell 使用注意点

- PowerShell 不要写 `cmd` 风格的 `&&`；连续命令用 `;`
- 例如：

```powershell
npm run check-types; npm run build
```

- 根据 npm 官方文档，Windows 上 `npm run` 默认使用 `cmd.exe` 作为脚本 shell，因此你在 PowerShell 中执行 `npm run dev`、`npm run build`、`npm run test` 都是正常支持的

### 11. 常见问题

#### 端口被占用

如果 `5173` 或 `3000` 已被占用，启动会失败。先关闭占用端口的旧进程，再重新执行：

```powershell
npm run dev
```

#### 页面能打开，但没有会话

优先检查：

- `C:\Users\<你的用户名>\.codex\sessions\` 是否存在
- `C:\Users\<你的用户名>\.codex\archived_sessions\` 是否存在
- 页面里配置的数据目录是否为绝对路径

#### 出现 SQLite experimental 警告

这是当前项目设计的一部分，因为本项目使用 Node 22 自带的 `node:sqlite`。只要功能正常、测试通过，这条警告本身不是故障。

## 构建与测试

```bash
npm run test
npm run check-types
npm run build
```

## Git 回退

仓库已经按里程碑提交，可直接使用：

```bash
git log --oneline
git checkout <commit>
```

## 参考

- npm `run` / `run-script` 官方文档：`https://docs.npmjs.com/cli/v11/commands/npm-run-script`
- npm scripts 官方文档：`https://docs.npmjs.com/cli/v11/using-npm/scripts`
