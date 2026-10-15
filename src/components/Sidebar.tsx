import React from 'react';
import {
  FolderOpen,
  Star,
  Trash2,
  HardDrive,
  Sparkles,
  Cloud,
  CheckCircle2,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { FileItem, FilterCategory } from '../types';
import { formatBytes } from '../lib/storage';
import { User } from 'firebase/auth';
import { DriveStorageQuota } from '../lib/googleDriveStorage';

interface SidebarProps {
  items: FileItem[];
  currentCategory: FilterCategory;
  currentFolderId: string | null;
  onSelectCategory: (category: FilterCategory) => void;
  onNavigateToFolder: (folderId: string | null) => void;
  onOpenProductivityDrawer: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  // Google Drive state
  googleUser: User | null;
  isDriveSyncing: boolean;
  lastSyncTime: number | null;
  driveQuota: DriveStorageQuota | null;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  onSyncDrive: () => void;
  onResetWorkspace?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  currentCategory,
  currentFolderId,
  onSelectCategory,
  onNavigateToFolder,
  onOpenProductivityDrawer,
  isOpenMobile,
  onCloseMobile,
  googleUser,
  isDriveSyncing,
  lastSyncTime,
  driveQuota,
  onConnectDrive,
  onDisconnectDrive,
  onSyncDrive,
}) => {
  const activeItems = items.filter((i) => !i.trashed);
  const trashedItems = items.filter((i) => i.trashed);
  const starredItems = items.filter((i) => i.starred && !i.trashed);

  const totalLocalBytes = activeItems.reduce((acc, curr) => acc + (curr.size || 500), 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-neutral-900/30 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-neutral-200 z-40 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Explorador Navigation */}
        <div className="p-3.5 space-y-1">
          <div className="px-2.5 pb-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Explorador
          </div>

          {/* Root Explorer Button */}
          <button
            onClick={() => {
              onSelectCategory('all');
              onNavigateToFolder(null);
              if (isOpenMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
              currentCategory === 'all' && currentFolderId === null
                ? 'bg-neutral-900 text-white font-medium shadow-2xs'
                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen
                className={`w-4 h-4 shrink-0 ${
                  currentCategory === 'all' && currentFolderId === null
                    ? 'text-white'
                    : 'text-neutral-700'
                }`}
              />
              <span className="truncate font-medium">Início / Raiz</span>
            </div>
            <span
              className={`text-[11px] font-mono tabular-nums ${
                currentCategory === 'all' && currentFolderId === null
                  ? 'text-neutral-300'
                  : 'text-neutral-400'
              }`}
            >
              {activeItems.length}
            </span>
          </button>

          {/* Favoritos */}
          <button
            onClick={() => {
              onSelectCategory('starred');
              if (isOpenMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
              currentCategory === 'starred'
                ? 'bg-neutral-900 text-white font-medium'
                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star
                className={`w-4 h-4 ${
                  currentCategory === 'starred' ? 'text-amber-300 fill-amber-300' : 'text-amber-500'
                }`}
              />
              <span>Favoritos</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-neutral-400">
              {starredItems.length}
            </span>
          </button>

          {/* Lixeira */}
          <button
            onClick={() => {
              onSelectCategory('trash');
              if (isOpenMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
              currentCategory === 'trash'
                ? 'bg-neutral-900 text-white font-medium'
                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-neutral-400" />
              <span>Lixeira</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-neutral-400">
              {trashedItems.length}
            </span>
          </button>
        </div>

        {/* Google Drive Storage Center */}
        <div className="p-3.5 border-t border-neutral-100 flex-1 overflow-y-auto space-y-3">
          <div className="px-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Armazenamento</span>
            {googleUser && (
              <span className="text-emerald-700 font-medium font-sans flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Google Drive</span>
              </span>
            )}
          </div>

          {/* If connected to Google Drive */}
          {googleUser ? (
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-2.5 text-xs text-blue-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || 'Google'}
                      className="w-6 h-6 rounded-full shrink-0 border border-blue-300"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                      G
                    </div>
                  )}
                  <div className="truncate">
                    <p className="font-semibold text-neutral-900 truncate text-[11.5px]">
                      {googleUser.displayName || 'Usuário Google'}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate">{googleUser.email}</p>
                  </div>
                </div>

                <button
                  onClick={onDisconnectDrive}
                  className="p-1 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Desconectar Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sync Action */}
              <button
                onClick={onSyncDrive}
                disabled={isDriveSyncing}
                className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-spin' : ''}`} />
                <span>{isDriveSyncing ? 'Sincronizando...' : 'Sincronizar com Drive'}</span>
              </button>

              {lastSyncTime && (
                <p className="text-[10px] text-blue-800/80 text-center font-mono">
                  Última sincronização:{' '}
                  {new Date(lastSyncTime).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}

              {/* Drive Quota */}
              {driveQuota?.usage && (
                <div className="pt-1.5 border-t border-blue-200/60 text-[10.5px] text-blue-900/80 flex items-center justify-between font-mono">
                  <span>Espaço no Drive:</span>
                  <span className="font-semibold tabular-nums">
                    {formatBytes(parseInt(driveQuota.usage))}
                    {driveQuota.limit ? ` / ${formatBytes(parseInt(driveQuota.limit))}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Sign in with Google Drive Button (Required Official Style) */
            <div className="p-3 bg-neutral-50 border border-neutral-200/90 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-neutral-800 font-semibold text-[11.5px]">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Usar Google Drive</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Conecte seu Google Drive para salvar e acessar seus cadernos, PDFs e notas de qualquer lugar.
              </p>

              {/* Official Google Sign-In Button */}
              <button
                onClick={onConnectDrive}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-700 font-medium text-xs shadow-2xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Conectar Google Drive</span>
              </button>
            </div>
          )}
        </div>

        {/* Ferramentas & Links and Storage footer */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 space-y-2.5">
          <button
            onClick={onOpenProductivityDrawer}
            className="w-full flex items-center justify-between px-3 py-2 bg-white border border-neutral-200/90 rounded-lg text-xs font-medium text-neutral-800 hover:border-neutral-300 hover:shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              <span>Ferramentas & Links</span>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">Abrir</span>
          </button>

          <div className="px-1 text-[11px] text-neutral-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-neutral-400" />
              <span>Memória Local</span>
            </span>
            <span className="font-mono tabular-nums text-neutral-700 font-medium">
              {formatBytes(totalLocalBytes)}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
