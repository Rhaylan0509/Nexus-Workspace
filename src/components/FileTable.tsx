import React from 'react';
import {
  Folder,
  BookOpen,
  Briefcase,
  FileText,
  File,
  FileImage,
  Star,
  Download,
  Trash2,
  Edit2,
  Eye,
  PenTool,
  FolderInput,
  Edit3,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes } from '../lib/storage';

interface FileTableProps {
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

export const FileTable: React.FC<FileTableProps> = ({
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
  const getIconAndStyle = (item: FileItem) => {
    switch (item.type) {
      case 'folder':
        return { icon: Folder, color: 'text-blue-600', label: 'Pasta' };
      case 'notebook':
        return { icon: BookOpen, color: 'text-orange-600', label: 'Caderno' };
      case 'note':
        if (item.extension === 'xopp' || item.extension === 'xoj') {
          return { icon: PenTool, color: 'text-blue-600', label: 'Xournal++' };
        }
        return { icon: FileText, color: 'text-emerald-600', label: 'Nota (.md)' };
      case 'file':
        if (item.extension === 'pdf') {
          return { icon: FileText, color: 'text-rose-600', label: 'PDF' };
        }
        if (item.extension === 'xopp' || item.extension === 'xoj') {
          return { icon: PenTool, color: 'text-blue-600', label: 'Xournal++' };
        }
        if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(item.extension || '')) {
          return { icon: FileImage, color: 'text-indigo-600', label: 'Imagem' };
        }
        return { icon: File, color: 'text-neutral-600', label: 'Documento' };
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-500 font-medium">
              <th className="py-2.5 px-3.5 w-10 text-center">⭐</th>
              <th className="py-2.5 px-3.5">Nome</th>
              <th className="py-2.5 px-3.5 w-28">Tipo</th>
              <th className="py-2.5 px-3.5 w-28 text-right font-mono">Tamanho</th>
              <th className="py-2.5 px-3.5 w-44 font-mono">Modificado</th>
              <th className="py-2.5 px-3.5 text-right w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((item) => {
              const { icon: ItemIcon, color, label } = getIconAndStyle(item);
              const isContainer = item.type === 'folder' || item.type === 'notebook';
              const childCount = allChildrenMap[item.id] || 0;

              return (
                <tr
                  key={item.id}
                  onDoubleClick={() => (isContainer ? onOpenItem(item) : onPreviewItem(item))}
                  className="hover:bg-neutral-50/80 transition-colors group cursor-pointer"
                >
                  {/* Star */}
                  <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleStar(item)}
                      className="p-1 rounded hover:bg-neutral-200/50 transition-colors cursor-pointer"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          item.starred
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-neutral-300 group-hover:text-neutral-400'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Name & Icon */}
                  <td
                    className="py-2.5 px-3.5"
                    onClick={() => (isContainer ? onOpenItem(item) : onPreviewItem(item))}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ItemIcon className={`w-4 h-4 shrink-0 ${color}`} />
                      <div className="truncate">
                        <span className="font-medium text-neutral-900 hover:underline">
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="ml-2 text-[11px] text-neutral-400 font-normal hidden lg:inline">
                            — {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-2.5 px-3.5 text-neutral-600">
                    <span>{label}</span>
                  </td>

                  {/* Size / Count */}
                  <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-neutral-600">
                    {isContainer ? (
                      <span className="text-neutral-400 font-sans text-[11px]">
                        {childCount} {childCount === 1 ? 'item' : 'itens'}
                      </span>
                    ) : (
                      formatBytes(item.size)
                    )}
                  </td>

                  {/* Modified */}
                  <td className="py-2.5 px-3.5 font-mono tabular-nums text-neutral-500 text-[11px]">
                    {formatDate(item.updatedAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => (isContainer ? onOpenItem(item) : onPreviewItem(item))}
                        className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title={isContainer ? 'Abrir' : 'Visualizar'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRenameItem(item)}
                        className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Renomear"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveItem(item)}
                        className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Mover na Hierarquia"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>
                      {!isContainer && (
                        <button
                          onClick={() => onDownloadItem(item)}
                          className="p-1 rounded hover:bg-neutral-200/60 text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Baixar arquivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteItem(item)}
                        className="p-1 rounded hover:bg-rose-100 text-neutral-400 hover:text-rose-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
