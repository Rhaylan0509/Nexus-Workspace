import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Award,
  Lightbulb,
  Check
} from 'lucide-react';
import { MasteryStatus, QuestionItem } from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG, ERROR_CAUSE_CONFIG } from '../utils/constants';

interface PracticeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuestionItem[];
  onUpdateStatus: (id: string, newStatus: MasteryStatus) => void;
  onQuestionReviewed: (id: string) => void;
}

export const PracticeModeModal: React.FC<PracticeModeModalProps> = ({
  isOpen,
  onClose,
  questions,
  onUpdateStatus,
  onQuestionReviewed
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ [qId: string]: boolean }>({});
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const areaInfo = AREA_CONFIG[currentQ.area] || { shortLabel: currentQ.area, textColor: 'text-slate-700' };
  const diffInfo = DIFFICULTY_CONFIG[currentQ.difficulty] || { label: currentQ.difficulty };
  const errorInfo = currentQ.errorCause ? ERROR_CAUSE_CONFIG[currentQ.errorCause] : null;

  const handleConfirmAnswer = () => {
    if (!selectedAlternative) return;
    setIsAnswerRevealed(true);
    const isCorrect = selectedAlternative === currentQ.correctAlternative;
    setSessionResults((prev) => ({ ...prev, [currentQ.id]: isCorrect }));
    onQuestionReviewed(currentQ.id);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAlternative(null);
      setIsAnswerRevealed(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedAlternative(null);
      setIsAnswerRevealed(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAlternative(null);
    setIsAnswerRevealed(false);
    setSessionResults({});
    setIsCompleted(false);
  };

  const correctCount = Object.values(sessionResults).filter(Boolean).length;
  const answeredCount = Object.keys(sessionResults).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 text-sm sm:text-base">
              Modo Treino Interativo
            </span>
            <span className="text-xs text-slate-500">
              Questão <strong className="text-slate-900 tabular-nums">{currentIndex + 1}</strong> de{' '}
              <span className="tabular-nums">{questions.length}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-slate-900 h-1.5 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        {!isCompleted ? (
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm">
            {/* Metadata row */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                {currentQ.code && <span className="font-semibold text-slate-800">{currentQ.code}</span>}
                <span aria-hidden="true">·</span>
                <span className={`${areaInfo.textColor} font-semibold`}>{areaInfo.shortLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{currentQ.subject}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${diffInfo.dotColor}`} />
                <span className={diffInfo.color}>{diffInfo.label}</span>
              </div>
            </div>

            {/* Statement */}
            <div className="text-slate-900 leading-relaxed whitespace-pre-line text-sm sm:text-base">
              {currentQ.statement}
            </div>

            {/* Image */}
            {currentQ.imageUrl && (
              <div className="border border-slate-100 rounded-lg p-2 bg-slate-50 inline-block max-w-full">
                <img
                  src={currentQ.imageUrl}
                  alt={currentQ.imageCaption || 'Imagem da questão'}
                  className="max-h-56 rounded object-contain"
                  referrerPolicy="no-referrer"
                />
                {currentQ.imageCaption && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    {currentQ.imageCaption}
                  </p>
                )}
              </div>
            )}

            {/* Alternatives */}
            <div className="space-y-2 pt-2">
              {currentQ.alternatives.map((alt) => {
                const isSelected = selectedAlternative === alt.id;
                const isCorrect = alt.id === currentQ.correctAlternative;

                let rowStyle = 'border-slate-200 bg-white hover:border-slate-300 text-slate-700';
                let letterStyle = 'border-slate-300 text-slate-600 bg-slate-50';

                if (isAnswerRevealed) {
                  if (isCorrect) {
                    rowStyle = 'border-emerald-300 bg-emerald-50 text-emerald-950 font-medium';
                    letterStyle = 'border-emerald-600 bg-emerald-600 text-white font-bold';
                  } else if (isSelected && !isCorrect) {
                    rowStyle = 'border-rose-300 bg-rose-50 text-rose-950';
                    letterStyle = 'border-rose-600 bg-rose-600 text-white font-bold';
                  }
                } else if (isSelected) {
                  rowStyle = 'border-slate-900 bg-slate-900 text-white shadow-xs';
                  letterStyle = 'border-slate-700 bg-slate-800 text-white';
                }

                return (
                  <button
                    key={alt.id}
                    disabled={isAnswerRevealed}
                    onClick={() => setSelectedAlternative(alt.id)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border text-xs sm:text-sm transition-all cursor-pointer ${rowStyle}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md border text-xs font-semibold shrink-0 ${letterStyle}`}
                    >
                      {alt.id}
                    </span>
                    <span className="flex-1 pt-0.5 leading-snug">{alt.text}</span>

                    {isAnswerRevealed && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 self-center" />
                    )}
                    {isAnswerRevealed && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 self-center" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback box when answer is revealed */}
            {isAnswerRevealed && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedAlternative === currentQ.correctAlternative ? (
                      <div className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Resposta Correta! Parabéns!
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-sm">
                        <XCircle className="w-5 h-5 text-rose-600" />
                        Resposta Incorreta. Gabarito: {currentQ.correctAlternative}
                      </div>
                    )}
                  </div>

                  {/* Quick status update button */}
                  <button
                    onClick={() => onUpdateStatus(currentQ.id, 'dominado')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Marcar como Dominada
                  </button>
                </div>

                {errorInfo && (
                  <div className="text-xs text-slate-600 border-t border-slate-200/70 pt-2">
                    <strong>Ponto fraco registrado:</strong> {errorInfo.label}
                  </div>
                )}

                {currentQ.comment && (
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line border-t border-slate-200/70 pt-2">
                    <strong>Resolução comentada:</strong>
                    <br />
                    {currentQ.comment}
                  </div>
                )}

                {currentQ.tips && (
                  <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Dica de fixação:</strong> {currentQ.tips}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Completion Screen */
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Sessão de Treino Concluída!
            </h3>
            <p className="text-sm text-slate-600 max-w-md">
              Você revisou {answeredCount} questões. Seu aproveitamento foi de{' '}
              <strong className="text-slate-900">
                {correctCount} acerto(s) ({answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%)
              </strong>.
            </p>
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Refazer Treino
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Voltar ao Caderno
              </button>
            </div>
          </div>
        )}

        {/* Footer controls */}
        {!isCompleted && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0 rounded-b-2xl">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            {!isAnswerRevealed ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={!selectedAlternative}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Confirmar Resposta
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-1 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <span>{currentIndex === questions.length - 1 ? 'Finalizar' : 'Próxima Questão'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
