import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Copy, 
  AlertTriangle,
  Lightbulb,
  Check
} from 'lucide-react';
import { MasteryStatus, QuestionItem } from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG, ERROR_CAUSE_CONFIG, MASTERY_STATUS_CONFIG } from '../utils/constants';

interface QuestionCardProps {
  question: QuestionItem;
  questionIndex: number;
  onEdit: (question: QuestionItem) => void;
  onDelete: (id: string) => void;
  onDuplicate: (question: QuestionItem) => void;
  onStatusChange: (id: string, newStatus: MasteryStatus) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionIndex,
  onEdit,
  onDelete,
  onDuplicate,
  onStatusChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTry, setSelectedTry] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const areaInfo = AREA_CONFIG[question.area] || {
    shortLabel: question.area,
    label: question.area,
    textColor: 'text-slate-700'
  };
  const diffInfo = DIFFICULTY_CONFIG[question.difficulty] || { label: question.difficulty };
  const errorInfo = question.errorCause ? ERROR_CAUSE_CONFIG[question.errorCause] : null;

  const handleCopyText = () => {
    const formatted = `Questão ${questionIndex + 1}: ${question.code || ''}\n[${areaInfo.shortLabel} · ${question.subject}]\n\n${question.statement}\n\n${question.alternatives.map((a) => `${a.id}) ${a.text}`).join('\n')}\n\nGabarito: ${question.correctAlternative}`;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 transition-all hover:border-slate-300 shadow-xs relative">
      {/* Header: Clean unboxed metadata with typographic separators (Anti-Slop Zero-Pill) */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
          <span className="font-bold text-slate-900 text-sm">
            #{questionIndex + 1}
          </span>
          {question.code && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-slate-800 font-semibold">{question.code}</span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className={`${areaInfo.textColor} font-semibold`}>
            {areaInfo.shortLabel}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{question.subject}</span>
          {question.topic && (
            <>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span className="text-slate-400">{question.topic}</span>
            </>
          )}
        </div>

        {/* Difficulty and Status Indicators */}
        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1.5 font-medium ${diffInfo.color}`}>
            <span className={`w-2 h-2 rounded-full ${diffInfo.dotColor}`} />
            {diffInfo.label}
          </span>

          <span aria-hidden="true" className="text-slate-200">|</span>

          {/* Inline Status Selector */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-[11px] font-medium">
            {(['a_revisar', 'em_treino', 'dominado'] as MasteryStatus[]).map((st) => {
              const active = question.status === st;
              const cfg = MASTERY_STATUS_CONFIG[st];
              return (
                <button
                  key={st}
                  onClick={() => onStatusChange(question.id, st)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={`Definir status como ${cfg.label}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Statement */}
      <div className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line mb-4 font-normal">
        {question.statement}
      </div>

      {/* Embedded Image or Graphic */}
      {question.imageUrl && (
        <div className="mb-5 border border-slate-100 rounded-lg p-2.5 bg-slate-50/70 inline-block max-w-full">
          <img
            src={question.imageUrl}
            alt={question.imageCaption || 'Imagem da questão'}
            className="max-h-64 rounded object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
            onClick={() => setShowImageModal(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {question.imageCaption && (
            <p className="text-[11px] text-slate-500 mt-1.5 italic">
              {question.imageCaption}
            </p>
          )}
        </div>
      )}

      {/* Alternatives */}
      <div className="space-y-2 mb-4">
        {question.alternatives.map((alt) => {
          const isOfficialKey = alt.id === question.correctAlternative;
          const isUserErrorMarked =
            question.userSelectedAlternative &&
            alt.id === question.userSelectedAlternative;
          const isSelectedInCard = selectedTry === alt.id;

          let containerStyle = 'border-slate-200 hover:border-slate-300 bg-white text-slate-700';
          let letterStyle = 'border-slate-300 text-slate-600 bg-slate-50';

          if (isExpanded) {
            if (isOfficialKey) {
              containerStyle = 'border-emerald-300 bg-emerald-50/50 text-emerald-950 font-medium';
              letterStyle = 'border-emerald-500 bg-emerald-600 text-white font-bold';
            } else if (isUserErrorMarked) {
              containerStyle = 'border-rose-200 bg-rose-50/50 text-rose-900';
              letterStyle = 'border-rose-400 bg-rose-100 text-rose-700 line-through';
            }
          } else if (selectedTry) {
            if (isSelectedInCard) {
              if (isOfficialKey) {
                containerStyle = 'border-emerald-300 bg-emerald-50 text-emerald-950';
                letterStyle = 'border-emerald-600 bg-emerald-600 text-white';
              } else {
                containerStyle = 'border-rose-300 bg-rose-50 text-rose-950';
                letterStyle = 'border-rose-600 bg-rose-600 text-white';
              }
            }
          }

          return (
            <button
              key={alt.id}
              onClick={() => {
                if (!isExpanded) {
                  setSelectedTry(alt.id);
                }
              }}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-xs sm:text-sm transition-all cursor-pointer ${containerStyle}`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md border text-xs font-semibold shrink-0 transition-colors ${letterStyle}`}
              >
                {alt.id}
              </span>
              <span className="flex-1 pt-0.5 leading-snug">{alt.text}</span>

              {isExpanded && isOfficialKey && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Gabarito
                </span>
              )}

              {isExpanded && isUserErrorMarked && !isOfficialKey && (
                <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium shrink-0">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  Meu Erro
                </span>
              )}

              {!isExpanded && selectedTry && isSelectedInCard && (
                <span className="text-xs font-medium shrink-0">
                  {isOfficialKey ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Correta!
                    </span>
                  ) : (
                    <span className="text-rose-600 inline-flex items-center gap-1">
                      Incorreta
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mistake Diagnostic & Resolution Section */}
      <div className="border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 py-1 transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-slate-500" />
                <span>Ocultar Resolução e Diagnóstico</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-slate-500" />
                <span>Ver Gabarito, Comentário & Diagnóstico</span>
              </>
            )}
          </button>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-1 text-slate-500">
            {question.sourceUrl && (
              <a
                href={question.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Abrir link de referência ou vídeo resolução"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={handleCopyText}
              className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Copiar texto da questão"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => onDuplicate(question)}
              className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Duplicar questão"
            >
              <span className="text-[11px] font-semibold px-1">2x</span>
            </button>

            <button
              onClick={() => onEdit(question)}
              className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Editar questão"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                if (window.confirm('Tem certeza de que deseja remover esta questão do caderno?')) {
                  onDelete(question.id);
                }
              }}
              className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Excluir questão"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible content */}
        {isExpanded && (
          <div className="mt-3.5 space-y-3 bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 text-xs sm:text-sm">
            {/* Error Cause Callout */}
            {errorInfo && (
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-200/70">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    Causa do Erro: {errorInfo.label}
                  </div>
                  {question.userSelectedAlternative && (
                    <div className="text-slate-500 text-xs mt-0.5">
                      Você havia marcado a alternativa{' '}
                      <strong className="text-rose-600">{question.userSelectedAlternative}</strong>, mas a correta é{' '}
                      <strong className="text-emerald-600">{question.correctAlternative}</strong>.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Resolution / Commentary */}
            {question.comment ? (
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 text-xs">
                  Resolução & Comentário:
                </div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {question.comment}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 italic text-xs">
                Nenhum comentário adicionado ainda. Clique em "Editar" para adicionar a resolução.
              </div>
            )}

            {/* Quick Tip / Key takeaway */}
            {question.tips && (
              <div className="flex items-start gap-2 pt-2 border-t border-slate-200/70 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/70">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-semibold">Ponto de Atenção para não errar de novo:</span>{' '}
                  {question.tips}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {showImageModal && question.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="bg-white rounded-xl p-3 max-w-3xl max-h-[90vh] overflow-auto flex flex-col items-center">
            <img
              src={question.imageUrl}
              alt={question.imageCaption || 'Imagem ampliada'}
              className="max-h-[80vh] w-auto object-contain rounded"
            />
            {question.imageCaption && (
              <p className="text-xs text-slate-600 mt-2 text-center">
                {question.imageCaption}
              </p>
            )}
            <button
              onClick={() => setShowImageModal(false)}
              className="mt-3 px-4 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
