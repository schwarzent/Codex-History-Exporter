import express from 'express';
import {
  ConfigurationError,
  getDiagnostics,
  getSessionDetail,
  getSettings,
  listSessions,
  rebuildIndex,
  setDataDir,
} from './services/history-service.js';

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/api/settings', (_request, response) => {
    response.json(getSettings());
  });

  app.post('/api/settings/data-dir', (request, response, next) => {
    try {
      const { dataDir } = request.body as { dataDir?: unknown };
      if (typeof dataDir !== 'string') {
        response.status(400).json({ message: '缺少 dataDir 字段' });
        return;
      }

      response.json(setDataDir(dataDir));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/index/rebuild', (_request, response, next) => {
    try {
      response.json({ storage: rebuildIndex(true) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sessions', (request, response, next) => {
    try {
      response.json(
        listSessions({
          q: typeof request.query.q === 'string' ? request.query.q : undefined,
          cwd: typeof request.query.cwd === 'string' ? request.query.cwd : undefined,
          source:
            request.query.source === 'sessions' || request.query.source === 'archived'
              ? request.query.source
              : undefined,
          from: typeof request.query.from === 'string' ? request.query.from : undefined,
          to: typeof request.query.to === 'string' ? request.query.to : undefined,
          page: parsePositiveNumber(request.query.page, 1),
          pageSize: parsePositiveNumber(request.query.pageSize, 50),
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sessions/:sessionId', (request, response, next) => {
    try {
      const detail = getSessionDetail(request.params.sessionId);
      if (!detail) {
        response.status(404).json({ message: '未找到对应会话' });
        return;
      }

      response.json(detail);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/diagnostics', (_request, response, next) => {
    try {
      response.json(getDiagnostics());
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ConfigurationError) {
      response.status(400).json({ message: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({ message: '服务器内部错误' });
  });

  return app;
}
