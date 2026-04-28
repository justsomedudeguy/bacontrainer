import env from './config/env.js';
import { createApp } from './app.js';

const app = createApp({ config: env });

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
