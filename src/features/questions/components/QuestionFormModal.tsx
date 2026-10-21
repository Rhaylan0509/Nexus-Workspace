import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  Link as LinkIcon, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { 
  DifficultyLevel, 
  ErrorCause, 
  KnowledgeArea, 
  MasteryStatus, 
  QuestionAlternative, 
  QuestionItem 
} from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG, ERROR_CAUSE_CONFIG } from '../utils/constants';

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: QuestionItem) => void;
  editingQuestion?: QuestionItem | null;
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingQuestion
}) => {
  const [code, setCode] = useState('');
  const [area, setArea] = useState<KnowledgeArea>('matematica');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('media');

  const [statement, setStatement] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [alternatives, setAlternatives] = useState<QuestionAlternative[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
    { id: 'E', text: '' }
  ]);
  const [correctAlternative, setCorrectAlternative] = useState('A');
  const [userSelectedAlternative, setUserSelectedAlternative] = useState('');
  const [errorCause, setErrorCause] = useState<ErrorCause>('conteudo_teorico');
  const [comment, setComment] = useState('');
  const [tips, setTips] = useState('');
  const [status, setStatus] = useState<MasteryStatus>('a_revisar');

  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state when editing or opening
  useEffect(() => {
    if (editingQuestion) {
      setCode(editingQuestion.code || '');
      setArea(editingQuestion.area);
      setSubject(editingQuestion.subject);
      setTopic(editingQuestion.topic || '');
      setDifficulty(editingQuestion.difficulty);
      setStatement(editingQuestion.statement);
      setImageUrl(editingQuestion.imageUrl || '');
      setImageCaption(editingQuestion.imageCaption || '');
      setSourceUrl(editingQuestion.sourceUrl || '');
      setAlternatives(
        editingQuestion.alternatives.length > 0
          ? editingQuestion.alternatives
          : [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
              { id: 'C', text: '' },
              { id: 'D', text: '' },
              { id: 'E', text: '' }
            ]
      );
      setCorrectAlternative(editingQuestion.correctAlternative);
      setUserSelectedAlternative(editingQuestion.userSelectedAlternative || '');
      setErrorCause(editingQuestion.errorCause || 'conteudo_teorico');
      setComment(editingQuestion.comment);
      setTips(editingQuestion.tips || '');
      setStatus(editingQuestion.status);
    } else {
      // Reset defaults
      setCode('');
      setArea('matematica');
      setSubject('Geometria Plana');
      setTopic('');
      setDifficulty('media');
      setStatement('');
      setImageUrl('');
      setImageCaption('');
      setSourceUrl('');
      setAlternatives([
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
        { id: 'E', text: '' }
      ]);
      setCorrectAlternative('A');
      setUserSelectedAlternative('');
      setErrorCause('conteudo_teorico');
      setComment('');
      setTips('');
      setStatus('a_revisar');
    }
    setValidationError(null);
  }, [editingQuestion, isOpen]);

  if (!isOpen) return null;

  const handleAlternativeTextChange = (id: string, text: string) => {
    setAlternatives((prev) =>
      prev.map((alt) => (alt.id === id ? { ...alt, text } : alt))
    );
  };

  const handleAddAlternative = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const nextLetter = letters[alternatives.length];
    if (nextLetter) {
      setAlternatives((prev) => [...prev, { id: nextLetter, text: '' }]);
    }
  };

  const handleRemoveAlternative = (id: string) => {
    if (alternatives.length <= 2) {
      alert('Uma questão precisa de no mínimo 2 alternativas.');
      return;
    }
    const filtered = alternatives.filter((a) => a.id !== id);
    // Re-letter
    const relettered = filtered.map((a, idx) => ({
      ...a,
      id: String.fromCharCode(65 + idx)
    }));
    setAlternatives(relettered);
    if (correctAlternative === id) {
      setCorrectAlternative(relettered[0].id);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Por favor escolha uma imagem menor que 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!statement.trim()) {
      setValidationError('O enunciado da questão é obrigatório.');
      return;
    }

    const filledAlternatives = alternatives.filter((a) => a.text.trim() !== '');
    if (filledAlternatives.length < 2) {
      setValidationError('Preencha o texto de pelo menos duas alternativas.');
      return;
    }

    const now = new Date().toISOString();
    const finalQuestion: QuestionItem = {
      id: editingQuestion?.id || `quest-${Date.now()}`,
      code: code.trim() || undefined,
      area,
      subject: subject.trim() || AREA_CONFIG[area].defaultSubjects[0],
      topic: topic.trim() || undefined,
      difficulty,
      statement: statement.trim(),
      imageUrl: imageUrl.trim() || undefined,
      imageCaption: imageCaption.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      alternatives: alternatives.filter((a) => a.text.trim() !== ''),
      correctAlternative,
      userSelectedAlternative: userSelectedAlternative || undefined,
      errorCause: userSelectedAlternative ? errorCause : undefined,
      comment: comment.trim(),
      tips: tips.trim() || undefined,
      status,
      reviewCount: editingQuestion ? editingQuestion.reviewCount : 0,
      lastReviewedAt: editingQuestion?.lastReviewedAt,
      createdAt: editingQuestion?.createdAt || now,
      updatedAt: now
    };

    onSave(finalQuestion);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {editingQuestion ? 'Editar Questão' : 'Nova Questão no Caderno'}
            </h2>
            <p className="text-xs text-slate-500">
              Preencha os dados do enunciado, alternativas, gabarito e análise do erro.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Classification & Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. Área do Conhecimento (Classificação Principal) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['linguagens', 'humanas', 'matematica', 'naturezas'] as KnowledgeArea[]).map((ar) => {
                const info = AREA_CONFIG[ar];
                const isSelected = area === ar;
                return (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => {
                      setArea(ar);
                      if (!subject || !info.defaultSubjects.includes(subject)) {
                        setSubject(info.defaultSubjects[0]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs font-medium'
                        : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{info.shortLabel}</div>
                    <div className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {info.defaultSubjects[0]}...
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code, Subject, Topic, Difficulty Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Código / Origem
              </label>
              <input
                type="text"
                placeholder="Ex: ENEM 2023 - Q142"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Disciplina / Matéria *
              </label>
              <input
                type="text"
                list="subjects-list"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Física, Geometria..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                required
              />
              <datalist id="subjects-list">
                {AREA_CONFIG[area].defaultSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tópico / Assunto
              </label>
              <input
                type="text"
                placeholder="Ex: Termodinâmica"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dificuldade *
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {Object.entries(DIFFICULTY_CONFIG).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Statement (Enunciado) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2. Enunciado da Questão *
            </label>
            <textarea
              rows={4}
              placeholder="Cole ou digite o texto completo do enunciado da questão..."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed font-normal"
              required
            />
          </div>

          {/* Section 3: Image and Reference Link */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Imagem, Gráfico ou Link da Questão (Opcional)</span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setImageCaption('');
                  }}
                  className="text-rose-600 hover:text-rose-700 text-[11px] font-normal cursor-pointer"
                >
                  Remover imagem
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Image URL */}
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Colar URL da imagem (ou SVG Data URI)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://exemplo.com/grafico.png"
                    value={imageUrl.startsWith('data:') ? '(Imagem carregada via upload)' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <LinkIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              {/* Option B: Upload from local device */}
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Ou carregar do dispositivo
                </label>
                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Escolher arquivo de imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Image Preview & Caption */}
            {imageUrl && (
              <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center gap-3">
                <img
                  src={imageUrl}
                  alt="Pré-visualização"
                  className="max-h-24 max-w-xs object-contain rounded border border-slate-200 bg-white p-1"
                />
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Legenda da imagem (ex: Figura 1 - Diagrama de fases)"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}

            {/* External Reference Link (resolução em vídeo / link prova) */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">
                Link de Referência / Vídeo Resolução Externa
              </label>
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=... ou link do vestibular"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Section 4: Alternatives & Answer Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                3. Alternativas e Gabarito Oficial *
              </label>
              <span className="text-[11px] text-slate-500">
                Clique na letra para marcar qual é o <strong>Gabarito Oficial</strong>
              </span>
            </div>

            <div className="space-y-2">
              {alternatives.map((alt) => {
                const isCorrect = correctAlternative === alt.id;
                return (
                  <div
                    key={alt.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCorrectAlternative(alt.id)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                        isCorrect
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isCorrect ? 'Esta é a resposta correta' : 'Marcar como Gabarito'}
                    >
                      {alt.id}
                    </button>

                    <input
                      type="text"
                      placeholder={`Texto da alternativa (${alt.id})...`}
                      value={alt.text}
                      onChange={(e) => handleAlternativeTextChange(alt.id, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-slate-800"
                    />

                    {isCorrect && (
                      <span className="text-[11px] text-emerald-700 font-semibold px-2 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Gabarito
                      </span>
                    )}

                    {alternatives.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAlternative(alt.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                        title="Remover alternativa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {alternatives.length < 7 && (
              <button
                type="button"
                onClick={handleAddAlternative}
                className="mt-2.5 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Alternativa ({String.fromCharCode(65 + alternatives.length)})
              </button>
            )}
          </div>

          {/* Section 5: Caderno de Erros (Diagnosis & Commentary) */}
          <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950">
                4. Análise do Erro & Comentário de Correção (Caderno de Erros)
              </span>
              <span className="text-[11px] text-amber-800">
                Fundamental para fixar o aprendizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* What alternative was marked wrong */}
              <div>
                <label className="block text-[11px] text-slate-700 font-medium mb-1">
                  Alternativa que você marcou quando errou (Opcional)
                </label>
                <select
                  value={userSelectedAlternative}
                  onChange={(e) => setUserSelectedAlternative(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">Não marcado / Acertei de primeira</option>
                  {alternatives.map((a) => (
                    <option key={a.id} value={a.id}>
                      Alternativa ({a.id}) {a.id === correctAlternative ? '- (Igual ao gabarito)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error cause diagnosis */}
              <div>
                <label className="block text-[11px] text-slate-700 font-medium mb-1">
                  Qual foi o motivo principal do erro?
                </label>
                <select
                  value={errorCause}
                  onChange={(e) => setErrorCause(e.target.value as ErrorCause)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {Object.entries(ERROR_CAUSE_CONFIG).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Commentary / Resolution Text */}
            <div>
              <label className="block text-[11px] text-slate-700 font-medium mb-1">
                Comentário em Texto & Resolução Passo a Passo *
              </label>
              <textarea
                rows={3}
                placeholder="Explique a resolução correta, as contas necessárias ou por que a sua hipótese anterior estava errada..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal leading-relaxed"
              />
            </div>

            {/* Quick Tip for not repeating the mistake */}
            <div>
              <label className="block text-[11px] text-slate-700 font-medium mb-1">
                Dica Rápida / Pegadinha da Banca para lembrar na prova
              </label>
              <input
                type="text"
                placeholder="Ex: Cuidado com a palavra 'exceto'; lembrar que velocidade deve ser convertida para m/s"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-[11px] text-slate-700 font-medium mb-1">
                Status de Domínio Atual
              </label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'a_revisar', label: 'A Revisar' },
                  { id: 'em_treino', label: 'Em Treino' },
                  { id: 'dominado', label: 'Dominado' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatus(st.id as MasteryStatus)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      status === st.id
                        ? 'border-slate-900 bg-slate-900 text-white font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            {editingQuestion ? 'Salvar Alterações' : 'Salvar no Caderno'}
          </button>
        </div>
      </div>
    </div>
  );
};
