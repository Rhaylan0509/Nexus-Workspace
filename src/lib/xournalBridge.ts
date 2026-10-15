import { getFirebaseIdToken } from './firebaseAuth';

export interface XournalBridgeJob {
  id: string;
  itemId: string;
  fileName: string;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  error?: string | null;
}

async function bridgeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const idToken = await getFirebaseIdToken();
  if (!idToken) throw new Error('Entre no Nexus antes de abrir a nota no Xournal++.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api/bridge${path}`, {
    ...init,
    headers,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error(payload?.error || 'O servidor ainda não está configurado para a bridge.');
    }
    if (response.status === 401) {
      throw new Error(payload?.error || 'Entre novamente no Nexus e tente outra vez.');
    }
    throw new Error(payload?.error || `Falha de comunicação com a bridge (${response.status}).`);
  }
  return payload as T;
}

export function createXournalBridgeJob(input: { itemId: string; fileName: string }) {
  return bridgeRequest<XournalBridgeJob>('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function uploadXournalBridgeInput(jobId: string, file: Blob) {
  return bridgeRequest<void>(`/jobs/${encodeURIComponent(jobId)}/input`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
}

export function getXournalBridgeJob(jobId: string) {
  return bridgeRequest<XournalBridgeJob>(`/jobs/${encodeURIComponent(jobId)}`);
}

export async function getXournalBridgeResult(jobId: string): Promise<Blob> {
  const idToken = await getFirebaseIdToken();
  if (!idToken) throw new Error('Entre no Nexus antes de baixar o arquivo editado.');
  const response = await fetch(`/api/bridge/jobs/${encodeURIComponent(jobId)}/result`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Falha ao baixar o resultado da bridge (${response.status}).`);
  }
  return response.blob();
}

export function deleteXournalBridgeJob(jobId: string) {
  return bridgeRequest<void>(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

export const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
