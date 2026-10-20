import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';
const projectDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(projectDir, 'dist');
const essayDir = path.join(projectDir, 'public', 'redacao');
const essayPort = Number(process.env.ESSAY_API_PORT) || 4174;
let essayBackend;

// The writing assistant keeps its Python/SQLite API, while the public app stays
// a single Node service on Render. Its API is only reachable through localhost.
try {
  essayBackend = spawn(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(essayDir, 'server.py')], {
    env: { ...process.env, PORT: String(essayPort) },
    stdio: 'inherit',
    windowsHide: true,
  });
  essayBackend.on('error', (error) => console.error('Não foi possível iniciar o serviço de redação:', error.message));
  essayBackend.on('exit', (code) => {
    if (code && code !== 0) console.error(`Serviço de redação encerrou com código ${code}.`);
  });
} catch (error) {
  console.error('Não foi possível iniciar o serviço de redação:', error);
}

app.disable('x-powered-by');
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexus-workspace', timestamp: new Date().toISOString() });
});
app.use('/api', express.json({ limit: '60mb' }));
app.use('/api', async (req, res, next) => {
  if (!['essays', 'themes'].includes(req.path.split('/')[1] || '')) return next();
  try {
    const upstream = await fetch(`http://127.0.0.1:${essayPort}${req.originalUrl}`, {
      method: req.method,
      headers: { 'content-type': 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
    });
    const payload = await upstream.arrayBuffer();
    res.status(upstream.status);
    res.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.send(Buffer.from(payload));
  } catch {
    res.status(503).json({ error: 'O serviço de redação está inicializando ou indisponível.' });
  }
});
app.use('/redacao', express.static(essayDir));
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

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => essayBackend?.kill(signal));
}
