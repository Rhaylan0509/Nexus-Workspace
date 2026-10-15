/**
 * Safe, lightweight markdown renderer for notes
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  let html = content
    // Escape standard HTML chars
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```language ... ```)
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    return `<pre class="my-3 p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed"><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-neutral-100 text-neutral-800 rounded text-xs font-mono border border-neutral-200">$1</code>');

  // Headers (#, ##, ###, ####)
  html = html.replace(/^#### (.*$)/gim, '<h4 class="text-sm font-semibold text-neutral-900 mt-4 mb-1">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-neutral-900 mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-neutral-900 mt-6 mb-2 border-b border-neutral-200 pb-1">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-neutral-900 mt-4 mb-3 pb-2 border-b border-neutral-200">$1</h1>');

  // Blockquotes (> ...)
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="my-2 pl-3 py-1 border-l-2 border-neutral-300 text-neutral-600 text-sm italic">$1</blockquote>');

  // Checkboxes
  html = html.replace(/^- \[x\] (.*$)/gim, '<li class="flex items-center gap-2 text-sm text-neutral-500 line-through my-1"><span class="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center text-xs">✓</span> $1</li>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<li class="flex items-center gap-2 text-sm text-neutral-700 my-1"><span class="w-4 h-4 rounded border border-neutral-400 inline-block"></span> $1</li>');

  // Unordered list items (- or *)
  html = html.replace(/^[\*\-] (.*$)/gim, '<li class="text-sm text-neutral-700 my-1 ml-4 list-disc">$1</li>');

  // Ordered list items (1. ...)
  html = html.replace(/^\d+\. (.*$)/gim, '<li class="text-sm text-neutral-700 my-1 ml-4 list-decimal">$1</li>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-neutral-900">$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong class="font-semibold text-neutral-900">$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-neutral-800">$1</em>');
  html = html.replace(/_(.*?)_/g, '<em class="italic text-neutral-800">$1</em>');

  // Line breaks to paragraphs
  const paragraphs = html
    .split(/\n\n+/)
    .map((block) => {
      if (
        block.startsWith('<h') ||
        block.startsWith('<pre') ||
        block.startsWith('<blockquote') ||
        block.startsWith('<li')
      ) {
        return block;
      }
      return `<p class="my-2 text-sm text-neutral-700 leading-relaxed">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return paragraphs;
}
