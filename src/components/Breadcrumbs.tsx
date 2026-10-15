import React from 'react';
import { ChevronRight, ArrowLeft, Home, Folder, BookOpen, Briefcase } from 'lucide-react';
import { BreadcrumbItem, FileItem } from '../types';

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  currentFolderItem: FileItem | null;
  onNavigate: (id: string | null) => void;
  onNavigateBack: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  breadcrumbs,
  currentFolderItem,
  onNavigate,
  onNavigateBack,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-xs text-neutral-600">
      <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 py-0.5">
        {/* Back button if inside a subfolder */}
        {breadcrumbs.length > 1 && (
          <button
            onClick={onNavigateBack}
            className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors mr-1 cursor-pointer shrink-0"
            title="Voltar pasta anterior"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          let Icon = Home;
          if (crumb.type === 'folder') Icon = Folder;
          if (crumb.type === 'notebook') Icon = BookOpen;

          return (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <span className="text-neutral-300 mx-1 shrink-0">/</span>}
              <button
                onClick={() => onNavigate(crumb.id)}
                className={`flex items-center gap-1.5 py-1 px-1.5 rounded transition-colors shrink-0 cursor-pointer ${
                  isLast
                    ? 'font-semibold text-neutral-900 bg-neutral-100/70'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" />
                <span className="truncate max-w-[160px] md:max-w-[240px]">{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {currentFolderItem && (
        <div className="hidden sm:flex items-center gap-3 text-neutral-400 text-[11px] shrink-0 font-mono">
          {currentFolderItem.type === 'notebook' && currentFolderItem.metadata?.notebookSubject && (
            <span className="text-neutral-500 font-sans">
              Matéria: {currentFolderItem.metadata.notebookSubject}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
