import React from 'react';
import { Plus, Printer } from 'lucide-react';

interface HeaderProps {
  activeTab: 'questoes' | 'treino' | 'estatisticas';
  setActiveTab: (tab: 'questoes' | 'treino' | 'estatisticas') => void;
  onOpenNewQuestionModal: () => void;
  onOpenPdfModal: () => void;
  filteredCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewQuestionModal,
  onOpenPdfModal,
  filteredCount
}) => {
  return (
    <header className="sticky top-16 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('questoes');
              }}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-slate-800 transition-colors"
            >
              Caderno de Erros
            </a>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-normal">
              · ENEM & Vestibulares
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab('questoes')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                activeTab === 'questoes'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Questões
              <span className="ml-1.5 text-xs text-slate-600 tabular-nums">
                ({filteredCount})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('treino')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                activeTab === 'treino'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Modo Treino
            </button>
            <button
              onClick={() => setActiveTab('estatisticas')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                activeTab === 'estatisticas'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Diagnóstico
            </button>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenPdfModal}
              title="Exportar questões filtradas em PDF"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Exportar</span> PDF
            </button>

            <button
              onClick={onOpenNewQuestionModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Questão</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
