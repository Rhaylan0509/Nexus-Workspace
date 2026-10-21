import React from 'react';
import { Search, RotateCcw, Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import { DifficultyLevel, ErrorCause, KnowledgeArea, MasteryStatus, QuestionFilters } from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG, ERROR_CAUSE_CONFIG } from '../utils/constants';

interface FilterBarProps {
  filters: QuestionFilters;
  setFilters: React.Dispatch<React.SetStateAction<QuestionFilters>>;
  totalQuestionsCount: number;
  filteredCount: number;
  allSubjects: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  totalQuestionsCount,
  filteredCount,
  allSubjects
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const isFiltered =
    filters.searchQuery !== '' ||
    filters.area !== 'todas' ||
    filters.difficulty !== 'todas' ||
    filters.errorCause !== 'todos' ||
    filters.status !== 'todos' ||
    filters.subject !== '' ||
    filters.hasImageOnly;

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      area: 'todas',
      difficulty: 'todas',
      errorCause: 'todos',
      status: 'todos',
      subject: '',
      hasImageOnly: false,
      sortBy: 'recente'
    });
  };

  const areasList: { id: KnowledgeArea | 'todas'; label: string }[] = [
    { id: 'todas', label: 'Todas as Áreas' },
    { id: 'linguagens', label: AREA_CONFIG.linguagens.shortLabel },
    { id: 'humanas', label: AREA_CONFIG.humanas.shortLabel },
    { id: 'matematica', label: AREA_CONFIG.matematica.shortLabel },
    { id: 'naturezas', label: AREA_CONFIG.naturezas.shortLabel }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top row: Area Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {areasList.map((item) => {
            const isSelected = filters.area === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilters((prev) => ({ ...prev, area: item.id }))}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500 whitespace-nowrap">
          <span>
            Exibindo <strong className="text-slate-900 tabular-nums">{filteredCount}</strong> de{' '}
            <span className="tabular-nums">{totalQuestionsCount}</span>
          </span>
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 ml-2 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Middle row: Search Bar & Quick Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="relative sm:col-span-5 md:col-span-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por palavras no enunciado, fórmula ou comentário..."
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Dificuldade Dropdown */}
        <div className="sm:col-span-3 md:col-span-3">
          <select
            value={filters.difficulty}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                difficulty: e.target.value as DifficultyLevel | 'todas'
              }))
            }
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all cursor-pointer"
          >
            <option value="todas">Dificuldade: Todas</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
            <option value="muito_dificil">Muito Difícil</option>
          </select>
        </div>

        {/* Status Dropdown */}
        <div className="sm:col-span-2 md:col-span-2">
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as MasteryStatus | 'todos'
              }))
            }
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all cursor-pointer"
          >
            <option value="todos">Status: Todos</option>
            <option value="a_revisar">A Revisar</option>
            <option value="em_treino">Em Treino</option>
            <option value="dominado">Dominado</option>
          </select>
        </div>

        {/* Toggle Advanced */}
        <div className="sm:col-span-2 md:col-span-1 flex justify-end">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 text-xs rounded-lg border transition-colors flex items-center justify-center w-full cursor-pointer ${
              showAdvanced || filters.errorCause !== 'todos' || filters.subject !== '' || filters.hasImageOnly
                ? 'border-slate-900 text-slate-900 bg-slate-50'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Mais filtros de estudo"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Filter drawer */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Motivo do Erro */}
          <div>
            <label className="block text-slate-600 mb-1 font-medium">Diagnóstico de Erro</label>
            <select
              value={filters.errorCause}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  errorCause: e.target.value as ErrorCause | 'todos'
                }))
              }
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
            >
              <option value="todos">Todos os Motivos de Erro</option>
              {Object.entries(ERROR_CAUSE_CONFIG).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          {/* Disciplina / Matéria */}
          <div>
            <label className="block text-slate-600 mb-1 font-medium">Disciplina / Conteúdo</label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
            >
              <option value="">Todas as Disciplinas</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenação & Imagens */}
          <div className="flex flex-col justify-end gap-2">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.hasImageOnly}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, hasImageOnly: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  Apenas com imagem
                </span>
              </label>

              <div className="flex-1">
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: e.target.value as QuestionFilters['sortBy']
                    }))
                  }
                  className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                >
                  <option value="recente">Mais Recentes</option>
                  <option value="antiga">Mais Antigas</option>
                  <option value="dificuldade_desc">Maior Dificuldade</option>
                  <option value="dificuldade_asc">Menor Dificuldade</option>
                  <option value="menos_revisadas">Menos Revisadas</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
