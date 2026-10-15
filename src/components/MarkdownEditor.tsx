import React, { useEffect } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { Save, Check, FileText } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  height?: number;
  hasSavedNotice?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  height = 560,
  hasSavedNotice = false,
}) => {
  // Ctrl+S / Cmd+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (onSave) onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;
  const lineCount = value.split('\n').length;

  return (
    <div className="w-full flex flex-col rounded-xl overflow-hidden border border-neutral-200 bg-white shadow-xs" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="live"
        visibleDragbar={false}
        className="border-none"
      />

      {/* Footer bar with counters and instant save button */}
      <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between text-xs text-neutral-500 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
          </span>
          <span>·</span>
          <span>{charCount} caracteres</span>
          <span>·</span>
          <span>{lineCount} linhas</span>
          <span className="hidden sm:inline text-neutral-400 font-sans text-[11px] ml-2">
            (Pressione <kbd className="px-1 py-0.5 bg-neutral-200 rounded text-[10px]">Ctrl+S</kbd> para salvar)
          </span>
        </div>

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${
              hasSavedNotice
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white'
            }`}
          >
            {hasSavedNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Salvo!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Nota</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
