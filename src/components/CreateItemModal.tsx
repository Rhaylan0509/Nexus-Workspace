import React, { useState } from 'react';
import {
  X,
  FolderPlus,
  BookPlus,
  FileText,
  PenTool,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ItemType, NoteFormat } from '../types';

interface CreateItemModalProps {
  initialType?: ItemType;
  currentFolderId: string | null;
  onClose: () => void;
  onCreateItem: (item: {
    name: string;
    type: ItemType;
    parentId: string | null;
    description?: string;
    content?: string;
    color?: string;
    metadata?: {
      notebookSubject?: string;
      paperFormat?: string;
      pageStyle?: 'pautado' | 'pontilhado' | 'quadriculado' | 'em_branco';
      paperColor?: string;
    };
  }) => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  initialType = 'folder',
  currentFolderId,
  onClose,
  onCreateItem,
}) => {
  const [selectedType, setSelectedType] = useState<ItemType>(initialType);
  const [noteFormat, setNoteFormat] = useState<NoteFormat>('md');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('orange');

  // Notebook specific
  const [notebookSubject, setNotebookSubject] = useState('');

  // Xournal note specific paper settings (optional, initially closed)
  const [isPaperSettingsOpen, setIsPaperSettingsOpen] = useState(false);
  const [xoppPaperSize, setXoppPaperSize] = useState('A5');
  const [xoppPaperPattern, setXoppPaperPattern] = useState('Pontilhado');
  const [xoppPaperColor, setXoppPaperColor] = useState('Amarelo claro');

  // Markdown Note content
  const [noteContent, setNoteContent] = useState('');

  const colors = [
    { id: 'orange', label: 'Laranja', bg: 'bg-[#ea965a]' },
    { id: 'yellow', label: 'Amarelo', bg: 'bg-[#f3d65b]' },
    { id: 'green', label: 'Verde', bg: 'bg-[#88bf94]' },
    { id: 'blue', label: 'Azul', bg: 'bg-[#3e54d3]' },
    { id: 'purple', label: 'Roxo', bg: 'bg-[#9b84b8]' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalName = name.trim();

    if (selectedType === 'note') {
      if (noteFormat === 'md') {
        if (!finalName.toLowerCase().endsWith('.md')) {
          finalName += '.md';
        }
      } else {
        if (!finalName.toLowerCase().endsWith('.xopp') && !finalName.toLowerCase().endsWith('.xoj')) {
          finalName += '.xopp';
        }
      }
    }

    const paperDescription =
      selectedType === 'note' && noteFormat === 'xopp'
        ? `${xoppPaperSize} · ${xoppPaperColor} · ${xoppPaperPattern}`
        : description.trim() || undefined;

    onCreateItem({
      name: finalName,
      type: selectedType,
      parentId: currentFolderId,
      description: paperDescription,
      color,
      content: selectedType === 'note' && noteFormat === 'md' ? noteContent : undefined,
      metadata: {
        notebookSubject: selectedType === 'notebook' ? notebookSubject.trim() : undefined,
        paperFormat: paperDescription,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Novo Item</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Crie pastas, cadernos ou notas unificadas (.md ou .xopp)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Unified Types: Pasta, Caderno, Nota */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/30">
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedType('folder');
                setColor('blue');
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                selectedType === 'folder'
                  ? 'border-neutral-900 bg-white text-neutral-900 shadow-2xs'
                  : 'border-neutral-200/80 bg-neutral-50/60 text-neutral-600 hover:bg-white'
              }`}
            >
              <FolderPlus className="w-5 h-5 mb-1.5 text-blue-600" />
              <span>Pasta</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedType('notebook');
                setColor('orange');
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                selectedType === 'notebook'
                  ? 'border-neutral-900 bg-white text-neutral-900 shadow-2xs'
                  : 'border-neutral-200/80 bg-neutral-50/60 text-neutral-600 hover:bg-white'
              }`}
            >
              <BookPlus className="w-5 h-5 mb-1.5 text-orange-500" />
              <span>Caderno</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedType('note');
                setColor('green');
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                selectedType === 'note'
                  ? 'border-neutral-900 bg-white text-neutral-900 shadow-2xs'
                  : 'border-neutral-200/80 bg-neutral-50/60 text-neutral-600 hover:bg-white'
              }`}
            >
              <FileText className="w-5 h-5 mb-1.5 text-emerald-600" />
              <span>Nota</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Note Format Selector (Unificação: .md ou Xournal++ .xopp) */}
          {selectedType === 'note' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                Formato Obrigatório da Nota
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNoteFormat('md')}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left cursor-pointer transition-all ${
                    noteFormat === 'md'
                      ? 'border-neutral-900 bg-white text-neutral-900 font-medium shadow-2xs'
                      : 'border-neutral-200 bg-neutral-100/50 text-neutral-600 hover:bg-white'
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Markdown (.md)</div>
                    <div className="text-[10.5px] text-neutral-500">Texto formatado</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNoteFormat('xopp')}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left cursor-pointer transition-all ${
                    noteFormat === 'xopp'
                      ? 'border-neutral-900 bg-white text-neutral-900 font-medium shadow-2xs'
                      : 'border-neutral-200 bg-neutral-100/50 text-neutral-600 hover:bg-white'
                  }`}
                >
                  <PenTool className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Xournal++ (.xopp)</div>
                    <div className="text-[10.5px] text-neutral-500">Stylus manuscrito</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Nome {selectedType === 'folder' ? 'da Pasta' : selectedType === 'notebook' ? 'do Caderno' : 'da Nota'} *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                selectedType === 'folder'
                  ? 'Ex: Ferretto, Simulado, Provas...'
                  : selectedType === 'notebook'
                  ? 'Ex: História, Matemática, Química, Redação...'
                  : noteFormat === 'xopp'
                  ? 'Ex: Meta.xopp, Aula_Vetores.xopp'
                  : 'Ex: Resumo_Iluminismo.md, Fórmulas.md'
              }
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white transition-all font-sans"
            />
          </div>

          {/* Notebook Discipline */}
          {selectedType === 'notebook' && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Disciplina ou Matéria
              </label>
              <input
                type="text"
                value={notebookSubject}
                onChange={(e) => setNotebookSubject(e.target.value)}
                placeholder="Ex: Humanas, Exatas, Biologia, Redação..."
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white transition-all"
              />
            </div>
          )}

          {/* Xournal++ Note Template Settings (Opcional e Inicialmente Fechado) */}
          {selectedType === 'note' && noteFormat === 'xopp' && (
            <div className="border border-neutral-200/90 rounded-xl overflow-hidden bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setIsPaperSettingsOpen(!isPaperSettingsOpen)}
                className="w-full flex items-center justify-between p-3 text-xs font-medium text-neutral-700 hover:bg-neutral-100/70 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  {isPaperSettingsOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                  )}
                  <span>Configurações do Papel</span>
                  <span className="text-[10.5px] text-neutral-400 font-normal">
                    (Opcional)
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {xoppPaperSize} · {xoppPaperColor} · {xoppPaperPattern}
                </span>
              </button>

              {isPaperSettingsOpen && (
                <div className="p-3 pt-1 border-t border-neutral-200/70 bg-white grid grid-cols-3 gap-2 animate-in fade-in duration-100">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                      Tamanho
                    </label>
                    <select
                      value={xoppPaperSize}
                      onChange={(e) => setXoppPaperSize(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800"
                    >
                      <option value="A5">A5</option>
                      <option value="A4">A4</option>
                      <option value="Carta">Carta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                      Cor do Papel
                    </label>
                    <select
                      value={xoppPaperColor}
                      onChange={(e) => setXoppPaperColor(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800"
                    >
                      <option value="Amarelo claro">Amarelo claro</option>
                      <option value="Branco">Branco</option>
                      <option value="Cinza suave">Cinza suave</option>
                      <option value="Escuro (Dark)">Escuro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                      Pauta
                    </label>
                    <select
                      value={xoppPaperPattern}
                      onChange={(e) => setXoppPaperPattern(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800"
                    >
                      <option value="Pontilhado">Pontilhado</option>
                      <option value="Pautado">Pautado</option>
                      <option value="Quadriculado">Quadriculado</option>
                      <option value="Em branco">Em branco</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Markdown Note Content */}
          {selectedType === 'note' && noteFormat === 'md' && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Conteúdo Inicial (Markdown)
              </label>
              <textarea
                rows={4}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="# Título da Nota&#10;&#10;Escreva o resumo da aula aqui..."
                className="w-full px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white transition-all leading-relaxed"
              />
            </div>
          )}

          {/* Color for Folder / Notebook */}
          {selectedType !== 'note' && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center transition-transform cursor-pointer ${
                      color === c.id ? 'ring-2 ring-neutral-900 ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={c.label}
                  >
                    {color === c.id && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Criar {selectedType === 'folder' ? 'Pasta' : selectedType === 'notebook' ? 'Caderno' : `Nota (.${noteFormat})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
