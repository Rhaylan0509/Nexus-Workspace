import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  FileText, 
  BookOpen, 
  Target, 
  CheckSquare
} from 'lucide-react';
import { PdfExportOptions, QuestionFilters, QuestionItem } from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG } from '../utils/constants';
import { openPrintDialogForQuestions } from '../services/pdfExporter';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredQuestions: QuestionItem[];
  currentFilters: QuestionFilters;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  filteredQuestions,
  currentFilters
}) => {
  const [title, setTitle] = useState('Caderno de Erros & Questões');
  const [subtitle, setSubtitle] = useState('Material de Revisão Personalizado');
  const [studentName, setStudentName] = useState('');
  const [layoutMode, setLayoutMode] = useState<PdfExportOptions['layoutMode']>('completo');
  const [includeImages, setIncludeImages] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeErrorDiagnosis, setIncludeErrorDiagnosis] = useState(true);
  const [includeAnswerKeyAtEnd, setIncludeAnswerKeyAtEnd] = useState(true);
  const [includeNotesSpace, setIncludeNotesSpace] = useState(false);
  const [fontSize, setFontSize] = useState<PdfExportOptions['fontSize']>('normal');
  const [columns, setColumns] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const handleExport = () => {
    const options: PdfExportOptions = {
      title,
      subtitle,
      studentName,
      layoutMode,
      includeImages,
      includeComments: layoutMode === 'simulado' ? false : includeComments,
      includeErrorDiagnosis: layoutMode === 'simulado' ? false : includeErrorDiagnosis,
      includeAnswerKeyAtEnd,
      includeNotesSpace,
      fontSize,
      columns
    };

    openPrintDialogForQuestions(filteredQuestions, options);
    onClose();
  };

  // Get active filters description
  const filterDesc: string[] = [];
  if (currentFilters.area !== 'todas') {
    filterDesc.push(`Área: ${AREA_CONFIG[currentFilters.area]?.shortLabel || currentFilters.area}`);
  }
  if (currentFilters.difficulty !== 'todas') {
    filterDesc.push(`Dificuldade: ${DIFFICULTY_CONFIG[currentFilters.difficulty]?.label || currentFilters.difficulty}`);
  }
  if (currentFilters.status !== 'todos') {
    filterDesc.push(`Status: ${currentFilters.status}`);
  }
  if (currentFilters.searchQuery) {
    filterDesc.push(`Busca: "${currentFilters.searchQuery}"`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-800">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Exportar para PDF / Impressão
              </h2>
              <p className="text-xs text-slate-500">
                Gere um documento profissional com as questões filtradas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Filter count banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-900">
                {filteredQuestions.length} questões selecionadas
              </span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {filterDesc.length > 0
                  ? `Filtros aplicados: ${filterDesc.join(' · ')}`
                  : 'Todas as questões cadastradas sem filtros restritivos.'}
              </p>
            </div>
            <span className="text-[11px] font-medium text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              Filtro Ativo
            </span>
          </div>

          {/* Format Mode Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. Formato do Caderno / Prova
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLayoutMode('completo');
                  setIncludeComments(true);
                  setIncludeErrorDiagnosis(true);
                  setIncludeNotesSpace(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  layoutMode === 'completo'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4 mb-2 opacity-80" />
                <div className="font-bold text-xs">Apostila Completa</div>
                <div className={`text-[11px] mt-1 leading-snug ${layoutMode === 'completo' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Enunciado, alternativas e resolução comentada logo abaixo.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLayoutMode('simulado');
                  setIncludeComments(false);
                  setIncludeErrorDiagnosis(false);
                  setIncludeAnswerKeyAtEnd(true);
                  setIncludeNotesSpace(true);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  layoutMode === 'simulado'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 mb-2 opacity-80" />
                <div className="font-bold text-xs">Simulado / Prova</div>
                <div className={`text-[11px] mt-1 leading-snug ${layoutMode === 'simulado' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Apenas questões para resolver, com gabarito na folha final.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLayoutMode('caderno_erros');
                  setIncludeComments(true);
                  setIncludeErrorDiagnosis(true);
                  setIncludeNotesSpace(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  layoutMode === 'caderno_erros'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <Target className="w-4 h-4 mb-2 opacity-80" />
                <div className="font-bold text-xs">Caderno de Erros</div>
                <div className={`text-[11px] mt-1 leading-snug ${layoutMode === 'caderno_erros' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Destaca o erro cometido, causa e dicas para não errar.
                </div>
              </button>
            </div>
          </div>

          {/* Document Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Título do Documento
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Simulado ENEM - Matemática"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome do Estudante (Opcional)
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ex: Seu Nome / Turma"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Customization Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              2. Elementos e Configurações de Impressão
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Incluir imagens e gráficos anexos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeAnswerKeyAtEnd}
                  onChange={(e) => setIncludeAnswerKeyAtEnd(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Incluir folha de gabarito na página final</span>
              </label>

              {layoutMode !== 'simulado' && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeComments}
                      onChange={(e) => setIncludeComments(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Incluir comentários e resolução detalhada</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={includeErrorDiagnosis}
                      onChange={(e) => setIncludeErrorDiagnosis(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Incluir diagnóstico de causa do erro</span>
                  </label>
                </>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeNotesSpace}
                  onChange={(e) => setIncludeNotesSpace(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Incluir pauta/espaço para rascunho de cálculo</span>
              </label>
            </div>
          </div>

          {/* Typography and Columns */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Tamanho do Texto
              </label>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {(['pequena', 'normal', 'grande'] as PdfExportOptions['fontSize'][]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setFontSize(sz)}
                    className={`flex-1 py-1 text-xs rounded-md transition-all cursor-pointer capitalize ${
                      fontSize === sz
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Distribuição de Colunas
              </label>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setColumns(1)}
                  className={`flex-1 py-1 text-xs rounded-md transition-all cursor-pointer ${
                    columns === 1
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1 Coluna (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setColumns(2)}
                  className={`flex-1 py-1 text-xs rounded-md transition-all cursor-pointer ${
                    columns === 2
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2 Colunas (Vestibular)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0 rounded-b-2xl">
          <span className="text-xs text-slate-500">
            Dica: Na janela de impressão, escolha a opção <strong>"Salvar como PDF"</strong>.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredQuestions.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Gerar PDF / Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
