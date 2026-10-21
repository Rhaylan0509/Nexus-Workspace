import { PdfExportOptions, QuestionItem } from '../types/question';
import { AREA_CONFIG, DIFFICULTY_CONFIG, ERROR_CAUSE_CONFIG } from '../utils/constants';

export function openPrintDialogForQuestions(
  questions: QuestionItem[],
  options: PdfExportOptions
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // If popups are blocked, fallback to normal window.print after setting document class
    window.print();
    return;
  }

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(options.title || 'Caderno de Questões e Erros')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 16mm 12mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: ${options.fontSize === 'pequena' ? '12px' : options.fontSize === 'grande' ? '14px' : '13px'};
      line-height: 1.5;
    }

    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .header-main h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .header-main p {
      margin: 0;
      font-size: 11px;
      color: #475569;
    }

    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }

    .student-badge {
      display: inline-block;
      font-weight: 600;
      color: #0f172a;
    }

    .questions-container {
      ${options.columns === 2 ? 'column-count: 2; column-gap: 24px; column-rule: 1px solid #e2e8f0;' : ''}
    }

    .question-item {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px dashed #cbd5e1;
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 11px;
    }

    .question-number {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
    }

    .question-tags {
      color: #64748b;
      font-size: 10px;
    }

    .question-statement {
      white-space: pre-line;
      margin-bottom: 12px;
      color: #1e293b;
      text-align: justify;
    }

    .question-figure {
      text-align: center;
      margin: 12px 0;
      break-inside: avoid;
    }

    .question-figure img {
      max-width: 90%;
      max-height: 180px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .figure-caption {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      font-style: italic;
    }

    .alternatives-list {
      margin: 10px 0;
      padding: 0;
      list-style: none;
    }

    .alt-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 6px;
      font-size: ${options.fontSize === 'pequena' ? '11.5px' : '12.5px'};
    }

    .alt-letter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid #94a3b8;
      font-weight: 600;
      margin-right: 8px;
      flex-shrink: 0;
      font-size: 11px;
    }

    .alt-row.is-correct .alt-letter {
      background: #dcfce7;
      border-color: #16a34a;
      color: #166534;
      font-weight: 700;
    }

    .alt-row.is-user-wrong .alt-letter {
      background: #fee2e2;
      border-color: #dc2626;
      color: #991b1b;
      text-decoration: line-through;
    }

    .alt-text {
      flex: 1;
      padding-top: 1px;
    }

    .scratchpad-lines {
      margin-top: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 18px,
        #f1f5f9 18px,
        #f1f5f9 19px
      );
      height: 58px;
    }

    .scratchpad-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      font-weight: 600;
    }

    .commentary-box {
      margin-top: 10px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 11.5px;
      break-inside: avoid;
    }

    .commentary-header {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }

    .error-analysis {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
      color: #b91c1c;
      font-size: 11px;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .answer-key-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 2px solid #0f172a;
      break-inside: avoid;
    }

    .answer-key-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }

    .key-cell {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: center;
      border-radius: 4px;
      background: #f8fafc;
    }

    .key-q {
      font-size: 10px;
      color: #64748b;
      display: block;
    }

    .key-ans {
      font-size: 15px;
      font-weight: 700;
      color: #0284c7;
    }

    .no-print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: white;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
    }

    .print-btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }

    .print-btn:hover {
      background: #0369a1;
    }

    @media print {
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Visualização de Impressão (PDF)</strong> - ${questions.length} questões selecionadas
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button>
      <button class="print-btn" style="background: #475569;" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div style="padding: 16px;">
    <div class="header">
      <div class="header-main">
        <h1>${escapeHtml(options.title || 'Caderno de Questões')}</h1>
        <p>${escapeHtml(options.subtitle || 'Material de Estudo & Revisão de Erros')} · Gerado em ${currentDate}</p>
      </div>
      <div class="header-meta">
        ${options.studentName ? `<div class="student-badge">Estudante: ${escapeHtml(options.studentName)}</div><br/>` : ''}
        <span>Total: <strong>${questions.length}</strong> questão(ões)</span>
      </div>
    </div>

    <div class="questions-container">
      ${questions
        .map((q, index) => {
          const areaInfo = AREA_CONFIG[q.area] || { shortLabel: q.area };
          const diffInfo = DIFFICULTY_CONFIG[q.difficulty] || { label: q.difficulty };
          const showAnswerInline = options.layoutMode === 'completo' || options.layoutMode === 'caderno_erros';
          const errorInfo = q.errorCause ? ERROR_CAUSE_CONFIG[q.errorCause] : null;

          return `
          <div class="question-item">
            <div class="question-header">
              <span class="question-number">Questão ${index + 1} ${q.code ? `<span style="font-weight: normal; color: #64748b; font-size: 11px;">(${escapeHtml(q.code)})</span>` : ''}</span>
              <span class="question-tags">
                ${escapeHtml(areaInfo.shortLabel)} · ${escapeHtml(q.subject)} · ${diffInfo.label}
              </span>
            </div>

            <div class="question-statement">${escapeHtml(q.statement)}</div>

            ${
              options.includeImages && q.imageUrl
                ? `
                <div class="question-figure">
                  <img src="${q.imageUrl}" alt="Figura de apoio" />
                  ${q.imageCaption ? `<div class="figure-caption">${escapeHtml(q.imageCaption)}</div>` : ''}
                </div>
              `
                : ''
            }

            <ul class="alternatives-list">
              ${q.alternatives
                .map((alt) => {
                  const isCorrect = showAnswerInline && alt.id === q.correctAlternative;
                  const isUserWrong =
                    showAnswerInline &&
                    q.userSelectedAlternative &&
                    alt.id === q.userSelectedAlternative &&
                    q.userSelectedAlternative !== q.correctAlternative;

                  let rowClass = 'alt-row';
                  if (isCorrect) rowClass += ' is-correct';
                  if (isUserWrong) rowClass += ' is-user-wrong';

                  return `
                  <li class="${rowClass}">
                    <span class="alt-letter">${alt.id}</span>
                    <span class="alt-text">${escapeHtml(alt.text)}</span>
                  </li>
                `;
                })
                .join('')}
            </ul>

            ${
              options.includeNotesSpace
                ? `
              <div class="scratchpad-lines">
                <span class="scratchpad-label">Espaço para Resolução / Rascunho</span>
              </div>
            `
                : ''
            }

            ${
              showAnswerInline && options.includeComments && (q.comment || q.tips || errorInfo)
                ? `
              <div class="commentary-box">
                <div class="commentary-header">
                  <span>Gabarito Oficial: <strong>${q.correctAlternative}</strong></span>
                  ${q.userSelectedAlternative && q.userSelectedAlternative !== q.correctAlternative ? `<span style="color: #dc2626;">Marquei errado: <strong>${q.userSelectedAlternative}</strong></span>` : ''}
                </div>

                ${
                  options.includeErrorDiagnosis && errorInfo
                    ? `
                  <div class="error-analysis">
                    <strong>Diagnóstico do Erro:</strong> ${escapeHtml(errorInfo.label)}
                    ${q.tips ? `<br/><em>Dica de fixação: ${escapeHtml(q.tips)}</em>` : ''}
                  </div>
                `
                    : ''
                }

                ${
                  q.comment
                    ? `
                  <div style="margin-top: 6px; white-space: pre-line; color: #334155;">
                    ${escapeHtml(q.comment)}
                  </div>
                `
                    : ''
                }
              </div>
            `
                : ''
            }
          </div>
        `;
        })
        .join('')}
    </div>

    ${
      options.includeAnswerKeyAtEnd
        ? `
      <div class="page-break"></div>
      <div class="answer-key-section">
        <h2 style="font-size: 16px; margin: 0 0 4px 0; color: #0f172a;">Gabarito das Questões</h2>
        <p style="font-size: 11px; color: #64748b; margin: 0 0 16px 0;">Folha de conferência de respostas rápidas.</p>
        <div class="answer-key-grid">
          ${questions
            .map(
              (q, idx) => `
            <div class="key-cell">
              <span class="key-q">Q.${idx + 1}</span>
              <span class="key-ans">${q.correctAlternative}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }
  </div>

  <script>
    // Prompt print after font loading
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
