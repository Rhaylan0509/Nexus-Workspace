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
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(projectDir, 'firebase-applet-config.json'), 'utf8'));
const configuredBridgeDataDir = process.env.BRIDGE_DATA_DIR || '.local-data';
const bridgeDataDir = path.isAbsolute(configuredBridgeDataDir)
  ? configuredBridgeDataDir
  : path.resolve(projectDir, configuredBridgeDataDir);
const bridgeStateFile = path.join(bridgeDataDir, 'xournal-jobs.json');
const bridgeFilesDir = path.join(bridgeDataDir, 'xournal-files');
const bridgeLeaseMs = 90_000;
const firebaseJwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let firebaseJwksCache = { keys: [], expiresAt: 0 };

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

function loadBridgeJobs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(bridgeStateFile, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const activeJobs = parsed.filter((job) => job.createdAt >= cutoff);
    if (activeJobs.length !== parsed.length) {
      for (const expiredJob of parsed.filter((job) => job.createdAt < cutoff)) {
        if (/^[0-9a-f-]{36}$/i.test(expiredJob.id || '')) {
          fs.rmSync(path.join(bridgeFilesDir, expiredJob.id), { recursive: true, force: true });
        }
      }
      saveBridgeJobs(activeJobs);
    }
    return activeJobs;
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

async function loadFirebaseJwks(forceRefresh = false) {
  if (!forceRefresh && Date.now() < firebaseJwksCache.expiresAt) return firebaseJwksCache.keys;
  const response = await fetch(firebaseJwksUrl);
  if (!response.ok) throw new Error(`Firebase signing keys returned HTTP ${response.status}`);
  const payload = await response.json();
  firebaseJwksCache = { keys: payload.keys || [], expiresAt: Date.now() + 60 * 60 * 1000 };
  return firebaseJwksCache.keys;
}

async function verifyFirebaseIdToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  let keys = await loadFirebaseJwks();
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    keys = await loadFirebaseJwks(true);
    jwk = keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) return null;
  const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], 'base64url');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  if (!crypto.verify('RSA-SHA256', signedContent, publicKey, signature)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}`
    || claims.aud !== firebaseConfig.projectId
    || !claims.sub
    || !claims.exp
    || claims.exp <= now
    || claims.iat > now + 60) return null;
  return claims;
}

async function requireFirebaseUser(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Conecte sua conta Google antes de usar a bridge.' });
  try {
    const claims = await verifyFirebaseIdToken(token);
    if (!claims) return res.status(401).json({ error: 'A sessão expirou. Entre novamente no Nexus.' });
    req.firebaseUserId = claims.user_id || claims.sub;
    return next();
  } catch (error) {
    console.error('Could not verify Firebase user for Xournal bridge:', error);
    return res.status(503).json({ error: 'Não foi possível validar sua sessão Firebase agora.' });
  }
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

app.post('/api/bridge/jobs', requireFirebaseUser, (req, res) => {
  const { itemId, fileName } = req.body || {};
  if (!itemId || !/\.(xopp|xoj)$/i.test(fileName || '')) {
    return res.status(400).json({ error: 'itemId and an .xopp/.xoj filename are required.' });
  }
  const jobs = loadBridgeJobs();
  const now = Date.now();
  const job = {
    id: crypto.randomUUID(),
    itemId: String(itemId),
    ownerUid: req.firebaseUserId,
    fileName: path.basename(String(fileName)),
    status: 'uploading',
    createdAt: now,
  };
  saveBridgeJobs(jobs.filter((entry) => now - entry.createdAt < 14 * 24 * 60 * 60 * 1000).concat(job));
  res.status(201).json(publicJob(job));
});

function bridgeJobDirectory(jobId) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  return path.join(bridgeFilesDir, jobId);
}

function findBridgeJob(jobId) {
  return loadBridgeJobs().find((entry) => entry.id === jobId);
}

app.put('/api/bridge/jobs/:jobId/input', requireFirebaseUser, express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  const job = findBridgeJob(req.params.jobId);
  const jobDir = bridgeJobDirectory(req.params.jobId);
  if (!job || job.ownerUid !== req.firebaseUserId || !jobDir || job.status !== 'uploading') {
    return res.status(404).json({ error: 'Bridge upload job not found or no longer accepts an input file.' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'The Xournal++ input file is empty.' });
  }
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'input.bin'), req.body, { mode: 0o600 });
  const jobs = loadBridgeJobs();
  const current = jobs.find((entry) => entry.id === job.id);
  if (!current || current.status !== 'uploading') {
    fs.rmSync(jobDir, { recursive: true, force: true });
    return res.status(409).json({ error: 'The bridge job changed while its input was uploading.' });
  }
  current.status = 'queued';
  saveBridgeJobs(jobs);
  res.status(204).end();
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
  res.json(publicJob(job));
});

app.get('/api/bridge/jobs/:jobId/input', requireBridgeToken, (req, res) => {
  const job = findBridgeJob(req.params.jobId);
  const jobDir = bridgeJobDirectory(req.params.jobId);
  if (!job || !jobDir || job.status !== 'processing') {
    return res.status(404).json({ error: 'Active bridge input file not found.' });
  }
  const inputPath = path.join(jobDir, 'input.bin');
  if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Bridge input file is missing.' });
  res.type('application/octet-stream').sendFile(inputPath);
});

app.get('/api/bridge/jobs/:jobId', requireFirebaseUser, (req, res) => {
  const job = loadBridgeJobs().find((entry) => entry.id === req.params.jobId);
  if (!job || job.ownerUid !== req.firebaseUserId) return res.status(404).json({ error: 'Bridge job not found.' });
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

app.put('/api/bridge/jobs/:jobId/result', requireBridgeToken, express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  const job = findBridgeJob(req.params.jobId);
  const jobDir = bridgeJobDirectory(req.params.jobId);
  if (!job || !jobDir || job.status !== 'processing') {
    return res.status(404).json({ error: 'Active bridge job not found.' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'The edited Xournal++ file is empty.' });
  }
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'result.bin'), req.body, { mode: 0o600 });
  const jobs = loadBridgeJobs();
  const current = jobs.find((entry) => entry.id === job.id);
  if (!current || current.status !== 'processing') {
    fs.rmSync(jobDir, { recursive: true, force: true });
    return res.status(409).json({ error: 'The bridge job changed before its result was saved.' });
  }
  current.status = 'completed';
  current.error = null;
  current.completedAt = Date.now();
  delete current.leaseUntil;
  saveBridgeJobs(jobs);
  res.json(publicJob(current));
});

app.get('/api/bridge/jobs/:jobId/result', requireFirebaseUser, (req, res) => {
  const job = findBridgeJob(req.params.jobId);
  const jobDir = bridgeJobDirectory(req.params.jobId);
  if (!job || job.ownerUid !== req.firebaseUserId || !jobDir || job.status !== 'completed') {
    return res.status(404).json({ error: 'Completed bridge result not found.' });
  }
  const resultPath = path.join(jobDir, 'result.bin');
  if (!fs.existsSync(resultPath)) return res.status(404).json({ error: 'Bridge result file is missing.' });
  res.type('application/octet-stream').sendFile(resultPath);
});

app.delete('/api/bridge/jobs/:jobId', requireFirebaseUser, (req, res) => {
  const jobs = loadBridgeJobs();
  const job = jobs.find((entry) => entry.id === req.params.jobId);
  const jobDir = bridgeJobDirectory(req.params.jobId);
  if (!job || job.ownerUid !== req.firebaseUserId || !jobDir) return res.status(404).json({ error: 'Bridge job not found.' });
  if (job.status === 'processing') return res.status(409).json({ error: 'Cannot remove an active bridge job.' });
  fs.rmSync(jobDir, { recursive: true, force: true });
  saveBridgeJobs(jobs.filter((entry) => entry.id !== job.id));
  res.status(204).end();
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
