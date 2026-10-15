import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';
const projectDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(projectDir, 'dist');
const configuredBridgeDataDir = process.env.BRIDGE_DATA_DIR || '.local-data';
const bridgeDataDir = path.isAbsolute(configuredBridgeDataDir)
  ? configuredBridgeDataDir
  : path.resolve(projectDir, configuredBridgeDataDir);
const bridgeStateFile = path.join(bridgeDataDir, 'xournal-jobs.json');
const bridgeLeaseMs = 90_000;

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

function loadBridgeJobs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(bridgeStateFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read Xournal bridge state:', error);
    return [];
  }
}

function saveBridgeJobs(jobs) {
  fs.mkdirSync(bridgeDataDir, { recursive: true });
  const temporaryFile = `${bridgeStateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(jobs, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, bridgeStateFile);
}

function requireBridgeToken(req, res, next) {
  const expected = process.env.BRIDGE_API_TOKEN || '';
  const provided = req.get('x-bridge-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (!expected || expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return res.status(expected ? 401 : 503).json({ error: expected ? 'Bridge token is invalid.' : 'Set BRIDGE_API_TOKEN on the server first.' });
  }
  next();
}

function publicJob(job) {
  return {
    id: job.id,
    itemId: job.itemId,
    fileName: job.fileName,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    error: job.error || null,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexus-workspace', timestamp: new Date().toISOString() });
});

app.post('/api/bridge/jobs', requireBridgeToken, (req, res) => {
  const { itemId, fileName, driveFileId } = req.body || {};
  if (!itemId || !driveFileId || !/\.(xopp|xoj)$/i.test(fileName || '')) {
    return res.status(400).json({ error: 'itemId, driveFileId, and an .xopp/.xoj filename are required.' });
  }
  const jobs = loadBridgeJobs();
  const now = Date.now();
  const job = {
    id: crypto.randomUUID(),
    itemId: String(itemId),
    fileName: path.basename(String(fileName)),
    driveFileId: String(driveFileId),
    status: 'queued',
    createdAt: now,
  };
  saveBridgeJobs(jobs.filter((entry) => now - entry.createdAt < 14 * 24 * 60 * 60 * 1000).concat(job));
  res.status(201).json(publicJob(job));
});

app.get('/api/bridge/next', requireBridgeToken, (req, res) => {
  const jobs = loadBridgeJobs();
  const now = Date.now();
  const job = jobs.find((entry) => entry.status === 'queued' || (entry.status === 'processing' && entry.leaseUntil < now));
  if (!job) return res.status(204).end();
  job.status = 'processing';
  job.claimedAt = now;
  job.leaseUntil = now + bridgeLeaseMs;
  saveBridgeJobs(jobs);
  res.json({ ...publicJob(job), driveFileId: job.driveFileId });
});

app.get('/api/bridge/jobs/:jobId', requireBridgeToken, (req, res) => {
  const job = loadBridgeJobs().find((entry) => entry.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Bridge job not found.' });
  res.json(publicJob(job));
});

app.post('/api/bridge/jobs/:jobId/heartbeat', requireBridgeToken, (req, res) => {
  const jobs = loadBridgeJobs();
  const job = jobs.find((entry) => entry.id === req.params.jobId);
  if (!job || job.status !== 'processing') return res.status(404).json({ error: 'Active bridge job not found.' });
  job.leaseUntil = Date.now() + bridgeLeaseMs;
  saveBridgeJobs(jobs);
  res.json({ ok: true });
});

app.post('/api/bridge/jobs/:jobId/complete', requireBridgeToken, (req, res) => {
  const jobs = loadBridgeJobs();
  const job = jobs.find((entry) => entry.id === req.params.jobId);
  if (!job || job.status !== 'processing') return res.status(404).json({ error: 'Active bridge job not found.' });
  job.status = req.body?.ok === true ? 'completed' : 'failed';
  job.error = job.status === 'failed' ? String(req.body?.error || 'Xournal bridge failed.').slice(0, 1000) : null;
  job.completedAt = Date.now();
  delete job.leaseUntil;
  saveBridgeJobs(jobs);
  res.json(publicJob(job));
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
