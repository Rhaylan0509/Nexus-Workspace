import { DifficultyLevel, ErrorCause, KnowledgeArea, MasteryStatus } from '../types/question';

export interface AreaInfo {
  label: string;
  shortLabel: string;
  description: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
  defaultSubjects: string[];
}

export const AREA_CONFIG: Record<KnowledgeArea, AreaInfo> = {
  linguagens: {
    label: 'Linguagens, Códigos e suas Tecnologias',
    shortLabel: 'Linguagens',
    description: 'Português, Literatura, Redação, Língua Estrangeira, Artes e Ed. Física',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    badgeBg: 'bg-rose-100/70',
    defaultSubjects: [
      'Interpretação de Texto',
      'Gramática & Sintaxe',
      'Literatura Brasileira',
      'Gêneros Textuais',
      'Funções da Linguagem',
      'Língua Inglesa',
      'Língua Espanhola',
      'Artes Visuais'
    ]
  },
  humanas: {
    label: 'Ciências Humanas e suas Tecnologias',
    shortLabel: 'Ciências Humanas',
    description: 'História Geral, História do Brasil, Geografia, Filosofia e Sociologia',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100/70',
    defaultSubjects: [
      'História do Brasil',
      'História Geral',
      'Geografia Física & Clima',
      'Geopolítica & Urbanização',
      'Filosofia Política & Ética',
      'Sociologia Contemporânea',
      'Cidadania & Direitos Humanos'
    ]
  },
  matematica: {
    label: 'Matemática e suas Tecnologias',
    shortLabel: 'Matemática',
    description: 'Álgebra, Geometria, Funções, Estatística, Probabilidade e Aritmética',
    bgLight: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
    badgeBg: 'bg-sky-100/70',
    defaultSubjects: [
      'Geometria Plana',
      'Geometria Espacial',
      'Funções (1º e 2º Grau)',
      'Probabilidade & Estatística',
      'Análise Combinatória',
      'Razão, Proporção & Regra de 3',
      'Trigonometria',
      'Matemática Financeira'
    ]
  },
  naturezas: {
    label: 'Ciências da Natureza e suas Tecnologias',
    shortLabel: 'Ciências da Natureza',
    description: 'Biologia, Física e Química com ênfase prática e ambiental',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100/70',
    defaultSubjects: [
      'Biologia - Ecologia',
      'Biologia - Citologia & Genética',
      'Física - Cinemática & Dinâmica',
      'Física - Eletrodinâmica & Circuitos',
      'Física - Termodinâmica & Ondulatória',
      'Química - Físico-Química (Termo & Soluções)',
      'Química - Química Geral & Atomística',
      'Química - Química Orgânica'
    ]
  }
};

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; color: string; bg: string; dotColor: string; weight: number }> = {
  facil: {
    label: 'Fácil',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    dotColor: 'bg-emerald-500',
    weight: 1
  },
  media: {
    label: 'Média',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    dotColor: 'bg-amber-500',
    weight: 2
  },
  dificil: {
    label: 'Difícil',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    dotColor: 'bg-orange-500',
    weight: 3
  },
  muito_dificil: {
    label: 'Muito Difícil',
    color: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
    dotColor: 'bg-rose-600',
    weight: 4
  }
};

export const ERROR_CAUSE_CONFIG: Record<ErrorCause, { label: string; iconName: string; tip: string }> = {
  falta_atencao: {
    label: 'Falta de Atenção / Leitura Rápida',
    iconName: 'AlertCircle',
    tip: 'Sublinhe palavras-chave no comando da questão ("incorreta", "exceto", "respectivamente").'
  },
  conteudo_teorico: {
    label: 'Lacuna de Conteúdo Teórico',
    iconName: 'BookOpen',
    tip: 'Revise o resumo teórico da matéria e faça pelo menos 5 exercícios de fixação da mesma fórmula ou conceito.'
  },
  interpretacao: {
    label: 'Interpretação de Texto / Gráfico',
    iconName: 'HelpCircle',
    tip: 'Analise o título do gráfico, as legendas e as unidades dos eixos antes de ler as alternativas.'
  },
  calculo: {
    label: 'Erro de Cálculo / Conta',
    iconName: 'Calculator',
    tip: 'Faça rascunhos organizados e verifique se as unidades de medida estão alinhadas (ex: km/h para m/s).'
  },
  gestao_tempo: {
    label: 'Gestão de Tempo / Pressa',
    iconName: 'Clock',
    tip: 'Se a questão exigir cálculos muito longos no início da prova, pule e volte no final.'
  },
  pegadinha: {
    label: 'Distrator / Pegadinha da Banca',
    iconName: 'Target',
    tip: 'Cuidado com alternativas que trazem afirmações verdadeiras, mas que não respondem à pergunta feita.'
  },
  outro: {
    label: 'Outro Motivo',
    iconName: 'MoreHorizontal',
    tip: 'Anote a especificidade desta questão para fixar a lógica de resolução.'
  }
};

export const MASTERY_STATUS_CONFIG: Record<MasteryStatus, { label: string; color: string; bg: string }> = {
  a_revisar: {
    label: 'A Revisar',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200'
  },
  em_treino: {
    label: 'Em Treino',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200'
  },
  dominado: {
    label: 'Dominado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200'
  }
};
