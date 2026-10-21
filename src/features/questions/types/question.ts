export type KnowledgeArea = 
  | 'linguagens' 
  | 'humanas' 
  | 'matematica' 
  | 'naturezas';

export type DifficultyLevel = 'facil' | 'media' | 'dificil' | 'muito_dificil';

export type ErrorCause = 
  | 'falta_atencao' 
  | 'conteudo_teorico' 
  | 'interpretacao' 
  | 'calculo' 
  | 'gestao_tempo' 
  | 'pegadinha'
  | 'outro';

export type MasteryStatus = 'a_revisar' | 'em_treino' | 'dominado';

export interface QuestionAlternative {
  id: string; // 'A', 'B', 'C', 'D', 'E'
  text: string;
}

export interface QuestionItem {
  id: string;
  code?: string; // Ex: "ENEM 2023 - Q142" ou "Matemática #01"
  area: KnowledgeArea; // linguagens, humanas, matematica, naturezas
  subject: string; // Ex: "Física", "Química", "História", "Geometria Plana", "Sintaxe"
  topic?: string; // Ex: "Eletrodinâmica", "Era Vargas", "Função Quadrática"
  difficulty: DifficultyLevel; // facil, media, dificil, muito_dificil
  
  statement: string; // Enunciado da questão
  imageUrl?: string; // Colar imagem / link de imagem ou upload base64
  imageCaption?: string; // Legenda opcional da imagem
  sourceUrl?: string; // Link de referência (video resolução, prova oficial, etc.)
  
  alternatives: QuestionAlternative[]; // Lista de alternativas
  correctAlternative: string; // Gabarito oficial: 'A', 'B', 'C', 'D', 'E'
  
  // Caderno de Erros específicos
  userSelectedAlternative?: string; // Alternativa que marquei errado
  errorCause?: ErrorCause; // Por que errei?
  comment: string; // Comentário em texto / Resolução explicada
  tips?: string; // Dica rápida de revisão ou pegadinha para lembrar
  
  status: MasteryStatus; // 'a_revisar', 'em_treino', 'dominado'
  reviewCount: number; // Quantas vezes revisou
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionFilters {
  searchQuery: string;
  area: KnowledgeArea | 'todas';
  difficulty: DifficultyLevel | 'todas';
  errorCause: ErrorCause | 'todos';
  status: MasteryStatus | 'todos';
  subject: string;
  hasImageOnly: boolean;
  sortBy: 'recente' | 'antiga' | 'dificuldade_asc' | 'dificuldade_desc' | 'menos_revisadas';
}

export interface PdfExportOptions {
  title: string;
  subtitle: string;
  studentName: string;
  layoutMode: 'completo' | 'simulado' | 'caderno_erros';
  includeImages: boolean;
  includeComments: boolean;
  includeErrorDiagnosis: boolean;
  includeAnswerKeyAtEnd: boolean;
  includeNotesSpace: boolean; // Espaço pautado para rascunho de cálculo
  fontSize: 'pequena' | 'normal' | 'grande';
  columns: 1 | 2;
}
