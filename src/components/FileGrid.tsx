import React from 'react';
import {
  Pencil,
  FolderInput,
  Star,
  Trash2,
  Download,
  Eye,
  MoreHorizontal,
  PenTool,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes } from '../lib/storage';

interface FileGridProps {
  items: FileItem[];
  allChildrenMap: Record<string, number>;
  onOpenItem: (item: FileItem) => void;
  onPreviewItem: (item: FileItem) => void;
  onEditItem?: (item: FileItem) => void;
  onToggleStar: (item: FileItem) => void;
  onRenameItem: (item: FileItem) => void;
  onDeleteItem: (item: FileItem) => void;
  onDownloadItem: (item: FileItem) => void;
  onMoveItem: (item: FileItem) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  items,
  allChildrenMap,
  onOpenItem,
  onPreviewItem,
  onEditItem,
  onToggleStar,
  onRenameItem,
  onDeleteItem,
  onDownloadItem,
  onMoveItem,
}) => {
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  // Helper for Notebook colors (matching screenshot 2)
  const getNotebookColors = (color?: string, name?: string) => {
    const lower = (name || '').toLowerCase();
    if (color === 'orange' || lower.includes('história') || lower.includes('sociologia')) {
      return { cover: 'bg-[#ea965a]', band: 'bg-[#d98143]', shadow: 'shadow-orange-200/50' };
    }
    if (color === 'yellow' || lower.includes('matemática')) {
      return { cover: 'bg-[#f3d65b]', band: 'bg-[#ddbf3f]', shadow: 'shadow-amber-200/50' };
    }
    if (color === 'green' || lower.includes('química')) {
      return { cover: 'bg-[#88bf94]', band: 'bg-[#6fa77b]', shadow: 'shadow-emerald-200/50' };
    }
    if (color === 'blue' || lower.includes('redação')) {
      return { cover: 'bg-[#3e54d3]', band: 'bg-[#3042ac]', shadow: 'shadow-indigo-200/50' };
    }
    return { cover: 'bg-[#9b84b8]', band: 'bg-[#826ca0]', shadow: 'shadow-purple-200/50' };
  };

  // Helper for Folder colors (matching screenshot 1)
  const getFolderColors = (color?: string, name?: string) => {
    const lower = (name || '').toLowerCase();
    if (color === 'yellow' || lower.includes('simulado')) {
      return { tab: '#cca733', body: '#ecc857', shadow: 'shadow-amber-200/40' };
    }
    if (color === 'blue' || lower.includes('ferretto')) {
      return { tab: '#2c42b5', body: '#3b52d4', shadow: 'shadow-blue-200/40' };
    }
    if (color === 'green' || color === 'emerald') {
      return { tab: '#4e9766', body: '#6bb884', shadow: 'shadow-emerald-200/40' };
    }
    return { tab: '#d17737', body: '#eb8c4c', shadow: 'shadow-orange-200/40' };
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-6 sm:gap-8 py-4">
      {items.map((item) => {
        const isContainer = item.type === 'folder' || item.type === 'notebook';
        const isFolder = item.type === 'folder';
        const isNotebook = item.type === 'notebook';
        const isPdf = item.extension === 'pdf';
        const isXopp = item.extension === 'xopp' || item.extension === 'xoj';
        const childCount = allChildrenMap[item.id] || 0;
        const isMenuOpen = activeMenuId === item.id;

        return (
          <div
            key={item.id}
            className="group flex flex-col items-center justify-between text-center select-none"
          >
            {/* 1. VISUAL CARD GRAPHIC */}
            <div
              onClick={() => (isContainer ? onOpenItem(item) : onPreviewItem(item))}
              className="relative cursor-pointer transition-transform duration-200 hover:scale-[1.03] flex items-center justify-center p-2"
            >
              {/* Star Badge on top right */}
              {item.starred && (
                <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-xs">
                  <Star className="w-3 h-3 fill-white" />
                </div>
              )}

              {/* A. FOLDER GRAPHIC (Matching Screenshot 1) */}
              {isFolder && (() => {
                const colors = getFolderColors(item.color, item.name);
                return (
                  <div className={`relative w-28 h-20 sm:w-32 sm:h-24 drop-shadow-md ${colors.shadow}`}>
                    <svg viewBox="0 0 140 100" className="w-full h-full" fill="none">
                      {/* Back Tab */}
                      <path
                        d="M 6 12 C 6 8, 10 5, 14 5 L 56 5 C 62 5, 66 10, 71 18 L 74 24 L 126 24 C 130 24, 134 27, 134 32 L 134 88 C 134 93, 130 96, 126 96 L 14 96 C 10 96, 6 93, 6 88 Z"
                        fill={colors.tab}
                      />
                      {/* Front Pocket */}
                      <path
                        d="M 6 30 C 6 25, 10 22, 14 22 L 126 22 C 130 22, 134 25, 134 30 L 131 89 C 130 94, 126 98, 121 98 L 19 98 C 14 98, 10 94, 9 89 Z"
                        fill={colors.body}
                      />
                      {/* Subtle fold reflection */}
                      <path
                        d="M 12 25 L 128 25"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeOpacity="0.25"
                      />
                    </svg>
                  </div>
                );
              })()}

              {/* B. NOTEBOOK GRAPHIC (Matching Screenshot 2) */}
              {isNotebook && (() => {
                const nbColors = getNotebookColors(item.color, item.name);
                return (
                  <div
                    className={`relative w-24 h-32 sm:w-28 sm:h-36 rounded-2xl ${nbColors.cover} shadow-md overflow-hidden flex flex-col justify-between p-1.5 transition-shadow`}
                  >
                    {/* Spine / Strap accent line on right edge (as seen in screenshot 2) */}
                    <div
                      className={`absolute top-0 right-3.5 w-3 h-full ${nbColors.band}`}
                    />

                    {/* Subtle book paper edge highlight on left */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-black/10" />
                    <div className="absolute top-0 left-1 w-0.5 h-full bg-white/20" />

                    {/* Inside placeholder or bookmark mark */}
                    <div className="z-10 mt-auto ml-1 mb-1">
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                  </div>
                );
              })()}

              {/* C. DOCUMENT GRAPHIC: PDF & XOURNAL++ & FILES (Matching Screenshot 2 & 3) */}
              {!isFolder && !isNotebook && (
                <div className="relative w-22 h-28 sm:w-24 sm:h-32 bg-white rounded-lg border border-neutral-200/90 shadow-xs flex flex-col overflow-hidden">
                  {/* Top Header Stripe: RED for PDF (as in screenshot 3!), BLUE for XOPP */}
                  {isPdf ? (
                    <div className="h-3 w-full bg-[#dc5550]" />
                  ) : isXopp ? (
                    <div className="h-3 w-full bg-blue-500/80" />
                  ) : (
                    <div className="h-2 w-full bg-neutral-200" />
                  )}

                  {/* Folded Dog-Ear Corner at Top Right */}
                  <div className="absolute top-0 right-0 w-4 h-4 bg-neutral-100 border-b border-l border-neutral-300 rounded-bl-sm" />

                  {/* Ruled lines inside the sheet (as seen in screenshots 2 & 3) */}
                  <div className="flex-1 p-2.5 pt-3.5 space-y-2 flex flex-col justify-center">
                    <div className="w-4/5 h-0.5 bg-neutral-200 mx-auto rounded-full" />
                    <div className="w-4/5 h-0.5 bg-neutral-200 mx-auto rounded-full" />
                    <div className="w-4/5 h-0.5 bg-neutral-200 mx-auto rounded-full" />
                    <div className="w-3/5 h-0.5 bg-neutral-200 mx-auto rounded-full" />
                  </div>

                  {/* Small format indicator badge */}
                  {isXopp && (
                    <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5 text-[9px] text-blue-600 font-mono font-medium">
                      <PenTool className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. LABELS & METADATA (Matching Screenshot Layout) */}
            <div className="w-full mt-1.5 px-1 min-w-0">
              <h3
                onClick={() => (isContainer ? onOpenItem(item) : onPreviewItem(item))}
                className="text-xs sm:text-[13px] font-semibold text-neutral-800 truncate hover:text-neutral-950 cursor-pointer"
                title={item.name}
              >
                {item.name}
              </h3>

              {/* Subtitles: Date for Notebooks, PDF size for documents, format for XOPP */}
              <div className="text-[11px] text-neutral-400 mt-0.5 truncate font-mono">
                {isFolder && (
                  <span>
                    {childCount} {childCount === 1 ? 'item' : 'itens'}
                  </span>
                )}
                {isNotebook && (
                  <span>{formatDate(item.updatedAt)}</span>
                )}
                {isPdf && (
                  <span>PDF · {formatBytes(item.size)}</span>
                )}
                {isXopp && (
                  <span>{item.description || `XOPP · ${formatBytes(item.size)}`}</span>
                )}
                {!isFolder && !isNotebook && !isPdf && !isXopp && (
                  <span>{formatBytes(item.size)}</span>
                )}
              </div>
            </div>

            {/* 3. QUICK ACTION BUTTONS UNDERNEATH (Matching Screenshots 1, 2, 3) */}
            <div className="flex items-center justify-center gap-1 mt-2.5 flex-wrap">
              {/* "Abrir" button for documents */}
              {!isContainer && (
                <button
                  type="button"
                  onClick={() => onPreviewItem(item)}
                  className="px-2 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Visualizar documento"
                >
                  Abrir
                </button>
              )}

              {/* Pencil / Rename Button */}
              <button
                type="button"
                onClick={() => onRenameItem(item)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer shadow-2xs"
                title="Renomear item"
              >
                <Pencil className="w-3 h-3" />
              </button>

              {/* Direct Delete / Trash Button */}
              <button
                type="button"
                onClick={() => onDeleteItem(item)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-neutral-200/90 hover:border-rose-300 hover:bg-rose-50 text-neutral-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer shadow-2xs"
                title="Excluir item"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              {/* Move in Hierarchy Button (Change Parent Folder/Notebook) */}
              <button
                type="button"
                onClick={() => onMoveItem(item)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer shadow-2xs"
                title="Mover para outra pasta ou caderno"
              >
                <FolderInput className="w-3 h-3" />
              </button>

              {/* More / Context Menu Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer shadow-2xs"
                  title="Mais ações"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </button>

                {isMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setActiveMenuId(null)}
                    />
                    <div className="absolute right-0 bottom-8 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs text-left">
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onToggleStar(item);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${item.starred ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}`} />
                        <span>{item.starred ? 'Desfavoritar' : 'Favoritar'}</span>
                      </button>

                      {!isContainer && (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            onDownloadItem(item);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Baixar Arquivo</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-neutral-100" />

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          onDeleteItem(item);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
