import { createApp } from './app.js';

const DEV_PORT = 3000;

createApp().listen(DEV_PORT, () => {
  console.log(`Server listening on http://localhost:${DEV_PORT}`);
});
