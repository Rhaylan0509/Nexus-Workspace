import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';
const projectDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(projectDir, 'dist');

app.disable('x-powered-by');
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexus-workspace', timestamp: new Date().toISOString() });
});
app.use(express.static(buildDir));

// Keep client-side routes working when the app is refreshed directly.
app.get('*', (_req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'), (error) => {
    if (error && !res.headersSent) {
      res.status(503).type('text').send('Build not found. Run "npm run build" first.');
    }
  });
});

app.listen(port, host, () => {
  console.log(`Nexus Workspace server listening at http://localhost:${port}`);
});