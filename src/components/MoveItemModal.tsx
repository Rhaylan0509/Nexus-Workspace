import React, { useState } from 'react';
import { X, Folder, BookOpen, ChevronRight, CornerDownRight, Check } from 'lucide-react';
import { FileItem } from '../types';

interface MoveItemModalProps {
  item: FileItem | null;
  allItems: FileItem[];
  onClose: () => void;
  onMoveItem: (itemId: string, targetParentId: string | null) => void;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  item,
  allItems,
  onClose,
  onMoveItem,
}) => {
  if (!item) return null;

  const [selectedParentId, setSelectedParentId] = useState<string | null>(item.parentId);

  // Filter possible destinations: folders and notebooks (excluding the item itself and its descendants)
  const getDescendantIds = (rootId: string): string[] => {
    const directChildren = allItems.filter((i) => i.parentId === rootId);
    let ids = directChildren.map((c) => c.id);
    for (const child of directChildren) {
      ids = [...ids, ...getDescendantIds(child.id)];
    }
    return ids;
  };

  const forbiddenIds = new Set([item.id, ...getDescendantIds(item.id)]);

  const eligibleContainers = allItems.filter(
    (i) =>
      !i.trashed &&
      (i.type === 'folder' || i.type === 'notebook') &&
      !forbiddenIds.has(i.id)
  );

  const handleConfirm = () => {
    onMoveItem(item.id, selectedParentId);
    onClose();
  };

  // Build indentation/hierarchy for containers
  const renderContainerOption = (container: FileItem, depth = 0) => {
    const isSelected = selectedParentId === container.id;
    const isCurrent = item.parentId === container.id;
    const Icon = container.type === 'notebook' ? BookOpen : Folder;

    return (
      <button
        key={container.id}
        type="button"
        onClick={() => setSelectedParentId(container.id)}
        style={{ paddingLeft: `${16 + depth * 18}px` }}
        className={`w-full flex items-center justify-between py-2 pr-3 rounded-lg text-xs transition-colors cursor-pointer text-left ${
          isSelected
            ? 'bg-neutral-900 text-white font-medium shadow-2xs'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-neutral-500'}`} />
          <span className="truncate">{container.name}</span>
          {isCurrent && (
            <span className={`text-[10px] ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
              (local atual)
            </span>
          )}
        </div>
        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
      </button>
    );
  };

  // Organize by root and nested
  const rootContainers = eligibleContainers.filter((c) => c.parentId === null);
  const getChildren = (parentId: string) => eligibleContainers.filter((c) => c.parentId === parentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Mover na Hierarquia</h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-[280px]">
              Mover &quot;{item.name}&quot; para outra pasta ou caderno
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[380px] overflow-y-auto">
          {/* Destination: Root */}
          <button
            type="button"
            onClick={() => setSelectedParentId(null)}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
              selectedParentId === null
                ? 'bg-neutral-900 text-white font-medium shadow-2xs'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className={`w-3.5 h-3.5 ${selectedParentId === null ? 'text-white' : 'text-neutral-500'}`} />
              <span>Início (Raiz do Explorador)</span>
              {item.parentId === null && (
                <span className={`text-[10px] ${selectedParentId === null ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  (local atual)
                </span>
              )}
            </div>
            {selectedParentId === null && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>

          <div className="pt-2 pb-1 px-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Pastas e Cadernos de Destino
          </div>

          <div className="space-y-1">
            {rootContainers.map((root) => (
              <React.Fragment key={root.id}>
                {renderContainerOption(root, 0)}
                {getChildren(root.id).map((child) => (
                  <React.Fragment key={child.id}>
                    {renderContainerOption(child, 1)}
                    {getChildren(child.id).map((sub) => renderContainerOption(sub, 2))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>

          {eligibleContainers.length === 0 && (
            <p className="text-xs text-neutral-400 italic px-2 py-4 text-center">
              Nenhuma outra pasta ou caderno disponível para mover.
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Mover Aqui
          </button>
        </div>
      </div>
    </div>
  );
};
