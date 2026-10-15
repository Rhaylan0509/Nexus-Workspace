/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Menu,
  UploadCloud,
  FilePlus,
  BookPlus,
  FolderPlus,
  RotateCcw,
  Trash2,
  Undo2,
  FolderOpen,
  BookOpen,
  Folder,
  Cloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  FileItem,
  FilterCategory,
  FileTypeFilter,
  ViewMode,
  SortField,
  SortDirection,
  BreadcrumbItem,
  QuickLink,
  ItemType,
} from './types';
import { INITIAL_FILES, INITIAL_QUICK_LINKS } from './data/initialData';
import { getBlob, triggerFileDownload, saveBlob } from './lib/storage';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ExplorerToolbar } from './components/ExplorerToolbar';
import { FileGrid } from './components/FileGrid';
import { FileTable } from './components/FileTable';
import { ItemPreviewModal } from './components/ItemPreviewModal';
import { CreateItemModal } from './components/CreateItemModal';
import { UploadModal } from './components/UploadModal';
import { RenameModal } from './components/RenameModal';
import { MoveItemModal } from './components/MoveItemModal';
import { ProductivityHubDrawer } from './components/ProductivityHubDrawer';
import { ConfirmModal } from './components/ConfirmModal';
import { CalendarPanel } from './components/CalendarPanel';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleCalendarSignIn,
  logout,
  getAccessToken,
  getGoogleAuthErrorMessage,
} from './lib/firebaseAuth';
import {
  syncAllItemsToGoogleDrive,
  getDriveStorageQuota,
  GoogleDriveApiError,
  DriveStorageQuota,
} from './lib/googleDriveStorage';
import { syncDesktopLibrary } from './lib/desktopLibrarySync';
import { DesktopSyncSession, finishDesktopSync, readDesktopSyncSession } from './lib/desktopSync';

const STORAGE_KEY_ITEMS = 'nexus_workspace_items_zero_v1';
const STORAGE_KEY_LINKS = 'nexus_quick_links_v6';

export default function App() {
  // Items state with clean zero-start
  const [items, setItems] = useState<FileItem[]>(() => {
    try {
      // Clear any legacy mock items
      localStorage.removeItem('nexus_file_items_v5');
      localStorage.removeItem('nexus_file_items_v4');
      localStorage.removeItem('nexus_file_items');

      const stored = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Verify no leftover mock items
          const hasLegacyMock = parsed.some((i: any) =>
            i.id === 'folder-ferretto' || i.id === 'folder-simulado'
          );
          if (!hasLegacyMock) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse stored items:', e);
    }
    return INITIAL_FILES; // starts at empty array []
  });

  // Quick links state
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LINKS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse quick links:', e);
    }
    return INITIAL_QUICK_LINKS;
  });

  // Google Drive Authentication & Storage State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveQuota, setDriveQuota] = useState<DriveStorageQuota | null>(null);
  const [isDriveSyncing, setIsDriveSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [desktopSyncSession, setDesktopSyncSession] = useState<DesktopSyncSession | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('nexus_last_drive_sync');
    return saved ? parseInt(saved, 10) : null;
  });

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setDriveToken(token);
        getDriveStorageQuota(token).then((q) => setDriveQuota(q));
      },
      () => {
        setGoogleUser(null);
        setDriveToken(null);
        setDriveQuota(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    const session = readDesktopSyncSession();
    if (!session) return;
    setDesktopSyncSession(session);
    setSyncStatusMessage('Xournal++ Desktop conectado. Conecte o Google Drive e clique em Sincronizar para transferir os arquivos.');
  }, []);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items to localStorage:', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LINKS, JSON.stringify(quickLinks));
    } catch (e) {
      console.error('Failed to save quick links to localStorage:', e);
    }
  }, [quickLinks]);

  // Navigation and Filter state
  const [currentCategory, setCurrentCategory] = useState<FilterCategory>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modals state
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [previewInitialMode, setPreviewInitialMode] = useState<'preview' | 'edit'>('preview');
  const [editingItem, setEditingItem] = useState<FileItem | null>(null);
  const [movingItem, setMovingItem] = useState<FileItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialType, setCreateModalInitialType] = useState<ItemType>('folder');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProductivityDrawerOpen, setIsProductivityDrawerOpen] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [googleCalendarToken, setGoogleCalendarToken] = useState<string | null>(null);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Global Drag-over state for drop-to-upload
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Map of parentId -> count of active children
  const allChildrenMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      if (!item.trashed && item.parentId) {
        map[item.parentId] = (map[item.parentId] || 0) + 1;
      }
    });
    return map;
  }, [items]);

  // Current folder/notebook item
  const currentFolderItem = useMemo(() => {
    if (!currentFolderId) return null;
    return items.find((i) => i.id === currentFolderId) || null;
  }, [items, currentFolderId]);

  // Compute Breadcrumb trail
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ id: null, name: 'Início', type: 'root' }];
    if (!currentFolderId) return crumbs;

    const path: BreadcrumbItem[] = [];
    let currId: string | null = currentFolderId;

    while (currId) {
      const found = items.find((i) => i.id === currId);
      if (!found) break;
      path.unshift({ id: found.id, name: found.name, type: found.type });
      currId = found.parentId;
    }

    return [...crumbs, ...path];
  }, [items, currentFolderId]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (currentCategory === 'trash') {
      result = result.filter((i) => i.trashed);
    } else if (currentCategory === 'starred') {
      result = result.filter((i) => i.starred && !i.trashed);
    } else {
      if (!searchQuery.trim()) {
        result = result.filter((i) => !i.trashed && i.parentId === currentFolderId);
      } else {
        result = result.filter((i) => !i.trashed);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.extension?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.content?.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'notebook') {
        result = result.filter((i) => i.type === 'notebook');
      } else if (typeFilter === 'pdf') {
        result = result.filter((i) => i.extension === 'pdf');
      } else if (typeFilter === 'xopp') {
        result = result.filter((i) => i.extension === 'xopp' || i.extension === 'xoj');
      } else if (typeFilter === 'md') {
        result = result.filter((i) => i.extension === 'md' || i.type === 'note');
      }
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'updatedAt') {
        comparison = a.updatedAt - b.updatedAt;
      } else if (sortField === 'size') {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        comparison = sizeA - sizeB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [
    items,
    currentCategory,
    currentFolderId,
    searchQuery,
    typeFilter,
    sortField,
    sortDirection,
  ]);

  // Handlers for Navigation
  const handleNavigateToFolder = (folderId: string | null) => {
    setIsCalendarView(false);
    setCurrentCategory('all');
    setCurrentFolderId(folderId);
    setSearchQuery('');
  };

  const handleNavigateBack = () => {
    if (!currentFolderItem) {
      setCurrentFolderId(null);
      return;
    }
    setCurrentFolderId(currentFolderItem.parentId);
  };

  const handleSelectCategory = (category: FilterCategory) => {
    setIsCalendarView(false);
    setCurrentCategory(category);
    if (category !== 'all') {
      setCurrentFolderId(null);
    }
  };

  // Google Drive Handlers
  const handleConnectDrive = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setDriveToken(res.accessToken);
        const quota = await getDriveStorageQuota(res.accessToken);
        setDriveQuota(quota);
        setSyncStatusMessage('Google Drive conectado com sucesso!');
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    } catch (err: unknown) {
      console.error('Erro ao conectar Google Drive:', err);
      setSyncStatusMessage(getGoogleAuthErrorMessage(err));
      window.setTimeout(() => setSyncStatusMessage(null), 15000);
    }
  };

  const handleConnectGoogleCalendar = async (): Promise<string | null> => {
    const result = await googleCalendarSignIn();
    if (!result) return null;
    setGoogleUser(result.user);
    setGoogleCalendarToken(result.accessToken);
    setDriveToken(result.accessToken);
    return result.accessToken;
  };

  const handleCalendarTokenExpired = () => {
    setGoogleCalendarToken(null);
    setDriveToken(null);
    setGoogleUser(null);
  };

  const handleDisconnectDrive = async () => {
    await logout();
    setGoogleUser(null);
    setDriveToken(null);
    setGoogleCalendarToken(null);
    setDriveQuota(null);
  };

  const handleSyncDrive = async () => {
    const token = driveToken || (await getAccessToken());
    if (!token) {
      await handleConnectDrive();
      return;
    }

    setIsDriveSyncing(true);
    setSyncStatusMessage('Iniciando sincronização com Google Drive...');

    try {
      let itemsToSync = items;
      if (desktopSyncSession) {
        itemsToSync = await syncDesktopLibrary(token, desktopSyncSession, itemsToSync, (message) => {
          setSyncStatusMessage(message);
        });
      }
      const driveIds = await syncAllItemsToGoogleDrive(token, itemsToSync, (curr, tot, name) => {
        setSyncStatusMessage(`Sincronizando ${curr}/${tot}: ${name}`);
      });
      itemsToSync = itemsToSync.map((item) => driveIds[item.id]
        ? { ...item, driveFileId: driveIds[item.id] }
        : item);
      setItems(itemsToSync);

      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('nexus_last_drive_sync', now.toString());
      const updatedQuota = await getDriveStorageQuota(token);
      setDriveQuota(updatedQuota);

      if (desktopSyncSession) {
        await finishDesktopSync(desktopSyncSession);
        setDesktopSyncSession(null);
        setSyncStatusMessage('Arquivos sincronizados entre o Xournal++ Desktop e o Google Drive.');
      } else {
        setSyncStatusMessage('Todos os itens foram sincronizados com o Google Drive!');
      }
      setTimeout(() => setSyncStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Erro ao sincronizar com Google Drive:', err);
      if (err instanceof GoogleDriveApiError && err.status === 401) {
        setGoogleUser(null);
        setDriveToken(null);
        setGoogleCalendarToken(null);
      }
      setSyncStatusMessage(err instanceof Error ? err.message : 'Erro ao sincronizar com Google Drive.');
      window.setTimeout(() => setSyncStatusMessage(null), 15000);
      if (desktopSyncSession) {
        await finishDesktopSync(desktopSyncSession, err instanceof Error ? err.message : 'Falha na sincronização.').catch(() => undefined);
        setDesktopSyncSession(null);
      }
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleResetWorkspace = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Limpar Espaço de Trabalho',
      message: 'Deseja realmente limpar todo o espaço de trabalho e começar do zero? Todos os itens locais serão removidos.',
      confirmLabel: 'Limpar Tudo',
      isDestructive: true,
      onConfirm: () => {
        setItems([]);
        localStorage.removeItem(STORAGE_KEY_ITEMS);
        localStorage.removeItem('nexus_file_items_v5');
        localStorage.removeItem('nexus_file_items_v4');
        setPreviewItem(null);
        setSyncStatusMessage('Espaço de trabalho limpo. Começando do zero!');
        setTimeout(() => setSyncStatusMessage(null), 3000);
      },
    });
  };

  const handlePreviewItem = (item: FileItem) => {
    setPreviewInitialMode('preview');
    setPreviewItem(item);
  };

  const handleEditItem = (item: FileItem) => {
    setPreviewInitialMode('edit');
    setPreviewItem(item);
  };

  // Handlers for Items
  const handleCreateItem = (newItemData: {
    name: string;
    type: ItemType;
    parentId: string | null;
    description?: string;
    content?: string;
    color?: string;
    metadata?: any;
  }) => {
    const ext = newItemData.name.split('.').pop()?.toLowerCase();
    const isXopp = ext === 'xopp' || ext === 'xoj';

    const newItem: FileItem = {
      id: `${newItemData.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newItemData.name,
      type: newItemData.type,
      parentId: newItemData.parentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [newItemData.type, ext || 'item'],
      starred: false,
      trashed: false,
      color: newItemData.color,
      description: newItemData.description,
      content: newItemData.content,
      metadata: newItemData.metadata,
      size: newItemData.content ? newItemData.content.length : isXopp ? 215000 : 512,
      extension: ext || (newItemData.type === 'note' ? 'md' : undefined),
    };

    setItems((prev) => [newItem, ...prev]);
  };

  const handleFilesUploaded = (newUploadedItems: FileItem[]) => {
    setItems((prev) => [...newUploadedItems, ...prev]);
  };

  const handleToggleStar = (item: FileItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, starred: !i.starred } : i))
    );
  };

  // User Confirmation for Destructive Operations using custom in-app modal (never blocked by iframes)
  const handleDeleteItem = (item: FileItem) => {
    if (item.trashed) {
      setConfirmModalState({
        isOpen: true,
        title: 'Excluir definitivamente',
        message: `Tem certeza de que deseja excluir permanentemente "${item.name}"? Esta ação removerá o arquivo definitivamente e não poderá ser desfeita.`,
        confirmLabel: 'Excluir Definitivamente',
        isDestructive: true,
        onConfirm: () => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          if (previewItem?.id === item.id) setPreviewItem(null);
        },
      });
    } else {
      setConfirmModalState({
        isOpen: true,
        title: 'Mover para a Lixeira',
        message: `Deseja mover "${item.name}" para a Lixeira? Você pode restaurá-lo a qualquer momento.`,
        confirmLabel: 'Mover para Lixeira',
        isDestructive: true,
        onConfirm: () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, trashed: true, trashedAt: Date.now() } : i
            )
          );
          if (previewItem?.id === item.id) setPreviewItem(null);
        },
      });
    }
  };

  const handleRestoreItem = (item: FileItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, trashed: false } : i))
    );
  };

  const handleRenameItem = (itemId: string, newName: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, name: newName, updatedAt: Date.now() } : i
      )
    );
  };

  const handleMoveItem = (itemId: string, targetParentId: string | null) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, parentId: targetParentId, updatedAt: Date.now() } : i
      )
    );
  };

  const handleUpdateItemContent = (itemId: string, newContent: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              content: newContent,
              size: newContent.length,
              updatedAt: Date.now(),
            }
          : i
      )
    );
  };

  const handleDownloadItem = async (item: FileItem) => {
    if (item.blobKey) {
      const blob = await getBlob(item.blobKey);
      if (blob) {
        triggerFileDownload(blob, item.name);
        return;
      }
    }
    const blob = new Blob([item.content || `Nexus Workspace - ${item.name}`], {
      type: item.mimeType || 'text/plain',
    });
    triggerFileDownload(blob, item.name);
  };

  const handleConvertScratchpadToNote = (title: string, content: string) => {
    handleCreateItem({
      name: `${title}.md`,
      type: 'note',
      parentId: currentFolderId,
      content,
      description: 'Nota rápida em Markdown.',
    });
  };

  // Quick Links Handlers
  const handleAddQuickLink = (linkData: Omit<QuickLink, 'id'>) => {
    const newLink: QuickLink = {
      ...linkData,
      id: `link-${Date.now()}`,
    };
    setQuickLinks((prev) => [...prev, newLink]);
  };

  const handleDeleteQuickLink = (id: string) => {
    setQuickLinks((prev) => prev.filter((l) => l.id !== id));
  };

  // Reset sample files
  const handleResetSampleData = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Restaurar Dados de Exemplo',
      message: 'Deseja recarregar a estrutura padrão com pastas, cadernos e notas?',
      confirmLabel: 'Restaurar',
      isDestructive: false,
      onConfirm: () => {
        setItems(INITIAL_FILES);
        setQuickLinks(INITIAL_QUICK_LINKS);
        setCurrentFolderId(null);
        setCurrentCategory('all');
      },
    });
  };

  // Window drag & drop handler
  const handleWindowDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsWindowDragging(true);
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    if (e.clientX <= 0 || e.clientY <= 0) {
      setIsWindowDragging(false);
    }
  };

  const handleWindowDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsWindowDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      const newItems: FileItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const blobKey = `blob-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        await saveBlob(blobKey, file);

        let content: string | undefined = undefined;
        let itemType: ItemType = 'file';
        if (ext === 'md' || ext === 'txt') {
          itemType = 'note';
          try {
            content = await file.text();
          } catch (err) {
            content = '';
          }
        } else if (ext === 'xopp' || ext === 'xoj') {
          itemType = 'note';
        }

        newItems.push({
          id: `file-${Date.now()}-${i}`,
          name: file.name,
          type: itemType,
          parentId: currentFolderId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          extension: ext,
          blobKey,
          content,
          tags: [ext],
          starred: false,
          trashed: false,
          description:
            ext === 'xopp' || ext === 'xoj'
              ? 'Arquivo de anotações manuscritas do Xournal++'
              : undefined,
        });
      }

      setItems((prev) => [...newItems, ...prev]);
    }
  };

  return (
    <div
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      className="min-h-screen bg-[#fafafa] text-neutral-900 flex flex-col font-sans"
    >
      {/* Toast Notification for Sync & Drive */}
      {syncStatusMessage && (
        <div role="status" aria-live="polite" className="fixed top-18 right-6 z-50 max-w-xl bg-neutral-900 text-white text-xs leading-relaxed px-4 py-3 rounded-xl shadow-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{syncStatusMessage}</span>
        </div>
      )}

      {/* Full-window Drag Backdrop overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-6 border-4 border-dashed border-white">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl space-y-3">
            <UploadCloud className="w-12 h-12 text-neutral-900 mx-auto animate-bounce" />
            <h3 className="text-base font-bold text-neutral-900">
              Solte seus documentos aqui!
            </h3>
            <p className="text-xs text-neutral-500">
              {currentFolderItem
                ? `Os arquivos serão adicionados dentro de "${currentFolderItem.name}".`
                : 'Os arquivos serão organizados na raiz do seu explorador.'}
            </p>
          </div>
        </div>
      )}

      {/* 1. Header (Strict Top Bar Contract: Explorador & Ferramentas) */}
      <TopNav
        currentCategory={currentCategory}
        onSelectCategory={handleSelectCategory}
        onOpenNewModal={() => {
          setCreateModalInitialType('folder');
          setIsCreateModalOpen(true);
        }}
        onOpenProductivityDrawer={() => setIsProductivityDrawerOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        googleUser={googleUser}
        onConnectDrive={handleConnectDrive}
      />

      {/* 2. Main Content Area: Simplified Sidebar + Workspace */}
      <div className="flex-1 flex w-full max-w-[1536px] mx-auto">
        {/* Mobile Sidebar Hamburger Toggle */}
        <div className="md:hidden fixed bottom-4 right-4 z-30">
          <button
            onClick={() => setIsSidebarMobileOpen(true)}
            className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-lg hover:bg-neutral-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Simplified Sidebar: Tree removed as requested, with Google Drive storage hub */}
        <Sidebar
          items={items}
          currentCategory={currentCategory}
          currentFolderId={currentFolderId}
          onSelectCategory={handleSelectCategory}
          onNavigateToFolder={handleNavigateToFolder}
          onOpenCalendar={() => setIsCalendarView(true)}
          isCalendarView={isCalendarView}
          onOpenProductivityDrawer={() => setIsProductivityDrawerOpen(true)}
          isOpenMobile={isSidebarMobileOpen}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
          googleUser={googleUser}
          isDriveSyncing={isDriveSyncing}
          lastSyncTime={lastSyncTime}
          driveQuota={driveQuota}
          onConnectDrive={handleConnectDrive}
          onDisconnectDrive={handleDisconnectDrive}
          onSyncDrive={handleSyncDrive}
          syncLabel={desktopSyncSession ? 'Sincronizar com app' : 'Sincronizar com Drive'}
          onResetWorkspace={handleResetWorkspace}
        />

        {/* Workspace Main Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className={isCalendarView ? 'block' : 'hidden'}>
            <CalendarPanel
              accessToken={googleCalendarToken}
              onConnectGoogleCalendar={handleConnectGoogleCalendar}
              onCalendarTokenExpired={handleCalendarTokenExpired}
            />
          </div>
          <div className={isCalendarView ? 'hidden' : 'block'}>
          {/* Breadcrumbs Navigation with clickable hierarchy trail */}
          <Breadcrumbs
            breadcrumbs={breadcrumbs}
            currentFolderItem={currentFolderItem}
            onNavigate={handleNavigateToFolder}
            onNavigateBack={handleNavigateBack}
          />

          {/* Current Location Header */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
            <div>
              <div className="flex items-center gap-2.5">
                {currentFolderItem?.type === 'notebook' ? (
                  <div className="w-6 h-6 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                ) : currentFolderItem?.type === 'folder' ? (
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                ) : null}

                <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                  {currentCategory === 'trash'
                    ? 'Lixeira'
                    : currentCategory === 'starred'
                    ? 'Arquivos Favoritos'
                    : currentFolderItem
                    ? currentFolderItem.name
                    : 'Explorador de Arquivos'}
                </h1>
              </div>

              <p className="text-xs text-neutral-500 mt-1">
                {currentCategory === 'trash'
                  ? 'Itens excluídos. Você pode restaurá-los ou apagá-los definitivamente.'
                  : currentCategory === 'starred'
                  ? 'Seus itens marcados com estrela para acesso rápido.'
                  : currentFolderItem?.type === 'notebook'
                  ? `Caderno de estudos · Contém anotações Xournal++ (.xopp), resumos em Markdown (.md) e PDFs.`
                  : currentFolderItem?.description
                  ? currentFolderItem.description
                  : 'Navegue pelas pastas e cadernos com armazenamento e sincronização no seu Google Drive.'}
              </p>
            </div>

            {/* Trash Actions */}
            {currentCategory === 'trash' && filteredItems.length > 0 && (
              <button
                onClick={() => {
                  setConfirmModalState({
                    isOpen: true,
                    title: 'Esvaziar Lixeira',
                    message: 'Deseja esvaziar a lixeira permanentemente? Esta ação apagará todos os itens definitivamente.',
                    confirmLabel: 'Esvaziar Lixeira',
                    isDestructive: true,
                    onConfirm: () => {
                      setItems((prev) => prev.filter((i) => !i.trashed));
                    },
                  });
                }}
                className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Esvaziar Lixeira</span>
              </button>
            )}
          </div>

          {/* Explorer Toolbar: Search, Filters, View Modes, Sorting, New */}
          <ExplorerToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(field) => {
              if (sortField === field) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            onOpenCreateModal={(type) => {
              if (type) setCreateModalInitialType(type);
              setIsCreateModalOpen(true);
            }}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            totalFilteredCount={filteredItems.length}
          />

          {/* Explorer Items View (Grid or Table) */}
          <div className="mt-5">
            {filteredItems.length === 0 ? (
              /* State Completeness: Empty State with Action */
              <div className="py-16 text-center border-2 border-dashed border-neutral-300 rounded-2xl bg-white p-8 space-y-4 max-w-2xl mx-auto shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  {currentFolderItem?.type === 'notebook' ? (
                    <BookOpen className="w-7 h-7 text-orange-500" />
                  ) : currentFolderItem?.type === 'folder' ? (
                    <FolderOpen className="w-7 h-7 text-blue-600" />
                  ) : (
                    <FolderPlus className="w-7 h-7 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    {searchQuery
                      ? 'Nenhum resultado encontrado'
                      : currentFolderItem?.type === 'notebook'
                      ? `Caderno "${currentFolderItem.name}" vazio`
                      : currentFolderItem?.type === 'folder'
                      ? `Pasta "${currentFolderItem.name}" vazia`
                      : 'Comece do zero seu Espaço de Trabalho'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                    {searchQuery
                      ? 'Nenhum arquivo ou documento corresponde aos termos da sua pesquisa.'
                      : currentFolderItem?.type === 'notebook'
                      ? 'Adicione notas (.md ou .xopp) e envie documentos PDF ou anotações para este caderno.'
                      : currentFolderItem?.type === 'folder'
                      ? 'Adicione cadernos temáticos, notas ou envie arquivos diretamente para esta pasta.'
                      : 'Sem arquivos de exemplo. Crie pastas, cadernos e notas personalizadas ou conecte ao Google Drive para sincronizar seus documentos.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {!currentFolderItem && (
                    <button
                      onClick={() => {
                        setCreateModalInitialType('folder');
                        setIsCreateModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <FolderPlus className="w-4 h-4 text-blue-600" />
                      <span>Nova Pasta</span>
                    </button>
                  )}

                  {currentFolderItem?.type !== 'notebook' && (
                    <button
                      onClick={() => {
                        setCreateModalInitialType('notebook');
                        setIsCreateModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <BookPlus className="w-4 h-4 text-orange-500" />
                      <span>Novo Caderno</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setCreateModalInitialType('note');
                      setIsCreateModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    <FilePlus className="w-4 h-4 text-emerald-600" />
                    <span>Nova Nota (.md / .xopp)</span>
                  </button>

                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Enviar Arquivos</span>
                  </button>

                  {!googleUser && !currentFolderItem && (
                    <button
                      onClick={handleConnectDrive}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer"
                    >
                      <Cloud className="w-4 h-4 text-blue-600" />
                      <span>Conectar Google Drive</span>
                    </button>
                  )}
                </div>
              </div>
            ) : currentCategory === 'trash' ? (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between text-xs hover:bg-neutral-50/80"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-medium text-neutral-800 truncate">{item.name}</span>
                      <span className="text-neutral-400 font-mono">
                        · {item.extension ? `.${item.extension}` : item.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestoreItem(item)}
                        className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir Definitivamente</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'grid' ? (
              <FileGrid
                items={filteredItems}
                allChildrenMap={allChildrenMap}
                onOpenItem={(item) => handleNavigateToFolder(item.id)}
                onPreviewItem={handlePreviewItem}
                onEditItem={handleEditItem}
                onToggleStar={handleToggleStar}
                onRenameItem={(item) => setEditingItem(item)}
                onDeleteItem={handleDeleteItem}
                onDownloadItem={handleDownloadItem}
                onMoveItem={(item) => setMovingItem(item)}
              />
            ) : (
              <FileTable
                items={filteredItems}
                allChildrenMap={allChildrenMap}
                onOpenItem={(item) => handleNavigateToFolder(item.id)}
                onPreviewItem={handlePreviewItem}
                onEditItem={handleEditItem}
                onToggleStar={handleToggleStar}
                onRenameItem={(item) => setEditingItem(item)}
                onDeleteItem={handleDeleteItem}
                onDownloadItem={handleDownloadItem}
                onMoveItem={(item) => setMovingItem(item)}
              />
            )}
          </div>
          </div>
        </main>
      </div>

      {/* 3. Modals and Drawers */}
      {previewItem && (
        <ItemPreviewModal
          item={previewItem}
          allItems={items}
          initialMode={previewInitialMode}
          onClose={() => setPreviewItem(null)}
          onUpdateItemContent={handleUpdateItemContent}
          onUpdateItemMetadata={(itemId, newMetadata) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === itemId
                  ? { ...i, metadata: newMetadata, updatedAt: Date.now() }
                  : i
              )
            );
            setPreviewItem((prev) =>
              prev && prev.id === itemId
                ? { ...prev, metadata: newMetadata, updatedAt: Date.now() }
                : prev
            );
          }}
          onDeleteItem={handleDeleteItem}
          onRenameItem={(item) => setEditingItem(item)}
        />
      )}

      {isCreateModalOpen && (
        <CreateItemModal
          initialType={createModalInitialType}
          currentFolderId={currentFolderId}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateItem={handleCreateItem}
        />
      )}

      {isUploadModalOpen && (
        <UploadModal
          currentFolderId={currentFolderId}
          onClose={() => setIsUploadModalOpen(false)}
          onFilesUploaded={handleFilesUploaded}
        />
      )}

      {editingItem && (
        <RenameModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onRename={handleRenameItem}
        />
      )}

      {movingItem && (
        <MoveItemModal
          item={movingItem}
          allItems={items}
          onClose={() => setMovingItem(null)}
          onMoveItem={handleMoveItem}
        />
      )}

      <ProductivityHubDrawer
        isOpen={isProductivityDrawerOpen}
        onClose={() => setIsProductivityDrawerOpen(false)}
        quickLinks={quickLinks}
        onAddQuickLink={handleAddQuickLink}
        onDeleteQuickLink={handleDeleteQuickLink}
        onConvertScratchpadToNote={handleConvertScratchpadToNote}
      />

      {/* Custom in-app Confirmation Dialog (100% reliable inside iframes) */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmLabel={confirmModalState.confirmLabel}
        cancelLabel={confirmModalState.cancelLabel}
        isDestructive={confirmModalState.isDestructive}
        onConfirm={confirmModalState.onConfirm}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
