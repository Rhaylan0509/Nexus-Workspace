const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function findGitExecutable() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const ghDesktopDir = path.join(localAppData, 'GitHubDesktop');
  if (fs.existsSync(ghDesktopDir)) {
    try {
      const apps = fs.readdirSync(ghDesktopDir).filter((name) => name.startsWith('app-'));
      for (const appVer of apps.sort().reverse()) {
        const candidate = path.join(ghDesktopDir, appVer, 'resources', 'app', 'git', 'cmd', 'git.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {}
  }

  const standardPaths = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(localAppData, 'Programs', 'Git', 'cmd', 'git.exe'),
  ];
  for (const candidate of standardPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return 'git';
}

function createGitHubSync({ workspaceRoot, dataRoot, readLibrary, writeLibrary }) {
  let busy = false;
  let lastSyncAt = null;
  let message = 'GitHub pronto para sincronizar';
  let interval = null;
  const gitPath = findGitExecutable();
  const repoUrl = 'https://github.com/Rhaylan0509/Nexus-Workspace.git';

  function execGit(args) {
    return new Promise((resolve, reject) => {
      execFile(
        gitPath,
        args,
        {
          cwd: workspaceRoot,
          windowsHide: true,
          maxBuffer: 50 * 1024 * 1024,
          timeout: 600000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
          } else {
            resolve({ stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
          }
        }
      );
    });
  }

  async function sync() {
    if (busy) return { ok: false, message: 'Sincronização já em andamento.' };
    busy = true;
    message = 'Sincronizando com GitHub…';

    try {
      // 1. Garante que a pasta data existe
      fs.mkdirSync(dataRoot, { recursive: true });

      // Garante que não há index.lock órfão de execuções anteriores interrompidas
      const lockPath = path.join(workspaceRoot, '.git', 'index.lock');
      if (fs.existsSync(lockPath)) {
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > 3000) {
            fs.rmSync(lockPath, { force: true });
          }
        } catch {}
      }

      // 2. Adiciona a pasta data ao stage do git
      await execGit(['add', 'data']);

      // 3. Verifica se há arquivos modificados ou staged
      let hasStaged = false;
      try {
        const diffCheck = await execGit(['diff', '--cached', '--name-only', 'data']);
        hasStaged = Boolean(diffCheck.stdout && diffCheck.stdout.length > 0);
      } catch {
        hasStaged = true;
      }

      // 4. Se houver alterações locais, faz commit
      if (hasStaged) {
        const timestamp = new Date().toLocaleString('pt-BR');
        await execGit(['commit', '-m', `sync: atualização dos dados da biblioteca (${timestamp})`]);
      }

      // 5. Tenta sincronizar com o remoto (pull --rebase e push)
      let networkOk = true;
      try {
        // Tenta fazer pull com rebase para integrar novidades remotas sem conflitos
        await execGit(['pull', '--rebase', 'origin', 'main']);
      } catch (pullErr) {
        console.warn('Aviso no git pull:', pullErr.message);
        // Se falhou por estar offline ou rebase abortado
        if (pullErr.message.includes('Could not resolve host') || pullErr.message.includes('Failed to connect')) {
          networkOk = false;
        }
      }

      if (networkOk) {
        // Envia commits locais pendentes para o origin/main
        try {
          await execGit(['push', 'origin', 'main']);
        } catch (pushErr) {
          if (pushErr.message.includes('Could not resolve host') || pushErr.message.includes('Failed to connect')) {
            networkOk = false;
          } else {
            throw pushErr;
          }
        }
      }

      lastSyncAt = Date.now();
      const timeStr = new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (networkOk) {
        message = `GitHub sincronizado às ${timeStr}`;
      } else {
        message = `Salvo localmente às ${timeStr} (sem conexão GitHub)`;
      }

      return { ok: true, lastSyncAt, message };
    } catch (error) {
      console.error('Erro na sincronização GitHub:', error);
      message = error.message ? `Erro ao sincronizar: ${error.message.slice(0, 100)}` : 'Falha na sincronização com GitHub.';
      return { ok: false, message };
    } finally {
      busy = false;
    }
  }

  async function syncNow() {
    return sync();
  }

  function status() {
    return {
      connected: true,
      syncing: busy,
      connecting: false,
      lastSyncAt,
      message,
      repoUrl,
    };
  }

  function start() {
    // Sincronização automática a cada 5 minutos (5 * 60 * 1000 ms)
    if (!interval) {
      interval = setInterval(() => {
        if (!busy) sync().catch(() => {});
      }, 5 * 60 * 1000);
    }
    // Sincronização inicial após 3 segundos da inicialização do app
    setTimeout(() => {
      sync().catch(() => {});
    }, 3000);
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function disconnect() {
    message = 'GitHub desconectado';
  }

  return {
    start,
    stop,
    syncNow,
    status,
    disconnect,
  };
}

module.exports = { createGitHubSync, findGitExecutable };
