import React, { useRef } from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Upload, 
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { KnowledgeArea, QuestionItem } from '../types/question';
import { AREA_CONFIG, ERROR_CAUSE_CONFIG, MASTERY_STATUS_CONFIG } from '../utils/constants';

interface AnalyticsOverviewProps {
  questions: QuestionItem[];
  onExportJson: () => void;
  onImportJson: (content: string) => void;
  onResetToSample: () => void;
  onSelectAreaFilter: (area: KnowledgeArea) => void;
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  questions,
  onExportJson,
  onImportJson,
  onResetToSample,
  onSelectAreaFilter
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = questions.length;
  if (total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-slate-500 text-sm">
          Nenhuma questão cadastrada para exibir diagnóstico.
        </p>
      </div>
    );
  }

  // Distribution by Area
  const areaCounts: Record<KnowledgeArea, number> = {
    linguagens: 0,
    humanas: 0,
    matematica: 0,
    naturezas: 0
  };
  questions.forEach((q) => {
    if (areaCounts[q.area] !== undefined) {
      areaCounts[q.area]++;
    }
  });

  // Mastery status counts
  const statusCounts = {
    a_revisar: questions.filter((q) => q.status === 'a_revisar').length,
    em_treino: questions.filter((q) => q.status === 'em_treino').length,
    dominado: questions.filter((q) => q.status === 'dominado').length
  };

  // Error causes counts
  const errorCausesCounts: Record<string, number> = {};
  questions.forEach((q) => {
    if (q.errorCause) {
      errorCausesCounts[q.errorCause] = (errorCausesCounts[q.errorCause] || 0) + 1;
    }
  });

  const sortedErrors = Object.entries(errorCausesCounts).sort((a, b) => b[1] - a[1]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJson(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total & Review */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total de Questões Registradas</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">
            {total}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Base acumulada de erros e exercícios resolúveis
          </div>
        </div>

        {/* Card 2: Domínio */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Taxa de Domínio</div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-1 tabular-nums">
            {Math.round((statusCounts.dominado / total) * 100)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
            <span className="text-emerald-700 font-medium">{statusCounts.dominado} dominadas</span>
            <span>·</span>
            <span>{statusCounts.em_treino} em treino</span>
            <span>·</span>
            <span>{statusCounts.a_revisar} a revisar</span>
          </div>
        </div>

        {/* Card 3: Principal Gargalo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Maior Causa de Erro</div>
          <div className="text-lg sm:text-xl font-bold text-amber-800 mt-1 truncate">
            {sortedErrors.length > 0 && ERROR_CAUSE_CONFIG[sortedErrors[0][0] as keyof typeof ERROR_CAUSE_CONFIG]
              ? ERROR_CAUSE_CONFIG[sortedErrors[0][0] as keyof typeof ERROR_CAUSE_CONFIG].label
              : 'Nenhum erro computado'}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {sortedErrors.length > 0 ? (
              <span>
                Responsável por <strong>{sortedErrors[0][1]}</strong> questão(ões) no caderno
              </span>
            ) : (
              'Cadastre questões com diagnóstico'
            )}
          </div>
        </div>
      </div>

      {/* Breakdown by Area & Mistake Causes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: 4 Knowledge Areas */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-600" />
              Distribuição pelas 4 Grandes Áreas
            </h3>
            <span className="text-xs text-slate-400">Clique para filtrar</span>
          </div>

          <div className="space-y-3">
            {(['linguagens', 'humanas', 'matematica', 'naturezas'] as KnowledgeArea[]).map((ar) => {
              const info = AREA_CONFIG[ar];
              const count = areaCounts[ar];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <button
                  key={ar}
                  onClick={() => onSelectAreaFilter(ar)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-800">{info.shortLabel}</span>
                    <span className="text-slate-500 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        ar === 'matematica'
                          ? 'bg-sky-600'
                          : ar === 'naturezas'
                          ? 'bg-emerald-600'
                          : ar === 'humanas'
                          ? 'bg-amber-600'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Causes of Errors */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Diagnóstico dos Motivos de Erro
          </h3>

          <div className="space-y-2.5 text-xs">
            {sortedErrors.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-4">
                Nenhuma causa de erro marcada nas questões ainda.
              </p>
            ) : (
              sortedErrors.map(([causeKey, count]) => {
                const info = ERROR_CAUSE_CONFIG[causeKey as keyof typeof ERROR_CAUSE_CONFIG];
                if (!info) return null;
                const pct = Math.round((count / total) * 100);

                return (
                  <div key={causeKey} className="p-2 bg-slate-50 rounded-lg">
                    <div className="flex justify-between font-medium text-slate-800 mb-1">
                      <span>{info.label}</span>
                      <span className="tabular-nums font-semibold">{count}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 italic mb-1.5">
                      Dica: {info.tip}
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-slate-700 h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Backup & Management Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div>
          <div className="font-semibold text-slate-900">Backup e Armazenamento</div>
          <div className="text-slate-500 text-[11px]">
            Seus dados ficam salvos com segurança no seu navegador. Exporte um arquivo JSON de backup para não perder suas anotações.
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Backup (JSON)
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Restaurar Backup
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              if (window.confirm('Deseja recarregar as questões modelo iniciais de exemplo?')) {
                onResetToSample();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Recarregar questões exemplo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Exemplos
          </button>
        </div>
      </div>
    </div>
  );
};
