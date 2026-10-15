import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  PenTool,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { FileItem } from '../types';
import { saveBlob, formatBytes } from '../lib/storage';

interface UploadModalProps {
  currentFolderId: string | null;
  onClose: () => void;
  onFilesUploaded: (newItems: FileItem[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  currentFolderId,
  onClose,
  onFilesUploaded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ name: string; size: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    const newItems: FileItem[] = [];
    const recentUploads: { name: string; size: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const blobKey = `blob-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Save binary blob to IndexedDB
      await saveBlob(blobKey, file);

      let itemType: FileItem['type'] = 'file';
      let tags: string[] = [ext];
      let content: string | undefined = undefined;

      if (ext === 'xopp' || ext === 'xoj') {
        tags = ['xournal++', 'anotações', 'stylus'];
      } else if (ext === 'pdf') {
        tags = ['pdf', 'documento'];
      } else if (ext === 'md' || ext === 'txt') {
        itemType = 'note';
        tags = ['nota', 'texto'];
        try {
          content = await file.text();
        } catch (e) {
          content = '';
        }
      }

      const newItem: FileItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
        tags,
        starred: false,
        trashed: false,
        description:
          ext === 'xopp' || ext === 'xoj'
            ? 'Arquivo de anotações manuscritas do Xournal++'
            : ext === 'pdf'
            ? 'Documento PDF'
            : undefined,
      };

      newItems.push(newItem);
      recentUploads.push({ name: file.name, size: file.size });
    }

    setUploadedList((prev) => [...prev, ...recentUploads]);
    setIsProcessing(false);
    onFilesUploaded(newItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Enviar Documentos</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Suporta PDFs, arquivos de anotação do Xournal++ (.xopp, .xoj), notas e imagens
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-neutral-900 bg-neutral-50 scale-[0.99]'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50/60'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
                <Upload className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <PenTool className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <p className="text-xs font-semibold text-neutral-800">
              Arraste e solte seus arquivos aqui ou clique para selecionar
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Arquivos .xopp, .pdf, .md, .txt, .png, etc. Salvos diretamente na memória local segura do seu navegador.
            </p>
          </div>

          {/* Uploaded items status list */}
          {uploadedList.length > 0 && (
            <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50/60 max-h-40 overflow-y-auto space-y-1.5">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Arquivos Adicionados ({uploadedList.length})
              </div>
              {uploadedList.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1 px-2 bg-white border border-neutral-100 rounded-md"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate text-neutral-800 font-medium">{f.name}</span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                    {formatBytes(f.size)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-2 text-xs text-neutral-600 animate-pulse">
              Processando e salvando arquivos...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-mono">
            Armazenamento: IndexedDB Local
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            {uploadedList.length > 0 ? 'Concluir' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
};
