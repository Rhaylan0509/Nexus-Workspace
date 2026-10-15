/**
 * Google Drive API v3 storage client
 * Manages folders, notebooks, markdown notes, .xopp files and PDFs in the user's Google Drive.
 */

import { getBlob } from './storage';
import { FileItem } from '../types';

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface DriveStorageQuota {
  limit?: string; // in bytes
  usage?: string; // in bytes
  usageInDrive?: string;
}

const APP_ROOT_FOLDER_NAME = 'Nexus Workspace';

export class GoogleDriveApiError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: string) {
    super(message);
    this.name = 'GoogleDriveApiError';
  }
}

async function throwDriveApiError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => null);
  const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.status;
  let message = payload?.error?.message || fallback;
  if (response.status === 401) {
    message = 'A autorização do Google Drive expirou. Reconecte sua conta Google e tente novamente.';
  } else if (response.status === 403 && ['accessNotConfigured', 'SERVICE_DISABLED'].includes(reason)) {
    message = 'A Google Drive API está desativada no projeto vinculado ao Firebase. Ative-a no Google Cloud Console.';
  } else if (response.status === 403 && ['insufficientPermissions', 'PERMISSION_DENIED'].includes(reason)) {
    message = 'O Google Drive não concedeu a permissão drive.file. Desconecte e conecte novamente o Google Drive para autorizar o acesso.';
  }
  throw new GoogleDriveApiError(message, response.status, reason);
}

/**
 * Finds or creates the 'Nexus Workspace' root folder in the user's Google Drive
 */
export async function ensureAppRootFolder(accessToken: string): Promise<string> {
  const query = `name = '${APP_ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    return throwDriveApiError(searchRes, 'Erro ao buscar pasta no Google Drive.');
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Pasta criada automaticamente pelo Nexus Workspace para sincronizar cadernos e anotações.',
    }),
  });

  if (!createRes.ok) {
    return throwDriveApiError(createRes, 'Falha ao criar pasta Nexus Workspace no Google Drive.');
  }

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Creates a folder or notebook subfolder in Google Drive
 */
export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<DriveFileMetadata> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!res.ok) {
    return throwDriveApiError(res, `Falha ao criar pasta "${name}" no Drive.`);
  }

  return await res.json();
}

/**
 * Uploads a file (Blob or text) to Google Drive using multipart upload
 */
export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  contentBlob: Blob,
  parentDriveId: string,
  mimeType: string = 'application/octet-stream'
): Promise<DriveFileMetadata> {
  const metadata = {
    name: fileName,
    parents: [parentDriveId],
    mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;

  const filePartHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  // Read blob as array buffer
  const fileArrayBuffer = await contentBlob.arrayBuffer();

  const uint8Metadata = new TextEncoder().encode(metadataPart + filePartHeader);
  const uint8Close = new TextEncoder().encode(closeDelimiter);

  const combinedBody = new Uint8Array(
    uint8Metadata.length + fileArrayBuffer.byteLength + uint8Close.length
  );

  combinedBody.set(uint8Metadata, 0);
  combinedBody.set(new Uint8Array(fileArrayBuffer), uint8Metadata.length);
  combinedBody.set(uint8Close, uint8Metadata.length + fileArrayBuffer.byteLength);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combinedBody,
    }
  );

  if (!res.ok) {
    return throwDriveApiError(res, 'Falha no envio do arquivo para o Google Drive.');
  }

  return await res.json();
}

/** Downloads the latest binary contents of an existing Drive file. */
export async function downloadFileFromDrive(accessToken: string, fileId: string): Promise<Blob> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return throwDriveApiError(response, 'Falha ao baixar a versão atual do Google Drive.');
  }
  return response.blob();
}

/** Replaces the binary contents of an existing file in Google Drive. */
export async function updateDriveFile(
  accessToken: string,
  fileId: string,
  contentBlob: Blob,
  mimeType: string = 'application/octet-stream'
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: contentBlob,
    }
  );

  if (!response.ok) {
    return throwDriveApiError(response, 'Falha ao atualizar o arquivo editado no Google Drive.');
  }
}

/**
 * Deletes a file or folder from Google Drive
 */
export async function deleteFileFromDrive(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    return throwDriveApiError(res, 'Falha ao excluir item do Google Drive.');
  }
}

/**
 * Retrieves the user's Google Drive storage quota (used and limit)
 */
export async function getDriveStorageQuota(accessToken: string): Promise<DriveStorageQuota> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      return data.storageQuota || {};
    }
  } catch (err) {
    console.warn('Não foi possível obter cota do Drive:', err);
  }
  return {};
}

/**
 * Batch-syncs all current local items to Google Drive inside the 'Nexus Workspace' folder
 */
export async function syncAllItemsToGoogleDrive(
  accessToken: string,
  items: FileItem[],
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<Record<string, string>> {
  const rootDriveId = await ensureAppRootFolder(accessToken);
  const localToDriveIdMap: Record<string, string> = {};

  const activeItems = items.filter((i) => !i.trashed);
  const folders = activeItems.filter((i) => i.type === 'folder');
  const notebooks = activeItems.filter((i) => i.type === 'notebook');
  const filesAndNotes = activeItems.filter((i) => i.type === 'file' || i.type === 'note');

  let processed = 0;
  const total = activeItems.length;

  // 1. Sync Folders
  for (const folder of folders) {
    onProgress?.(++processed, total, `Pasta: ${folder.name}`);
    const parentDriveId = folder.parentId ? localToDriveIdMap[folder.parentId] || rootDriveId : rootDriveId;
    const driveFolder = await createDriveFolder(accessToken, folder.name, parentDriveId);
    localToDriveIdMap[folder.id] = driveFolder.id;
  }

  // 2. Sync Notebooks
  for (const notebook of notebooks) {
    onProgress?.(++processed, total, `Caderno: ${notebook.name}`);
    const parentDriveId = notebook.parentId ? localToDriveIdMap[notebook.parentId] || rootDriveId : rootDriveId;
    const driveNotebook = await createDriveFolder(accessToken, `[Caderno] ${notebook.name}`, parentDriveId);
    localToDriveIdMap[notebook.id] = driveNotebook.id;
  }

  // 3. Sync Files & Notes
  for (const file of filesAndNotes) {
    onProgress?.(++processed, total, file.name);
    const parentDriveId = file.parentId ? localToDriveIdMap[file.parentId] || rootDriveId : rootDriveId;

    let blob: Blob;
    if (file.blobKey) {
      blob = (await getBlob(file.blobKey)) || new Blob([file.content || ''], { type: file.mimeType || 'text/plain' });
    } else {
      blob = new Blob([file.content || `Nexus Note: ${file.name}`], {
        type: file.mimeType || (file.extension === 'md' ? 'text/markdown' : 'application/octet-stream'),
      });
    }

    const driveFile = await uploadFileToDrive(
      accessToken,
      file.name,
      blob,
      parentDriveId,
      file.mimeType || 'application/octet-stream'
    );
    localToDriveIdMap[file.id] = driveFile.id;
  }

  return localToDriveIdMap;
}
