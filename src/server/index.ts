import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { initializeHistoryState } from './services/history-service.js';

const DEFAULT_PORT = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, '../client');
const indexHtmlPath = path.join(clientDir, 'index.html');

const app = createApp();
initializeHistoryState();

if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
}

app.get('*', (_request, response, next) => {
  if (!fs.existsSync(indexHtmlPath)) {
    next();
    return;
  }

  response.sendFile(indexHtmlPath);
});

app.listen(DEFAULT_PORT, () => {
  console.log(`Production server listening on http://localhost:${DEFAULT_PORT}`);
});
