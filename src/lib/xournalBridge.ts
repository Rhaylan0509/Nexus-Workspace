export interface XournalBridgeJob {
  id: string;
  itemId: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string | null;
}

const BRIDGE_SECRET_KEY = 'nexus_xournal_bridge_token_v1';

function getBridgeToken(): string {
  let token = localStorage.getItem(BRIDGE_SECRET_KEY)?.trim() || '';
  if (!token) {
    token = window.prompt(
      'Digite o mesmo BRIDGE_API_TOKEN configurado no servidor e no .env da bridge Windows:'
    )?.trim() || '';
    if (!token) throw new Error('A edição foi cancelada: falta o token de pareamento da bridge.');
    localStorage.setItem(BRIDGE_SECRET_KEY, token);
  }
  return token;
}

async function bridgeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/bridge${path}`, {
    ...init,
    headers: {
      'X-Bridge-Token': getBridgeToken(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('O servidor ainda não está configurado para a bridge. Defina BRIDGE_API_TOKEN e BRIDGE_DATA_DIR.');
    }
    if (response.status === 401) {
      localStorage.removeItem(BRIDGE_SECRET_KEY);
      throw new Error('Token de pareamento inválido. Tente novamente para informar o token correto.');
    }
    throw new Error(payload?.error || `Falha de comunicação com a bridge (${response.status}).`);
  }
  return payload as T;
}

export function createXournalBridgeJob(input: { itemId: string; fileName: string; driveFileId: string }) {
  return bridgeRequest<XournalBridgeJob>('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getXournalBridgeJob(jobId: string) {
  return bridgeRequest<XournalBridgeJob>(`/jobs/${encodeURIComponent(jobId)}`);
}

export const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
