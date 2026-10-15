import { FileItem } from '../types';
import { getBlob, saveBlob } from './storage';
import {
  downloadDesktopFile,
  DesktopLibraryFile,
  DesktopSyncSession,
  getDesktopLibraryManifest,
  saveDesktopDriveMapping,
  sha256,
  uploadDesktopFile,
} from './desktopSync';
import {
  downloadFileFromDrive,
  ensureAppRootFolder,
  updateDriveFile,
  uploadFileToDrive,
} from './googleDriveStorage';

const SYNCABLE_EXTENSIONS = new Set(['pdf', 'xopp', 'xoj', 'png', 'jpg', 'jpeg', 'webp']);

function canSync(item: FileItem) {
  return !item.trashed
    && (item.type === 'file' || item.type === 'note')
    && SYNCABLE_EXTENSIONS.has((item.extension || item.name.split('.').pop() || '').toLowerCase());
}

function itemBlob(item: FileItem) {
  return item.blobKey
    ? getBlob(item.blobKey).then((blob) => blob || new Blob([item.content || ''], { type: item.mimeType || 'application/octet-stream' }))
    : Promise.resolve(new Blob([item.content || ''], { type: item.mimeType || 'application/octet-stream' }));
}

function matchesDesktopIdentity(item: FileItem, desktopFile: DesktopLibraryFile) {
  return item.metadata?.desktopEntryId === desktopFile.id
    || Boolean(desktopFile.driveFileId && item.driveFileId === desktopFile.driveFileId);
}

function matchingSiteIndex(items: FileItem[], desktopFiles: DesktopLibraryFile[], desktopFile: DesktopLibraryFile) {
  const identityMatch = items.findIndex((item) => matchesDesktopIdentity(item, desktopFile));
  if (identityMatch >= 0) return identityMatch;
  const sameNameDesktopFiles = desktopFiles.filter((file) => file.name.toLocaleLowerCase() === desktopFile.name.toLocaleLowerCase());
  if (sameNameDesktopFiles.length !== 1) return -1;
  const sameNameSiteItems = items.map((item, index) => ({ item, index }))
    .filter(({ item }) => canSync(item) && item.name.toLocaleLowerCase() === desktopFile.name.toLocaleLowerCase());
  return sameNameSiteItems.length === 1 ? sameNameSiteItems[0].index : -1;
}

function newSiteItem(desktopFile: DesktopLibraryFile, driveFileId: string, blob: Blob): FileItem {
  const id = `desktop-${desktopFile.id}`;
  const blobKey = `blob_${id}`;
  return {
    id,
    name: desktopFile.name,
    type: 'file',
    parentId: null,
    createdAt: desktopFile.modifiedAt,
    updatedAt: desktopFile.modifiedAt,
    size: blob.size,
    mimeType: blob.type || 'application/octet-stream',
    extension: desktopFile.extension.replace(/^\./, '').toLowerCase(),
    blobKey,
    tags: [desktopFile.extension, 'desktop-sync'],
    starred: false,
    trashed: false,
    driveFileId,
    metadata: { desktopEntryId: desktopFile.id },
  };
}

/** Synchronizes binary files in both directions using the Electron app's one-use local endpoint. */
export async function syncDesktopLibrary(
  accessToken: string,
  session: DesktopSyncSession,
  currentItems: FileItem[],
  onProgress?: (message: string) => void,
): Promise<FileItem[]> {
  const desktopFiles = (await getDesktopLibraryManifest(session))
    .filter((file) => SYNCABLE_EXTENSIONS.has(file.extension.replace(/^\./, '').toLowerCase()));
  const nextItems = [...currentItems];
  const handledSiteIds = new Set<string>();
  const driveRootId = await ensureAppRootFolder(accessToken);

  for (const [index, desktopFile] of desktopFiles.entries()) {
    onProgress?.(`Sincronizando app → site ${index + 1}/${desktopFiles.length}: ${desktopFile.name}`);
    const matchIndex = matchingSiteIndex(nextItems, desktopFiles, desktopFile);
    if (matchIndex < 0) {
      const blob = await downloadDesktopFile(session, desktopFile.id);
      const uploaded = await uploadFileToDrive(accessToken, desktopFile.name, blob, driveRootId, blob.type || 'application/octet-stream');
      const item = newSiteItem(desktopFile, uploaded.id, blob);
      await saveBlob(item.blobKey!, blob);
      nextItems.push(item);
      await saveDesktopDriveMapping(session, desktopFile.id, uploaded.id, item.updatedAt);
      continue;
    }

    let item = nextItems[matchIndex];
    handledSiteIds.add(item.id);
    let driveFileId = item.driveFileId || desktopFile.driveFileId || '';
    let siteBlob = await itemBlob(item);
    if (!siteBlob.size && driveFileId) siteBlob = await downloadFileFromDrive(accessToken, driveFileId);
    if (!driveFileId) {
      const uploaded = await uploadFileToDrive(accessToken, item.name, siteBlob, driveRootId, item.mimeType || 'application/octet-stream');
      driveFileId = uploaded.id;
    }

    if (desktopFile.modifiedAt > item.updatedAt + 1000) {
      const desktopBlob = await downloadDesktopFile(session, desktopFile.id);
      await updateDriveFile(accessToken, driveFileId, desktopBlob, item.mimeType || desktopBlob.type || 'application/octet-stream');
      const updatedAt = Math.max(Date.now(), desktopFile.modifiedAt);
      const blobKey = item.blobKey || `blob_${item.id}`;
      await saveBlob(blobKey, desktopBlob);
      item = { ...item, driveFileId, blobKey, size: desktopBlob.size, updatedAt, metadata: { ...item.metadata, desktopEntryId: desktopFile.id } };
      await uploadDesktopFile(session, { id: desktopFile.id, name: desktopFile.name, extension: desktopFile.extension, driveFileId, modifiedAt: updatedAt }, desktopBlob);
    } else {
      const actualSiteBlob = siteBlob.size ? siteBlob : await downloadFileFromDrive(accessToken, driveFileId);
      if (await sha256(actualSiteBlob) !== desktopFile.sha256) {
        await uploadDesktopFile(session, { id: desktopFile.id, name: desktopFile.name, extension: desktopFile.extension, driveFileId, modifiedAt: item.updatedAt }, actualSiteBlob);
      }
      item = { ...item, driveFileId, metadata: { ...item.metadata, desktopEntryId: desktopFile.id } };
      await saveDesktopDriveMapping(session, desktopFile.id, driveFileId, item.updatedAt);
    }
    nextItems[matchIndex] = item;
  }

  const siteOnlyFiles = nextItems.filter((item) => canSync(item) && !handledSiteIds.has(item.id)
    && !desktopFiles.some((file) => matchesDesktopIdentity(item, file)));
  for (const [index, item] of siteOnlyFiles.entries()) {
    onProgress?.(`Sincronizando site → app ${index + 1}/${siteOnlyFiles.length}: ${item.name}`);
    let driveFileId = item.driveFileId || '';
    let blob = await itemBlob(item);
    if (!driveFileId) {
      const uploaded = await uploadFileToDrive(accessToken, item.name, blob, driveRootId, item.mimeType || 'application/octet-stream');
      driveFileId = uploaded.id;
    }
    if (!blob.size) blob = await downloadFileFromDrive(accessToken, driveFileId);
    const response = await uploadDesktopFile(session, {
      name: item.name,
      extension: item.extension || item.name.split('.').pop() || '',
      driveFileId,
      modifiedAt: item.updatedAt,
    }, blob);
    const desktopEntryId = response?.id;
    nextItems[nextItems.findIndex((candidate) => candidate.id === item.id)] = {
      ...item,
      driveFileId,
      metadata: { ...item.metadata, ...(desktopEntryId ? { desktopEntryId } : {}) },
    };
  }

  return nextItems;
}
