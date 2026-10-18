}const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safeStorage, app, shell } = require('electron');

const DEFAULT_CLIENT_ID = '';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_NAME = 'Nexus Workspace';
const MIME_TYPES = { pdf: 'application/pdf', xopp: 'application/x-xopp', xoj: 'application/x-xoj', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function createGoogleDriveSync({ libraryRoot, readLibrary, writeLibrary, acceptedExtensions }) {
  const tokenPath = () => path.join(app.getPath('userData'), 'google-drive-token.bin');
  let tokens = null;
  let busy = false;
  let connecting = false;
  let lastSyncAt = null;
  let message = 'Google Drive desconectado';
  let interval = null;

  function clientId() {
    try {
      const configured = fs.readFileSync(path.join(app.getPath('userData'), 'google-drive-client-id.txt'), 'utf8').trim();
      if (configured) return configured;
    } catch {}
    return process.env.GOOGLE_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
  }
  function clientSecret() {
    try { return fs.readFileSync(path.join(app.getPath('userData'), 'google-drive-client-secret.txt'), 'utf8').trim(); }
    catch { return ''; }
  }
  function loadTokens() {
    try {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('O armazenamento seguro do Windows não está disponível.');
      const encrypted = fs.readFileSync(tokenPath());
      tokens = JSON.parse(safeStorage.decryptString(encrypted));
    } catch { tokens = null; }
  }
  function saveTokens(value) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('O Windows não disponibilizou o armazenamento seguro para salvar a autorização Google.');
    fs.mkdirSync(path.dirname(tokenPath()), { recursive: true });
    const temporary = `${tokenPath()}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(value)), { flag: 'wx' });
    fs.renameSync(temporary, tokenPath());
    tokens = value;
  }
  function removeTokens() {
    tokens = null;
    try { fs.rmSync(tokenPath(), { force: true }); } catch {}
  }
  function base64url(value) { return Buffer.from(value).toString('base64url'); }

  async function authorize() {
    if (!clientId()) throw new Error(`Configure um OAuth Client ID do tipo Desktop app no arquivo ${path.join(app.getPath('userData'), 'google-drive-client-id.txt')}.`);
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const state = base64url(crypto.randomBytes(24));
    const server = http.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    const redirectUri = `http://127.0.0.1:${server.address().port}`;
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    }).toString();

    const authorizationCodePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A autenticação Google expirou. Clique em Conectar e tente novamente.')), 5 * 60 * 1000);
      server.on('request', (req, res) => {
        const url = new URL(req.url, redirectUri);
        if (url.pathname !== '/') { res.writeHead(404).end(); return; }
        if (url.searchParams.get('state') !== state) { res.writeHead(400).end('Estado OAuth inválido.'); return; }
        const oauthError = url.searchParams.get('error');
        if (oauthError) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h2>Autorização cancelada</h2><p>Volte ao Xournal++ Desktop.</p>');
          clearTimeout(timer); reject(new Error(`O Google cancelou a autorização (${oauthError}).`)); return;
        }
        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h2>Google Drive conectado</h2><p>Você pode voltar ao Xournal++ Desktop.</p>');
        clearTimeout(timer);
        resolve(code);
      });
    });
    try {
      await shell.openExternal(authorizationUrl.toString());
    } catch (error) {
      server.close();
      throw new Error(`Não foi possível abrir o navegador para o login Google: ${error.message}`);
    }
    const authorizationCode = await authorizationCodePromise.finally(() => server.close());

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), code: authorizationCode, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      if (payload.error === 'redirect_uri_mismatch') throw new Error('O Google recusou o redirecionamento. Configure no app um OAuth Client ID do tipo Desktop app no Google Cloud Console.');
      throw new Error(payload.error_description || 'Não foi possível concluir a autenticação do Google Drive.');
    }
    return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 };
  }

  async function refreshAccessToken() {
    if (!tokens?.refreshToken) throw new Error('Conecte sua conta Google Drive no app.');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), refresh_token: tokens.refreshToken, grant_type: 'refresh_token' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      if (payload.error === 'invalid_grant') { removeTokens(); throw new Error('A autorização do Google expirou. Conecte o Drive novamente.'); }
      throw new Error(payload.error_description || 'Falha ao renovar a autorização do Google Drive.');
    }
    tokens = { ...tokens, accessToken: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 };
    saveTokens(tokens);
    return tokens.accessToken;
  }
  async function accessToken() {
    if (!tokens) loadTokens();
    if (!tokens?.refreshToken) return null;
    if (!tokens.accessToken || Date.now() > tokens.expiresAt - 60_000) return refreshAccessToken();
    return tokens.accessToken;
  }
  async function request(url, init = {}, retry = true) {
    const token = await accessToken();
    if (!token) throw new Error('Conecte sua conta Google Drive no app.');
    const response = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
    if (response.status === 401 && retry) { await refreshAccessToken(); return request(url, init, false); }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || `Google Drive respondeu HTTP ${response.status}.`);
    }
    return response;
  }
  async function listChildren(parentId) {
    const output = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ q: `'${parentId}' in parents and trashed = false`, fields: 'nextPageToken,files(id,name,mimeType,parents,size,modifiedTime)', pageSize: '1000', orderBy: 'folder,name' });
      if (pageToken) query.set('pageToken', pageToken);
      const payload = await (await request(`${API}/files?${query}`)).json();
      output.push(...(payload.files || []));
      pageToken = payload.nextPageToken || '';
    } while (pageToken);
    return output;
  }
  async function getRootFolder() {
    const query = new URLSearchParams({ q: `name = '${ROOT_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: 'files(id,name)', pageSize: '100' });
    const payload = await (await request(`${API}/files?${query}`)).json();
    if (payload.files?.length) return payload.files[0].id;
    return (await (await request(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ROOT_NAME, mimeType: 'application/vnd.google-apps.folder' }) })).json()).id;
  }
  async function createRemoteFolder(name, parentId) {
    return (await (await request(`${API}/files?fields=id,name,mimeType,parents,modifiedTime`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }) })).json());
  }
  async function updateRemoteName(id, name) {
    return (await request(`${API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,parents,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).json();
  }
  async function downloadRemote(fileId, destination) {
    const response = await request(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${crypto.randomUUID()}.sync-tmp`;
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    fs.renameSync(temporary, destination);
  }
  async function uploadRemote(filePath, name, parentId, driveId = '') {
    const boundary = `nexus-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name, parents: driveId ? undefined : [parentId] });
    const bytes = fs.readFileSync(filePath);
    const mimeType = MIME_TYPES[path.extname(filePath).slice(1).toLowerCase()] || 'application/octet-stream';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const endpoint = driveId ? `${UPLOAD}/files/${encodeURIComponent(driveId)}?uploadType=multipart&fields=id,name,mimeType,parents,modifiedTime` : `${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,parents,modifiedTime`;
    return (await (await request(endpoint, { method: driveId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json());
  }
  async function collectRemoteTree(rootId) {
    const files = [];
    const queue = [{ id: rootId, depth: 0 }];
    while (queue.length) {
      const parent = queue.shift();
      for (const file of await listChildren(parent.id)) {
        file.parentDriveId = parent.id;
        file.depth = parent.depth + 1;
        files.push(file);
        if (file.mimeType === 'application/vnd.google-apps.folder') queue.push({ id: file.id, depth: file.depth });
      }
    }
    return files;
  }
  function safeDestination(parentId, name, extension) {
    const library = readLibrary();
    const folder = containerPath(library, parentId);
    fs.mkdirSync(folder, { recursive: true });
    return path.join(folder, `${safeFolderName(name)}${extension}`);
  }
  function safeFolderName(value) { return String(value).trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 70) || 'Sem título'; }
  function getContainerPath(library, parentId) {
    let result = libraryRoot();
    if (!parentId) return result;
    const chain = [];
    let current = library.entries.find(entry => entry.id === parentId);
    while (current) {
      chain.unshift(`${safeFolderName(current.name)}-${current.id.slice(0, 8)}`);
      current = current.parentId ? library.entries.find(entry => entry.id === current.parentId) : null;
    }
    return path.join(result, ...chain);
  }
  function containerPath(library, parentId) { return getContainerPath(library, parentId); }
  function findEntryByDriveId(library, driveId) { return library.entries.find(entry => entry.driveFileId === driveId); }
  function driveFolderName(entry) { return entry.type === 'notebook' ? `[Caderno] ${entry.name}` : entry.name; }

  function renameContainerFromDrive(library, entry, newName) {
    const oldPath = getContainerPath(library, entry.id);
    const parentPath = getContainerPath(library, entry.parentId);
    const newPath = path.join(parentPath, `${safeFolderName(newName)}-${entry.id.slice(0, 8)}`);
    if (oldPath !== newPath && fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    const oldPrefix = `${oldPath}${path.sep}`;
    for (const child of library.entries) {
      if (child.id === entry.id) continue;
      if (child.filePath?.startsWith(oldPrefix)) child.filePath = path.join(newPath, path.relative(oldPath, child.filePath));
      if (child.storagePath?.startsWith(oldPrefix)) child.storagePath = path.join(newPath, path.relative(oldPath, child.storagePath));
    }
    entry.name = newName;
    entry.storagePath = newPath;
  }
  async function sync() {
    if (busy) return { ok: false, message: 'Sincronização já está em andamento.' };
    busy = true; message = 'Sincronizando Google Drive…';
    try {
      const rootId = await getRootFolder();
      const library = readLibrary();
      const driveIdByEntry = new Map(library.entries.filter(entry => entry.driveFileId).map(entry => [entry.id, entry.driveFileId]));
      const containers = library.entries.filter(entry => ['folder', 'notebook'].includes(entry.type)).sort((a, b) => depth(library, a) - depth(library, b));
      for (const entry of containers) {
        const parentDriveId = entry.parentId ? driveIdByEntry.get(entry.parentId) || rootId : rootId;
        const remoteName = driveFolderName(entry);
        if (!entry.driveFileId) {
          const created = await createRemoteFolder(remoteName, parentDriveId);
          entry.driveFileId = created.id;
          entry.lastSyncedAt = Date.parse(created.modifiedTime || '') || Date.now();
        } else {
          const last = Number(entry.lastSyncedAt) || 0;
          const changedAt = Number(entry.updatedAt) || Date.parse(entry.updatedAt || '') || 0;
          if (changedAt > last + 1500) {
            const updated = await updateRemoteName(entry.driveFileId, remoteName);
            entry.lastSyncedAt = Date.parse(updated.modifiedTime || '') || Date.now();
            entry.updatedAt = entry.lastSyncedAt;
          }
        }
        driveIdByEntry.set(entry.id, entry.driveFileId);
      }
      const remoteTree = await collectRemoteTree(rootId);
      const remoteById = new Map(remoteTree.map(file => [file.id, file]));

      for (const entry of library.entries.filter(item => item.type === 'note' && item.filePath)) {
        const extension = String(entry.extension || path.extname(entry.filePath)).toLowerCase();
        if (!acceptedExtensions.has(extension) || !fs.existsSync(entry.filePath)) continue;
        const parentDriveId = entry.parentId ? driveIdByEntry.get(entry.parentId) || rootId : rootId;
        let remote = entry.driveFileId ? remoteById.get(entry.driveFileId) : null;
        if (entry.driveFileId && !remote) entry.driveFileId = '';
        const localTime = fs.statSync(entry.filePath).mtimeMs;
        const remoteTime = remote ? Date.parse(remote.modifiedTime || '') : 0;
        const lastSyncedAt = Number(entry.lastSyncedAt) || 0;
        if (!remote) {
          remote = await uploadRemote(entry.filePath, `${entry.name}${extension}`, parentDriveId);
          entry.driveFileId = remote.id;
        } else if (localTime > remoteTime + 1500 && localTime > lastSyncedAt + 1500) {
          remote = await uploadRemote(entry.filePath, `${entry.name}${extension}`, parentDriveId, remote.id);
        } else if (remoteTime > localTime + 1500) {
          const destination = path.resolve(entry.filePath);
          const root = path.resolve(libraryRoot());
          if (!destination.toLowerCase().startsWith(`${root}${path.sep}`.toLowerCase())) throw new Error('O arquivo está fora da Biblioteca segura.');
          await downloadRemote(remote.id, destination);
          fs.utimesSync(destination, new Date(remoteTime), new Date(remoteTime));
        }
        entry.lastSyncedAt = Date.parse(remote.modifiedTime || '') || Date.now();
        entry.fileSize = fs.statSync(entry.filePath).size;
      }

      const entryByRemote = new Map(library.entries.filter(entry => entry.driveFileId).map(entry => [entry.driveFileId, entry]));
      for (const remote of remoteTree.filter(file => file.mimeType === 'application/vnd.google-apps.folder').sort((a, b) => a.depth - b.depth)) {
        const logicalName = remote.name.startsWith('[Caderno] ') ? remote.name.slice('[Caderno] '.length) : remote.name;
        let entry = entryByRemote.get(remote.id);
        const parent = remote.parentDriveId === rootId ? null : entryByRemote.get(remote.parentDriveId);
        if (!entry) {
          const type = remote.name.startsWith('[Caderno] ') ? 'notebook' : 'folder';
          const id = crypto.randomUUID();
          const folder = path.join(parent ? getContainerPath(library, parent.id) : libraryRoot(), `${safeFolderName(logicalName)}-${id.slice(0, 8)}`);
          fs.mkdirSync(folder, { recursive: true });
          entry = { id, type, name: logicalName, parentId: parent?.id || null, color: type === 'notebook' ? 'blue' : 'yellow', storagePath: folder, driveFileId: remote.id, lastSyncedAt: Date.parse(remote.modifiedTime || '') || Date.now(), createdAt: remote.modifiedTime || new Date().toISOString() };
          library.entries.push(entry); entryByRemote.set(remote.id, entry);
        } else {
          const remoteTime = Date.parse(remote.modifiedTime || '') || 0;
          const lastSyncedAt = Number(entry.lastSyncedAt) || 0;
          if (remoteTime > lastSyncedAt + 1500) {
            renameContainerFromDrive(library, entry, logicalName);
            entry.lastSyncedAt = remoteTime;
            entry.updatedAt = remoteTime;
          }
          entryByRemote.set(remote.id, entry);
        }
      }

      for (const remote of remoteTree.filter(file => file.mimeType !== 'application/vnd.google-apps.folder')) {
        const extension = path.extname(remote.name).toLowerCase();
        if (!acceptedExtensions.has(extension)) continue;
        const parent = remote.parentDriveId === rootId ? null : entryByRemote.get(remote.parentDriveId);
        let entry = entryByRemote.get(remote.id);
        const remoteTime = Date.parse(remote.modifiedTime || '') || Date.now();
        if (!entry) {
          const id = crypto.randomUUID();
          let destination = path.join(parent ? getContainerPath(library, parent.id) : libraryRoot(), `${safeFolderName(path.basename(remote.name, extension))}${extension}`);
          if (fs.existsSync(destination)) destination = path.join(path.dirname(destination), `${safeFolderName(path.basename(remote.name, extension))} (${id.slice(0, 8)})${extension}`);
          await downloadRemote(remote.id, destination);
          fs.utimesSync(destination, new Date(remoteTime), new Date(remoteTime));
          entry = { id, type: 'note', name: path.basename(remote.name, extension), extension, parentId: parent?.id || null, filePath: destination, fileSize: Number(remote.size) || 0, driveFileId: remote.id, lastSyncedAt: remoteTime, createdAt: remote.modifiedTime || new Date().toISOString() };
          library.entries.push(entry); entryByRemote.set(remote.id, entry);
        } else {
          const localTime = fs.existsSync(entry.filePath) ? fs.statSync(entry.filePath).mtimeMs : 0;
          if (!localTime || remoteTime > localTime + 1500) {
            const remoteBaseName = path.basename(remote.name, extension);
            const targetFolder = parent ? getContainerPath(library, parent.id) : libraryRoot();
            let destination = path.join(targetFolder, `${safeFolderName(remoteBaseName)}${extension}`);
            if (destination !== entry.filePath && fs.existsSync(destination)) destination = path.join(targetFolder, `${safeFolderName(remoteBaseName)} (${entry.id.slice(0, 8)})${extension}`);
            fs.mkdirSync(targetFolder, { recursive: true });
            if (entry.filePath && entry.filePath !== destination && fs.existsSync(entry.filePath)) fs.renameSync(entry.filePath, destination);
            await downloadRemote(remote.id, destination);
            fs.utimesSync(destination, new Date(remoteTime), new Date(remoteTime));
            entry.filePath = destination; entry.name = remoteBaseName; entry.extension = extension; entry.parentId = parent?.id || null;
          }
          entry.fileSize = Number(remote.size) || entry.fileSize;
          entry.lastSyncedAt = remoteTime;
        }
      }
      writeLibrary(library);
      lastSyncAt = Date.now(); message = `Drive sincronizado às ${new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      return { ok: true, lastSyncAt, message };
    } catch (error) {
      message = error.message || 'Falha ao sincronizar Google Drive.';
      return { ok: false, message };
    } finally { busy = false; }
  }
  function depth(library, entry) {
    let value = 0; let parentId = entry.parentId;
    while (parentId) { value++; parentId = library.entries.find(item => item.id === parentId)?.parentId || null; }
    return value;
  }
  async function connect() {
    connecting = true;
    message = 'Aguardando autenticação Google…';
    try {
      tokens = await authorize();
      if (!tokens.refreshToken) throw new Error('O Google não retornou um refresh token. Confira se o Client ID é do tipo Desktop app.');
      saveTokens(tokens);
      return await sync();
    } catch (error) { message = error.message || 'Falha ao conectar Google Drive.'; return { ok: false, message }; }
    finally { connecting = false; }
  }
  async function syncNow() {
    if (!tokens) loadTokens();
    if (!tokens?.refreshToken) return connect();
    return sync();
  }
  function status() { return { connected: Boolean(tokens?.refreshToken), syncing: busy, connecting, lastSyncAt, message }; }
  function start() {
    loadTokens();
    if (!interval) interval = setInterval(() => { if (tokens?.refreshToken && !busy) sync(); }, 45_000);
    if (tokens?.refreshToken) sync();
  }
  function disconnect() { removeTokens(); message = 'Google Drive desconectado'; }
  return { start, connect, syncNow, status, disconnect };
}

module.exports = { createGoogleDriveSync };