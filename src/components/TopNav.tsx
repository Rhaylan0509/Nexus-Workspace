import React from 'react';
import { Plus, Sparkles, FolderKanban, Cloud } from 'lucide-react';
import { FilterCategory } from '../types';
import { User } from 'firebase/auth';

interface TopNavProps {
  currentCategory: FilterCategory;
  onSelectCategory: (cat: FilterCategory) => void;
  onOpenNewModal: () => void;
  onOpenProductivityDrawer: () => void;
  onOpenUploadModal: () => void;
  googleUser?: User | null;
  onConnectDrive?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentCategory,
  onSelectCategory,
  onOpenNewModal,
  onOpenProductivityDrawer,
  onOpenUploadModal,
  googleUser,
  onConnectDrive,
}) => {
  return (
    <header className="h-16 px-6 border-b border-neutral-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between gap-8">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onSelectCategory('all')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-md cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            N
          </div>
          <span className="text-base font-bold tracking-tight text-neutral-900 whitespace-nowrap">
            Nexus Workspace
          </span>
        </button>
      </div>

      {/* Zone 2: Simplified Nav Links: Explorador & Ferramentas e Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
        <button
          onClick={() => onSelectCategory('all')}
          className={`hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            currentCategory === 'all' ? 'text-neutral-900 font-semibold' : ''
          }`}
        >
          Explorador
        </button>
        <button
          onClick={onOpenProductivityDrawer}
          className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-amber-700 font-medium"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ferramentas & Links</span>
        </button>
      </nav>

      {/* Zone 3: Primary actions & Drive status */}
      <div className="flex items-center gap-2.5 shrink-0">
        {googleUser ? (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/80 rounded-lg text-xs text-blue-900"
            title={`Conectado como ${googleUser.email}`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium max-w-[120px] truncate">
              {googleUser.displayName?.split(' ')[0] || 'Drive'}
            </span>
          </div>
        ) : (
          onConnectDrive && (
            <button
              onClick={onConnectDrive}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/70 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
              title="Conectar com sua conta Google Drive"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Conectar Drive</span>
            </button>
          )
        )}

        <button
          onClick={onOpenUploadModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Fazer upload de PDF, .xopp ou .md"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Enviar Arquivo</span>
        </button>
        <button
          onClick={onOpenNewModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Item</span>
        </button>
      </div>
    </header>
  );
};
