import React from 'react';
import {
  Search,
  X,
  LayoutGrid,
  List,
  Upload,
  Plus,
  FolderPlus,
  BookPlus,
  FileText,
} from 'lucide-react';
import { ViewMode, SortField, SortDirection, FileTypeFilter } from '../types';

interface ExplorerToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeFilter: FileTypeFilter;
  onTypeFilterChange: (f: FileTypeFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  onOpenCreateModal: (type?: 'folder' | 'notebook' | 'note') => void;
  onOpenUploadModal: () => void;
  totalFilteredCount: number;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  viewMode,
  onViewModeChange,
  sortField,
  sortDirection,
  onSortChange,
  onOpenCreateModal,
  onOpenUploadModal,
  totalFilteredCount,
}) => {
  const [isNewMenuOpen, setIsNewMenuOpen] = React.useState(false);

  const filterTabs: { id: FileTypeFilter; label: string }[] = [
    { id: 'all', label: 'Todos os Itens' },
    { id: 'notebook', label: 'Cadernos' },
    { id: 'xopp', label: 'Xournal++ (.xopp)' },
    { id: 'md', label: 'Notas (.md)' },
    { id: 'pdf', label: 'PDFs' },
  ];

  return (
    <div className="space-y-3 pb-3 border-b border-neutral-200">
      {/* Top row: Search + Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, disciplina, extensão (.xopp, .md, .pdf)..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Toggle & New Action */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* Sorting Dropdown */}
          <div className="relative">
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field] = e.target.value.split('-') as [SortField, SortDirection];
                onSortChange(field);
              }}
              className="px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 hover:border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="name-asc">Nome (A-Z)</option>
              <option value="name-desc">Nome (Z-A)</option>
              <option value="updatedAt-desc">Recentes</option>
              <option value="size-desc">Tamanho</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-neutral-100 rounded-lg border border-neutral-200/80">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
              title="Visualização em Lista / Tabela"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Upload Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
            title="Fazer upload de PDF, .xopp ou .md"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar</span>
          </button>

          {/* New Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo</span>
            </button>

            {isNewMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsNewMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs">
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenCreateModal('folder');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-50 text-left cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                    <span>Nova Pasta</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenCreateModal('notebook');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-50 text-left cursor-pointer"
                  >
                    <BookPlus className="w-4 h-4 text-orange-500" />
                    <span>Novo Caderno</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenCreateModal('note');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-50 text-left cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Nova Nota (.md / .xopp)</span>
                  </button>
                  <div className="my-1 border-t border-neutral-100" />
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenUploadModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-50 text-left cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-neutral-500" />
                    <span>Upload Arquivo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Interactive filter tabs */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto py-0.5">
        <div className="flex items-center gap-1">
          {filterTabs.map((tab) => {
            const isActive = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTypeFilterChange(tab.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0">
          {totalFilteredCount} {totalFilteredCount === 1 ? 'item' : 'itens'}
        </div>
      </div>
    </div>
  );
};
