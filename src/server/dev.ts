import { createApp } from './app.js';
import { initializeHistoryState } from './services/history-service.js';

const DEV_PORT = 3000;

initializeHistoryState();

createApp().listen(DEV_PORT, () => {
  console.log(`Server listening on http://localhost:${DEV_PORT}`);
});
