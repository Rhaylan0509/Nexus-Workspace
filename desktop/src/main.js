const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const { createGitHubSync } = require('./gitHubSync');

// Desativa acúmulo excessivo de cache HTTP no Chromium do Electron
app.commandLine.appendSwitch('disable-http-cache');

const WORKSPACE_DIR = 'D:\\PC\\Documents\\área de trabalho\\Nexus-Workspace';
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');

function cleanupTemporaryFiles() {
  try {
    // 1. Limpa resíduos acumulados do updater (instaladores antigos órfãos de 80MB+)
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const updaterDir = path.join(localAppData, 'xournalpp-desktop-updater');
    if (fs.existsSync(updaterDir)) {
      try { fs.rmSync(updaterDir, { recursive: true, force: true }); } catch {}
    }

    // 2. Limpa arquivos temporários órfãos (.tmp, .bak, autosaves ~) na pasta de dados
    function cleanTempFiles(dir) {
      if (!fs.existsSync(dir)) return;
      const list = fs.readdirSync(dir);
      for (const item of list) {
        if (item === '.git') continue;
        const full = path.join(dir, item);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            cleanTempFiles(full);
          } else if (
            item.endsWith('.tmp') ||
            item.endsWith('.bak') ||
            item.endsWith('~') ||
            item.startsWith('#') ||
            item.endsWith('.autosave.xopp')
          ) {
            fs.rmSync(full, { force: true });
          }
        } catch {}
      }
    }
    cleanTempFiles(DATA_DIR);

    // 3. Limpa arquivos temporários em userData
    const userDir = app.getPath('userData');
    if (fs.existsSync(userDir)) {
      const entries = fs.readdirSync(userDir);
      for (const item of entries) {
        if (item.endsWith('.tmp') || item.endsWith('.bak') || item.startsWith('#')) {
          try { fs.rmSync(path.join(userDir, item), { force: true }); } catch {}
        }
      }
    }

    // 4. Limpa caches de renderização do Electron/Chromium
    const { session } = require('electron');
    if (session?.defaultSession) {
      session.defaultSession.clearCache().catch(() => {});
      session.defaultSession.clearStorageData({
        storages: ['shadercache', 'cachestorage']
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Erro ao limpar arquivos temporários:', err.message);
  }
}

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { return { executable: '', recent: [] }; }
}
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function libraryRoot() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

const libraryPath = () => path.join(libraryRoot(), 'library.json');

function normalizePath(target) {
  if (!target) return target;
  const oldRoot = path.resolve(app.getPath('documents'), 'Xournal++ Library');
  if (target.startsWith(oldRoot)) {
    return path.join(libraryRoot(), path.relative(oldRoot, target));
  }
  return target;
}

function readLibrary() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(libraryPath(), 'utf8'));
  } catch {
    // Tenta fallback do userData se ainda não tiver em data/library.json
    try {
      const fallbackPath = path.join(app.getPath('userData'), 'library.json');
      data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    } catch {
      return { entries: [] };
    }
  }

  if (Array.isArray(data.entries)) {
    // Normaliza caminhos antigos para apontar para a pasta data
    let modified = false;
    for (const entry of data.entries) {
      if (entry.filePath) {
        const norm = normalizePath(entry.filePath);
        if (norm !== entry.filePath) {
          entry.filePath = norm;
          modified = true;
        }
      }
      if (entry.storagePath) {
        const norm = normalizePath(entry.storagePath);
        if (norm !== entry.storagePath) {
          entry.storagePath = norm;
          modified = true;
        }
      }
    }
    if (modified) writeLibrary(data);
    return data;
  }

  const entries = [];
  for (const notebook of data.notebooks || []) {
    const notebookId = notebook.id || makeId();
    entries.push({ id: notebookId, type: 'notebook', name: notebook.name, parentId: null, color: 'blue' });
    for (const section of notebook.sections || []) {
      for (const note of section.notes || []) entries.push({ ...note, id: note.id || makeId(), type: 'note', parentId: notebookId });
    }
  }
  const migrated = { entries };
  writeLibrary(migrated);
  return migrated;
}

function writeLibrary(library) {
  fs.mkdirSync(path.dirname(libraryPath()), { recursive: true });
  fs.writeFileSync(libraryPath(), JSON.stringify(library, null, 2));
  // Backup de segurança em userData
  try {
    const backupPath = path.join(app.getPath('userData'), 'library.json');
    fs.writeFileSync(backupPath, JSON.stringify(library, null, 2));
  } catch {}
}

function safeFolderName(value) {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 70) || 'Sem título';
}

function xmlEscape(value) {
  return value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
}

function createXopp(note) {
  const sizes = { A4: [595.275591, 841.889764], A5: [419.527559, 595.275591], A3: [841.889764, 1190.551181], Carta: [612, 792] };
  const colors = { Branco: '#ffffffff', Creme: '#fff6e5ff', 'Amarelo claro': '#fff8c9ff', 'Azul claro': '#e8f4ffff' };
  const styles = { 'Em branco': 'plain', Linhas: 'lined', Pontilhado: 'dotted', Quadriculado: 'graph' };
  const [width, height] = sizes[note.size];
  const xml = `<?xml version="1.0" standalone="no"?>\n<xournal creator="Xournal++" fileversion="4"><title>${xmlEscape(note.name)}</title><page width="${width}" height="${height}"><background type="solid" color="${colors[note.color]}" style="${styles[note.style]}"/><layer/></page></xournal>`;
  return gzipSync(Buffer.from(xml, 'utf8'));
}

function makeId() { return randomUUID(); }
const acceptedExtensions = new Set(['.pdf', '.xopp', '.xoj', '.png', '.jpg', '.jpeg', '.webp']);
const containerColors = new Set(['yellow', 'blue', 'purple', 'green', 'pink', 'orange']);

function containerPath(library, parentId) {
  const root = libraryRoot();
  if (!parentId) return root;
  const chain = [];
  let current = library.entries.find(entry => entry.id === parentId);
  while (current) {
    if (!['folder', 'notebook'].includes(current.type)) throw new Error('Notas não podem conter outros itens.');
    chain.unshift(`${safeFolderName(current.name)}-${current.id.slice(0, 8)}`);
    current = current.parentId ? library.entries.find(entry => entry.id === current.parentId) : null;
  }
  if (!chain.length) throw new Error('A pasta escolhida não existe.');
  return path.join(root, ...chain);
}

function candidates() {
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA];
  return roots.filter(Boolean).flatMap(root => [
    path.join(root, 'Xournal++', 'bin', 'xournalpp.exe'),
    path.join(root, 'Xournal++', 'xournalpp.exe'),
    path.join(root, 'Programs', 'Xournal++', 'bin', 'xournalpp.exe')
  ]);
}

function shortcutExecutable() {
  const shortcut = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Xournal++', 'Xournal++.lnk');
  if (process.platform !== 'win32' || !fs.existsSync(shortcut)) return '';
  try {
    const escapedShortcut = shortcut.replace(/'/g, "''");
    const command = `$link = (New-Object -ComObject WScript.Shell).CreateShortcut('${escapedShortcut}'); $link.TargetPath`;
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function findExecutable() {
  const configured = readSettings().executable;
  if (configured && fs.existsSync(configured)) return configured;
  const shortcutTarget = shortcutExecutable();
  if (shortcutTarget && fs.existsSync(shortcutTarget)) return shortcutTarget;
  return candidates().find(fs.existsSync) || '';
}

const gitSync = createGitHubSync({
  workspaceRoot: WORKSPACE_DIR,
  dataRoot: DATA_DIR,
  readLibrary,
  writeLibrary,
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1160, height: 780, minWidth: 900, minHeight: 620,
    backgroundColor: '#f4f6f8',
    title: 'Xournal++ Desktop',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('app:status', () => ({ executable: findExecutable(), recent: readSettings().recent || [] }));
ipcMain.handle('app:github-sync', () => gitSync.syncNow());
ipcMain.handle('app:github-status', () => gitSync.status());
ipcMain.handle('app:drive-sync', () => gitSync.syncNow());
ipcMain.handle('app:drive-status', () => gitSync.status());
ipcMain.handle('app:drive-disconnect', () => gitSync.disconnect());

ipcMain.handle('app:choose-executable', async () => {
  const result = await dialog.showOpenDialog({ title: 'Localizar Xournal++', properties: ['openFile'], filters: [{ name: 'Aplicativo Windows', extensions: ['exe'] }] });
  if (result.canceled || !result.filePaths[0]) return findExecutable();
  const settings = readSettings(); settings.executable = result.filePaths[0]; writeSettings(settings);
  return settings.executable;
});

ipcMain.handle('app:open-file', async () => {
  const result = await dialog.showOpenDialog({ title: 'Abrir documento', properties: ['openFile'], filters: [{ name: 'Arquivos compatíveis', extensions: ['pdf', 'xopp', 'xoj', 'png', 'jpg', 'jpeg', 'webp'] }] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return launchDocument(result.filePaths[0]);
});

ipcMain.handle('app:new-note', () => launchDocument());
ipcMain.handle('app:open-recent', (_event, file) => launchDocument(file));
ipcMain.handle('app:reveal-file', (_event, file) => shell.showItemInFolder(normalizePath(file)));
ipcMain.handle('library:get', () => readLibrary());
ipcMain.handle('library:choose-file', async () => {
  const result = await dialog.showOpenDialog({ title: 'Adicionar à Biblioteca', properties: ['openFile'], filters: [{ name: 'Arquivos compatíveis', extensions: ['pdf', 'xopp', 'xoj', 'png', 'jpg', 'jpeg', 'webp'] }] });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('library:import-file', (_event, { sourcePath, parentId = null }) => {
  try {
    const extension = path.extname(sourcePath).toLowerCase();
    if (!acceptedExtensions.has(extension)) return { error: 'Tipo não aceito. Use PDF, XOPP, XOJ ou imagem PNG/JPG/WEBP.' };
    const sourceStats = fs.statSync(sourcePath);
    if (!sourceStats.isFile()) return { error: 'Selecione um arquivo.' };
    const library = readLibrary();
    const folder = containerPath(library, parentId);
    fs.mkdirSync(folder, { recursive: true });
    const name = path.basename(sourcePath, path.extname(sourcePath));
    const entry = { id: makeId(), type: 'note', name, extension, parentId, imported: true, fileSize: sourceStats.size, createdAt: new Date().toISOString() };
    let destination = path.join(folder, `${safeFolderName(name)}${extension}`);
    if (fs.existsSync(destination)) destination = path.join(folder, `${safeFolderName(name)} (${entry.id.slice(0, 8)})${extension}`);
    fs.copyFileSync(sourcePath, destination, fs.constants.COPYFILE_EXCL);
    entry.filePath = destination;
    library.entries.push(entry); writeLibrary(library);
    return { library, entry };
  } catch (error) { return { error: `Não foi possível adicionar o arquivo: ${error.message}` }; }
});

ipcMain.handle('library:create-entry', (_event, { type, parentId = null, name, size, color, style }) => {
  const library = readLibrary();
  const parent = parentId ? library.entries.find(entry => entry.id === parentId) : null;
  if (parentId && !parent) return { error: 'A pasta escolhida não existe.' };
  if (parent && !['folder', 'notebook'].includes(parent.type)) return { error: 'Notas não podem conter outros itens.' };
  if (type === 'folder' && parent?.type === 'notebook') return { error: 'Pastas só podem ser criadas na raiz ou dentro de outra pasta.' };
  if (type === 'notebook' && parent?.type === 'notebook') return { error: 'Cadernos só podem ser criados na raiz ou dentro de uma pasta.' };
  if (!['folder', 'notebook', 'note'].includes(type)) return { error: 'Tipo inválido.' };
  const entry = { id: makeId(), type, name: name.trim(), parentId, createdAt: new Date().toISOString() };
  if (!entry.name) return { error: 'Informe um nome.' };
  if (type === 'note') {
    if (!['A4', 'A5', 'A3', 'Carta'].includes(size) || !['Branco', 'Creme', 'Amarelo claro', 'Azul claro'].includes(color) || !['Em branco', 'Linhas', 'Pontilhado', 'Quadriculado'].includes(style)) return { error: 'Configuração de nota inválida.' };
    Object.assign(entry, { size, color, style, createdAt: new Date().toISOString() });
    try {
      const folder = containerPath(library, parentId);
      fs.mkdirSync(folder, { recursive: true });
      let filePath = path.join(folder, `${safeFolderName(entry.name)}.xopp`);
      if (fs.existsSync(filePath)) filePath = path.join(folder, `${safeFolderName(entry.name)} (${entry.id.slice(0, 8)}).xopp`);
      fs.writeFileSync(filePath, createXopp(entry));
      entry.filePath = filePath;
      entry.extension = '.xopp';
    } catch (error) { return { error: error.message }; }
  } else if (type === 'folder' || type === 'notebook') {
    if (color && !containerColors.has(color)) return { error: 'Cor inválida para pasta ou caderno.' };
    entry.color = color || (type === 'folder' ? 'yellow' : 'blue');
    try {
      const parentPath = containerPath(library, parentId);
      const folder = path.join(parentPath, `${safeFolderName(entry.name)}-${entry.id.slice(0, 8)}`);
      fs.mkdirSync(folder, { recursive: true });
      entry.storagePath = folder;
    } catch (error) { return { error: error.message }; }
  }
  library.entries.push(entry); writeLibrary(library);
  return { library, entry };
});

ipcMain.handle('library:open-note', (_event, noteId) => {
  const library = readLibrary();
  const note = library.entries.find(item => item.id === noteId && item.type === 'note');
  if (!note) return { error: 'Nota não encontrada na Biblioteca.' };
  return launchDocument(note.filePath);
});

ipcMain.handle('library:rename-entry', (_event, { entryId, name, color }) => {
  const library = readLibrary();
  const entry = library.entries.find(item => item.id === entryId);
  const newName = String(name || '').trim();
  if (!entry) return { error: 'O item não existe.' };
  if (!newName) return { error: 'Informe um nome.' };
  try {
    if (entry.type === 'note') {
      const currentFilePath = normalizePath(entry.filePath);
      const extension = entry.extension || path.extname(currentFilePath) || '.xopp';
      const baseName = newName.toLowerCase().endsWith(extension.toLowerCase()) ? newName.slice(0, -extension.length) : newName;
      const folder = path.dirname(currentFilePath);
      const destination = path.join(folder, `${safeFolderName(baseName)}${extension}`);
      if (destination !== currentFilePath && fs.existsSync(destination)) return { error: 'Já existe um arquivo com esse nome.' };
      if (destination !== currentFilePath) fs.renameSync(currentFilePath, destination);
      entry.name = baseName; entry.extension = extension; entry.filePath = destination; entry.updatedAt = Date.now();
      fs.utimesSync(destination, new Date(), new Date());
    } else {
      if (color && !containerColors.has(color)) return { error: 'Cor inválida para pasta ou caderno.' };
      const oldFolder = containerPath(library, entry.id);
      const parentFolder = containerPath(library, entry.parentId);
      const newFolder = path.join(parentFolder, `${safeFolderName(newName)}-${entry.id.slice(0, 8)}`);
      if (newFolder !== oldFolder && fs.existsSync(newFolder)) return { error: 'Já existe uma pasta com esse nome.' };
      if (newFolder !== oldFolder) fs.renameSync(oldFolder, newFolder);
      const oldPrefix = `${oldFolder}${path.sep}`;
      for (const descendant of library.entries) {
        if (descendant.id === entry.id) continue;
        if (descendant.filePath?.startsWith(oldPrefix)) descendant.filePath = path.join(newFolder, path.relative(oldFolder, descendant.filePath));
        if (descendant.storagePath?.startsWith(oldPrefix)) descendant.storagePath = path.join(newFolder, path.relative(oldFolder, descendant.storagePath));
      }
      entry.name = newName; entry.storagePath = newFolder; entry.updatedAt = Date.now();
      if (color) entry.color = color;
    }
    writeLibrary(library); return { library, entry };
  } catch (error) { return { error: `Não foi possível renomear: ${error.message}` }; }
});

ipcMain.handle('library:delete-entry', (_event, entryId) => {
  const library = readLibrary();
  const entry = library.entries.find(item => item.id === entryId);
  if (!entry) return { error: 'O item não existe.' };
  const ids = new Set([entry.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of library.entries) if (child.parentId && ids.has(child.parentId) && !ids.has(child.id)) { ids.add(child.id); changed = true; }
  }
  const root = libraryRoot();
  const insideRoot = target => {
    const absolute = path.resolve(target).toLowerCase();
    const rootPath = root.toLowerCase();
    return absolute.startsWith(`${rootPath}${path.sep.toLowerCase()}`);
  };
  try {
    if (entry.type === 'note') {
      const currentFilePath = normalizePath(entry.filePath);
      if (currentFilePath && insideRoot(currentFilePath) && fs.existsSync(currentFilePath)) fs.rmSync(currentFilePath, { force: true });
    } else {
      const folder = containerPath(library, entry.id);
      if (!insideRoot(folder)) return { error: 'A pasta não está dentro da Biblioteca.' };
      if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
    }
    const deletedPaths = new Set(library.entries.filter(item => ids.has(item.id) && item.type === 'note').map(item => normalizePath(item.filePath)));
    library.entries = library.entries.filter(item => !ids.has(item.id));
    writeLibrary(library);
    const settings = readSettings(); settings.recent = (settings.recent || []).filter(file => !deletedPaths.has(normalizePath(file))); writeSettings(settings);
    return { library };
  } catch (error) { return { error: `Não foi possível excluir: ${error.message}` }; }
});

function launchDocument(file) {
  const executable = findExecutable();
  if (!executable) return { error: 'Não foi possível localizar o Xournal++. Selecione o arquivo xournalpp.exe nas configurações.' };
  const targetFile = normalizePath(file);
  if (targetFile && !fs.existsSync(targetFile)) return { error: 'Este documento não está mais neste local.' };
  const args = targetFile ? [targetFile] : [];
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  if (targetFile) {
    const settings = readSettings();
    settings.recent = [targetFile, ...(settings.recent || []).filter(item => item !== targetFile)].slice(0, 8);
    writeSettings(settings);
  }
  return { ok: true };
}

app.whenReady().then(() => {
  cleanupTemporaryFiles();
  gitSync.start();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// Sincronização garantida antes de fechar o aplicativo e limpeza de temporários
let isQuitting = false;
app.on('before-quit', (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  console.log('Fechando aplicativo: sincronizando com GitHub...');
  gitSync.syncNow()
    .catch((err) => console.error('Erro na sincronização final:', err))
    .finally(() => {
      cleanupTemporaryFiles();
      app.exit(0);
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});