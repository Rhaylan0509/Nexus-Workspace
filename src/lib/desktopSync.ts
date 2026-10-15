export interface DesktopSyncSession {
  port: number;
  token: string;
}

export interface DesktopLibraryFile {
  id: string;
  name: string;
  extension: string;
  driveFileId?: string;
  modifiedAt: number;
  size: number;
  sha256: string;
}

function desktopUrl(session: DesktopSyncSession, path: string) {
  return `http://127.0.0.1:${session.port}${path}`;
}

async function desktopRequest(session: DesktopSyncSession, path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.token}`);
    response = await fetch(desktopUrl(session, path), {
      ...init,
      headers,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new Error('Não foi possível conectar ao Xournal++ Desktop. Clique em Sincronizar no app para iniciar uma nova conexão.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `A ponte local recusou a sincronização (${response.status}).`);
  }
  return response;
}

export function readDesktopSyncSession(): DesktopSyncSession | null {
  const match = window.location.hash.match(/^#desktopSync=(\d{1,5})\.([a-f\d]{64})$/i);
  if (!match) return null;
  const port = Number(match[1]);
  if (port < 1 || port > 65535) return null;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return { port, token: match[2] };
}

export async function getDesktopLibraryManifest(session: DesktopSyncSession): Promise<DesktopLibraryFile[]> {
  const response = await desktopRequest(session, '/manifest');
  const payload = await response.json();
  if (!Array.isArray(payload.files)) throw new Error('O app desktop retornou uma lista de arquivos inválida.');
  return payload.files as DesktopLibraryFile[];
}

export async function downloadDesktopFile(session: DesktopSyncSession, id: string): Promise<Blob> {
  const response = await desktopRequest(session, `/files/${encodeURIComponent(id)}`);
  const blob = await response.blob();
  const expectedHash = response.headers.get('X-Content-SHA256')?.toLowerCase();
  const actualHash = await sha256(blob);
  if (!expectedHash || expectedHash !== actualHash) {
    throw new Error(`A verificação de integridade falhou para ${id}. O arquivo não foi sincronizado.`);
  }
  return blob;
}

export async function uploadDesktopFile(
  session: DesktopSyncSession,
  input: { id?: string; name: string; extension: string; driveFileId: string; modifiedAt: number },
  blob: Blob,
) {
  const digest = await sha256(blob);
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  let binary = '';
  for (const byte of encoded) binary += String.fromCharCode(byte);
  const metadata = btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const endpoint = input.id ? `/files/${encodeURIComponent(input.id)}` : '/files';
  const response = await desktopRequest(session, endpoint, {
    method: input.id ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Nexus-Metadata': metadata,
      'X-Content-SHA256': digest,
    },
    body: blob,
  });
  return response.status === 204 ? null : response.json();
}

export async function saveDesktopDriveMapping(
  session: DesktopSyncSession,
  id: string,
  driveFileId: string,
  modifiedAt: number,
) {
  await desktopRequest(session, `/files/${encodeURIComponent(id)}/mapping`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveFileId, modifiedAt }),
  });
}

export async function finishDesktopSync(session: DesktopSyncSession, error?: string) {
  await desktopRequest(session, '/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: !error, error }),
  });
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
