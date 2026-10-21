/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Printer, 
  Play, 
  RotateCcw, 
  Sparkles,
  BookOpen,
  Filter
} from 'lucide-react';
import { 
  MasteryStatus, 
  QuestionFilters, 
  QuestionItem, 
  KnowledgeArea 
} from './types/question';
import { 
  loadQuestionsFromStorage, 
  saveQuestionsToStorage, 
  exportQuestionsAsJson, 
  parseQuestionsFromJson 
} from './services/storage';
import { INITIAL_QUESTIONS } from './data/initialQuestions';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { QuestionCard } from './components/QuestionCard';
import { QuestionFormModal } from './components/QuestionFormModal';
import { PdfExportModal } from './components/PdfExportModal';
import { PracticeModeModal } from './components/PracticeModeModal';
import { AnalyticsOverview } from './components/AnalyticsOverview';
import { DIFFICULTY_CONFIG } from './utils/constants';

export default function App() {
  const [questions, setQuestions] = useState<QuestionItem[]>(() => loadQuestionsFromStorage());
  const [activeTab, setActiveTab] = useState<'questoes' | 'treino' | 'estatisticas'>('questoes');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState<QuestionFilters>({
    searchQuery: '',
    area: 'todas',
    difficulty: 'todas',
    errorCause: 'todos',
    status: 'todos',
    subject: '',
    hasImageOnly: false,
    sortBy: 'recente'
  });

  // Save to localStorage whenever questions change
  useEffect(() => {
    saveQuestionsToStorage(questions);
  }, [questions]);

  // Extract all unique subjects for filter suggestions
  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set).sort();
  }, [questions]);

  // Filtered and Sorted Questions
  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    // Filter by Search Query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.statement.toLowerCase().includes(q) ||
          item.comment.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          (item.topic && item.topic.toLowerCase().includes(q)) ||
          (item.code && item.code.toLowerCase().includes(q))
      );
    }

    // Filter by Area
    if (filters.area !== 'todas') {
      result = result.filter((item) => item.area === filters.area);
    }

    // Filter by Difficulty
    if (filters.difficulty !== 'todas') {
      result = result.filter((item) => item.difficulty === filters.difficulty);
    }

    // Filter by Error Cause
    if (filters.errorCause !== 'todos') {
      result = result.filter((item) => item.errorCause === filters.errorCause);
    }

    // Filter by Status
    if (filters.status !== 'todos') {
      result = result.filter((item) => item.status === filters.status);
    }

    // Filter by Subject
    if (filters.subject) {
      result = result.filter((item) => item.subject === filters.subject);
    }

    // Filter by Has Image
    if (filters.hasImageOnly) {
      result = result.filter((item) => Boolean(item.imageUrl));
    }

    // Sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'antiga') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (filters.sortBy === 'dificuldade_desc') {
        const wA = DIFFICULTY_CONFIG[a.difficulty]?.weight || 0;
        const wB = DIFFICULTY_CONFIG[b.difficulty]?.weight || 0;
        return wB - wA;
      }
      if (filters.sortBy === 'dificuldade_asc') {
        const wA = DIFFICULTY_CONFIG[a.difficulty]?.weight || 0;
        const wB = DIFFICULTY_CONFIG[b.difficulty]?.weight || 0;
        return wA - wB;
      }
      if (filters.sortBy === 'menos_revisadas') {
        return (a.reviewCount || 0) - (b.reviewCount || 0);
      }
      // Default: mais recente
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [questions, filters]);

  // Handlers
  const handleSaveQuestion = (newOrUpdated: QuestionItem) => {
    setQuestions((prev) => {
      const exists = prev.some((q) => q.id === newOrUpdated.id);
      if (exists) {
        return prev.map((q) => (q.id === newOrUpdated.id ? newOrUpdated : q));
      } else {
        return [newOrUpdated, ...prev];
      }
    });
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleDuplicateQuestion = (question: QuestionItem) => {
    const duplicated: QuestionItem = {
      ...question,
      id: `quest-${Date.now()}`,
      code: question.code ? `${question.code} (Cópia)` : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewCount: 0,
      lastReviewedAt: undefined
    };
    setQuestions((prev) => [duplicated, ...prev]);
  };

  const handleStatusChange = (id: string, newStatus: MasteryStatus) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus, updatedAt: new Date().toISOString() } : q))
    );
  };

  const handleQuestionReviewed = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              reviewCount: (q.reviewCount || 0) + 1,
              lastReviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          : q
      )
    );
  };

  const handleExportJson = () => {
    exportQuestionsAsJson(questions);
  };

  const handleImportJson = (content: string) => {
    try {
      const imported = parseQuestionsFromJson(content);
      if (window.confirm(`Deseja importar ${imported.length} questões? Elas serão adicionadas ao seu caderno.`)) {
        setQuestions((prev) => [...imported, ...prev]);
        alert(`${imported.length} questões importadas com sucesso!`);
      }
    } catch (err: unknown) {
      alert(`Erro ao importar arquivo: ${(err as Error).message}`);
    }
  };

  const handleResetToSample = () => {
    setQuestions(INITIAL_QUESTIONS);
    saveQuestionsToStorage(INITIAL_QUESTIONS);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setIsFormModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingQuestion(null);
    setIsFormModalOpen(true);
  };

  const handleAreaFilterClick = (area: KnowledgeArea) => {
    setFilters((prev) => ({ ...prev, area }));
    setActiveTab('questoes');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 3-Zone Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewQuestionModal={handleOpenNew}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        filteredCount={filteredQuestions.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Subheader Context / Action Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {activeTab === 'questoes' && 'Caderno de Questões & Análise de Erros'}
              {activeTab === 'treino' && 'Modo Treino & Simulado Ativo'}
              {activeTab === 'estatisticas' && 'Diagnóstico de Desempenho & Gargalos'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {activeTab === 'questoes' &&
                'Organize suas dúvidas por área do ENEM, revise resoluções comentadas e exporte em PDF personalizado.'}
              {activeTab === 'treino' &&
                'Resolva questões sem ver o gabarito previamente para testar sua retenção de conteúdo.'}
              {activeTab === 'estatisticas' &&
                'Identifique em quais áreas e tipos de erro você mais perde pontos para direcionar seus estudos.'}
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsPracticeModalOpen(true)}
              disabled={filteredQuestions.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Iniciar treino interativo com a lista filtrada"
            >
              <Play className="w-3.5 h-3.5 fill-current text-slate-700" />
              <span>Treinar Filtradas ({filteredQuestions.length})</span>
            </button>

            <button
              onClick={() => setIsPdfModalOpen(true)}
              disabled={filteredQuestions.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Gerar e imprimir PDF com filtros aplicados"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Questions View */}
        {activeTab === 'questoes' && (
          <div className="space-y-5">
            {/* Filter Bar with search and area selectors */}
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              totalQuestionsCount={questions.length}
              filteredCount={filteredQuestions.length}
              allSubjects={allSubjects}
            />

            {/* List of Questions */}
            {filteredQuestions.length > 0 ? (
              <div className="space-y-4">
                {filteredQuestions.map((q, index) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    questionIndex={index}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteQuestion}
                    onDuplicate={handleDuplicateQuestion}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Filter className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="font-bold text-slate-900 text-base">
                    Nenhuma questão encontrada com os filtros atuais
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tente ajustar sua busca ou os seletores de área, dificuldade e status.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() =>
                      setFilters({
                        searchQuery: '',
                        area: 'todas',
                        difficulty: 'todas',
                        errorCause: 'todos',
                        status: 'todos',
                        subject: '',
                        hasImageOnly: false,
                        sortBy: 'recente'
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar Filtros
                  </button>
                  <button
                    onClick={handleOpenNew}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Nova Questão
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Interactive Practice Mode Landing */}
        {activeTab === 'treino' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 shadow-xs">
            <div className="w-16 h-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Sessão de Treino Ativa
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
                Pratique com as <strong>{filteredQuestions.length} questões</strong> selecionadas
                pelos filtros atuais. As alternativas serão apresentadas sem gabarito prévio para você testar seu raciocínio.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-left text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-900 mb-1">Dica de Estudo Ativo:</div>
              <div>• Tente resolver cada item no papel antes de clicar na alternativa.</div>
              <div>• Ao confirmar a resposta, veja a resolução comentada e a dica para não repetir o erro.</div>
              <div>• Ao acertar com segurança, marque a questão como <strong>Dominada</strong>.</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsPracticeModalOpen(true)}
                disabled={filteredQuestions.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Começar Treino Agora ({filteredQuestions.length} questões)</span>
              </button>
              <button
                onClick={() => setActiveTab('questoes')}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Voltar à Lista de Questões
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Diagnostics & Analytics */}
        {activeTab === 'estatisticas' && (
          <AnalyticsOverview
            questions={questions}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onResetToSample={handleResetToSample}
            onSelectAreaFilter={handleAreaFilterClick}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-medium text-slate-800">Caderno de Erros & Questões</span> · Preparatório ENEM & Vestibulares
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleResetToSample}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              Restaurar Exemplos
            </button>
            <span>·</span>
            <button
              onClick={handleExportJson}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              Backup JSON
            </button>
            <span>·</span>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              Exportar PDF
            </button>
          </div>
        </div>
      </footer>

      {/* Form Modal (Create / Edit) */}
      <QuestionFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingQuestion(null);
        }}
        onSave={handleSaveQuestion}
        editingQuestion={editingQuestion}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        filteredQuestions={filteredQuestions}
        currentFilters={filters}
      />

      {/* Interactive Practice Mode Modal */}
      <PracticeModeModal
        isOpen={isPracticeModalOpen}
        onClose={() => setIsPracticeModalOpen(false)}
        questions={filteredQuestions}
        onUpdateStatus={handleStatusChange}
        onQuestionReviewed={handleQuestionReviewed}
      />
    </div>
  );
}
