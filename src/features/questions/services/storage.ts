import { QuestionItem } from '../types/question';
import { INITIAL_QUESTIONS } from '../data/initialQuestions';

const STORAGE_KEY = 'caderno_erros_questoes_v1';

export function loadQuestionsFromStorage(): QuestionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveQuestionsToStorage(INITIAL_QUESTIONS);
      return INITIAL_QUESTIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    saveQuestionsToStorage(INITIAL_QUESTIONS);
    return INITIAL_QUESTIONS;
  } catch (err) {
    console.error('Falha ao carregar questões do localStorage:', err);
    return INITIAL_QUESTIONS;
  }
}

export function saveQuestionsToStorage(questions: QuestionItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.error('Falha ao salvar questões no localStorage:', err);
  }
}

export function exportQuestionsAsJson(questions: QuestionItem[]): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const date = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('download', `caderno_erros_backup_${date}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function parseQuestionsFromJson(jsonContent: string): QuestionItem[] {
  const parsed = JSON.parse(jsonContent);
  if (!Array.isArray(parsed)) {
    throw new Error('O arquivo importado deve conter uma lista de questões.');
  }
  // Basic validation
  return parsed.map((item, idx) => {
    if (!item.statement || !item.alternatives || !item.correctAlternative) {
      throw new Error(`A questão #${idx + 1} possui formato inválido.`);
    }
    return {
      id: item.id || `quest-${Date.now()}-${idx}`,
      code: item.code || `Q-${idx + 1}`,
      area: item.area || 'matematica',
      subject: item.subject || 'Geral',
      topic: item.topic || '',
      difficulty: item.difficulty || 'media',
      statement: item.statement,
      imageUrl: item.imageUrl || '',
      imageCaption: item.imageCaption || '',
      sourceUrl: item.sourceUrl || '',
      alternatives: item.alternatives,
      correctAlternative: item.correctAlternative,
      userSelectedAlternative: item.userSelectedAlternative || '',
      errorCause: item.errorCause || 'outro',
      comment: item.comment || '',
      tips: item.tips || '',
      status: item.status || 'a_revisar',
      reviewCount: item.reviewCount || 0,
      lastReviewedAt: item.lastReviewedAt || undefined,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  });
}
