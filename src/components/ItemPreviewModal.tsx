import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Download,
  Edit3,
  Eye,
  Save,
  PenTool,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  ExternalLink,
  Grid,
  Palette,
  FileSearch,
  Upload,
  Link as LinkIcon,
  Pencil,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes, getBlob, saveBlob, triggerFileDownload, downloadTextAsFile } from '../lib/storage';
import { renderMarkdown } from '../lib/markdown';
import { detectClientOS, ClientOSInfo } from '../lib/osDetector';
import { parseXoppDocument, decompressXoppBlob, XoppParsedDocument } from '../lib/xournalParser';
import { renderAllPdfPagesToDataUrls } from '../lib/pdfRenderer';
import { PdfViewer } from './PdfViewer';
import { MarkdownEditor } from './MarkdownEditor';

interface ItemPreviewModalProps {
  item: FileItem | null;
  allItems?: FileItem[];
  initialMode?: 'preview' | 'edit';
  onClose: () => void;
  onUpdateItemContent: (itemId: string, newContent: string) => void;
  onUpdateItemMetadata?: (itemId: string, metadata: any) => void;
  onDeleteItem?: (item: FileItem) => void;
  onRenameItem?: (item: FileItem) => void;
  onOpenXournal?: (item: FileItem, onStatus: (status: string) => void) => Promise<void>;
}

export const ItemPreviewModal: React.FC<ItemPreviewModalProps> = ({
  item,
  allItems = [],
  initialMode = 'preview',
  onClose,
  onUpdateItemContent,
  onUpdateItemMetadata,
  onDeleteItem,
  onRenameItem,
  onOpenXournal,
}) => {
  if (!item) return null;

  // OS detection
  const [osInfo, setOsInfo] = useState<ClientOSInfo>(() => detectClientOS());

  // Views & Content
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>(initialMode);
  const [content, setContent] = useState<string>(item.content || '');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [rawXml, setRawXml] = useState<string | null>(null);
  const [hasSavedNotice, setHasSavedNotice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOpeningXournal, setIsOpeningXournal] = useState(false);
  const [xournalBridgeStatus, setXournalBridgeStatus] = useState('');

  // Xournal++ Paper Background Customization
  const [paperPattern, setPaperPattern] = useState<'dotted' | 'lined' | 'graph' | 'plain' | 'pdf'>('pdf');
  const [paperColor, setPaperColor] = useState<string>('#ffffff');

  // PDF Background Control: TRUE by default as explicitly requested ("Não chat, tem que exibir o fundo do pdf")
  const [showPdfBackground, setShowPdfBackground] = useState<boolean>(true);
  const [pdfPagesMap, setPdfPagesMap] = useState<Map<number, string>>(new Map());
  const [isRenderingPdfBg, setIsRenderingPdfBg] = useState<boolean>(false);
  const [linkedPdfName, setLinkedPdfName] = useState<string | null>(item.metadata?.author || null);
  const [isPdfSelectOpen, setIsPdfSelectOpen] = useState<boolean>(false);

  // Xournal++ Multi-page document state
  const [xoppDoc, setXoppDoc] = useState<XoppParsedDocument | null>(null);
  const [currentXoppPage, setCurrentXoppPage] = useState<number>(1);
  const [xoppViewMode, setXoppViewMode] = useState<'single' | 'continuous'>('single');
  const [isParsingXopp, setIsParsingXopp] = useState<boolean>(false);
  const [xoppZoom, setXoppZoom] = useState<number>(100);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isXopp = item.extension === 'xopp' || item.extension === 'xoj';
  const isPdf = item.extension === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(item.extension || '');
  const isMdNote = item.extension === 'md' || (item.type === 'note' && !isXopp);

  // Available PDF files in workspace that can be linked as background
  const workspacePdfFiles = useMemo(() => {
    return allItems.filter((i) => i.extension === 'pdf' && !i.trashed);
  }, [allItems]);

  // Initial load effect
  useEffect(() => {
    setContent(item.content || '');
    setActiveTab(initialMode || (item.type === 'note' && !item.content && item.extension === 'md' ? 'edit' : 'preview'));
    setOsInfo(detectClientOS());
    setCurrentXoppPage(1);

    let url: string | null = null;

    if (item.blobKey) {
      getBlob(item.blobKey).then(async (loadedBlob) => {
        if (loadedBlob) {
          setBlob(loadedBlob);
          url = URL.createObjectURL(loadedBlob);
          setBlobUrl(url);

          if (isXopp) {
            setIsParsingXopp(true);
            const xml = await decompressXoppBlob(loadedBlob);
            setRawXml(xml);

            // Attempt to resolve background PDF
            const resolvedPages = await autoResolvePdfBackground(xml, item);

            const paper = item.description || item.metadata?.paperFormat || 'A5 · Amarelo claro · Pontilhado';
            const parsed = parseXoppDocument(
              xml,
              item.name,
              paper,
              paperPattern,
              paperColor,
              resolvedPages || pdfPagesMap,
              showPdfBackground
            );
            setXoppDoc(parsed);
            setIsParsingXopp(false);
          }
        }
      });
    } else if (isXopp) {
      setIsParsingXopp(true);
      const paper = item.description || item.metadata?.paperFormat || 'A5 · Amarelo claro · Pontilhado';
      const parsed = parseXoppDocument(
        item.content || null,
        item.name,
        paper,
        paperPattern,
        paperColor,
        pdfPagesMap,
        showPdfBackground
      );
      setXoppDoc(parsed);
      setIsParsingXopp(false);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
      setBlobUrl(null);
      setBlob(null);
    };
  }, [item, isXopp]);

  // Auto-resolve PDF background from workspace items
  async function autoResolvePdfBackground(xml: string | null, currentItem: FileItem): Promise<Map<number, string> | null> {
    try {
      // 1. Check if item has an explicitly linked background PDF blobKey in metadata
      if (currentItem.metadata?.pdfBlobKey) {
        setIsRenderingPdfBg(true);
        const linkedBlob = await getBlob(currentItem.metadata.pdfBlobKey);
        if (linkedBlob) {
          const pages = await renderAllPdfPagesToDataUrls(linkedBlob, 50);
          setPdfPagesMap(pages);
          if (currentItem.metadata?.author) {
            setLinkedPdfName(currentItem.metadata.author);
          }
          setIsRenderingPdfBg(false);
          return pages;
        }
        setIsRenderingPdfBg(false);
      }

      // 2. Check XML for <background type="pdf" filename="..." />
      if (!xml) return null;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const bg = doc.querySelector('background[type="pdf"]');
      if (bg) {
        const bgFilename = bg.getAttribute('filename');
        const cleanName = bgFilename ? bgFilename.split(/[/\\]/).pop()?.toLowerCase() : null;

        // Find in workspace PDF files
        const matchedItem = workspacePdfFiles.find((f) => {
          const fn = f.name.toLowerCase();
          return cleanName ? fn === cleanName || fn.includes(cleanName.replace('.pdf', '')) : false;
        }) || workspacePdfFiles.find((f) => f.parentId === currentItem.parentId);

        if (matchedItem && matchedItem.blobKey) {
          setIsRenderingPdfBg(true);
          const pdfBlob = await getBlob(matchedItem.blobKey);
          if (pdfBlob) {
            const pages = await renderAllPdfPagesToDataUrls(pdfBlob, 50);
            setPdfPagesMap(pages);
            setLinkedPdfName(matchedItem.name);
            setIsRenderingPdfBg(false);
            return pages;
          }
          setIsRenderingPdfBg(false);
        }
      }
    } catch (e) {
      console.warn('Could not auto-resolve background PDF:', e);
      setIsRenderingPdfBg(false);
    }
    return null;
  }

  // Handle user uploading or selecting an external background PDF
  const handleLinkWorkspacePdf = async (pdfItem: FileItem) => {
    if (!pdfItem.blobKey) return;
    try {
      setIsRenderingPdfBg(true);
      const pdfBlob = await getBlob(pdfItem.blobKey);
      if (pdfBlob) {
        const pages = await renderAllPdfPagesToDataUrls(pdfBlob, 50);
        setPdfPagesMap(pages);
        setLinkedPdfName(pdfItem.name);
        setShowPdfBackground(true);
        setIsPdfSelectOpen(false);

        // Update parsed doc with new background
        const paper = item.description || item.metadata?.paperFormat || 'A5 · Amarelo claro · Pontilhado';
        const parsed = parseXoppDocument(
          rawXml || item.content || null,
          item.name,
          paper,
          'pdf',
          '#ffffff',
          pages,
          true
        );
        setXoppDoc(parsed);
      }
    } catch (err) {
      console.error('Failed to link workspace PDF:', err);
    } finally {
      setIsRenderingPdfBg(false);
    }
  };

  const handleUploadBackgroundPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRenderingPdfBg(true);
      const pages = await renderAllPdfPagesToDataUrls(file, 50);
      setPdfPagesMap(pages);
      setLinkedPdfName(file.name);
      setShowPdfBackground(true);
      setIsPdfSelectOpen(false);

      // Save blob for persistence
      const bgBlobKey = `pdf_bg_${item.id}_${Date.now()}`;
      await saveBlob(bgBlobKey, file);
      if (onUpdateItemMetadata) {
        onUpdateItemMetadata(item.id, {
          ...(item.metadata || {}),
          pdfBlobKey: bgBlobKey,
          author: file.name,
        });
      }

      // Re-parse with background
      const paper = item.description || item.metadata?.paperFormat || 'A5 · Amarelo claro · Pontilhado';
      const parsed = parseXoppDocument(
        rawXml || item.content || null,
        item.name,
        paper,
        'pdf',
        '#ffffff',
        pages,
        true
      );
      setXoppDoc(parsed);
    } catch (err) {
      console.error('Failed to process uploaded background PDF:', err);
    } finally {
      setIsRenderingPdfBg(false);
    }
  };

  // Re-parse when paper pattern, color, or PDF background toggle is changed
  useEffect(() => {
    if (!isXopp) return;
    const paper = item.description || item.metadata?.paperFormat || 'A5 · Amarelo claro · Pontilhado';
    const parsed = parseXoppDocument(
      rawXml || item.content || null,
      item.name,
      paper,
      paperPattern,
      paperColor,
      pdfPagesMap,
      showPdfBackground
    );
    setXoppDoc(parsed);
  }, [paperPattern, paperColor, rawXml, item.name, item.description, item.metadata, item.content, isXopp, pdfPagesMap, showPdfBackground]);

  const handleSaveNote = () => {
    onUpdateItemContent(item.id, content);
    setHasSavedNotice(true);
    setTimeout(() => setHasSavedNotice(false), 2000);
  };

  const handleDownload = async () => {
    if (item.extension === 'md') {
      const filename = item.name.endsWith('.md') ? item.name : `${item.name}.md`;
      downloadTextAsFile(content, filename, 'text/markdown');
      return;
    }

    if (item.blobKey) {
      const loadedBlob = await getBlob(item.blobKey);
      if (loadedBlob) {
        triggerFileDownload(loadedBlob, item.name);
        return;
      }
    }

    // Fallback if simulated file
    const sampleBlob = new Blob([item.content || `Nexus Workspace - ${item.name}`], {
      type: item.mimeType || 'application/octet-stream',
    });
    triggerFileDownload(sampleBlob, item.name);
  };

  const handleExportCurrentSvg = () => {
    if (!xoppDoc || xoppDoc.pages.length === 0) return;
    const pageToExport = xoppDoc.pages[currentXoppPage - 1] || xoppDoc.pages[0];
    const svgBlob = new Blob([pageToExport.svgString], { type: 'image/svg+xml' });
    triggerFileDownload(
      svgBlob,
      `${item.name.replace(/\.xopp$/i, '')}_pag_${pageToExport.pageNumber}.svg`
    );
  };

  // Generate URL to extend into a new tab (complete with PDF background or full doc)
  const newTabUrl = useMemo(() => {
    if (isPdf) {
      return blobUrl;
    }

    if (isXopp && xoppDoc && xoppDoc.pages.length > 0) {
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${item.name} - Nexus Workspace</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 16px;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
    }
    .header {
      width: 100%;
      max-width: 960px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
    }
    .title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      background: #2563eb;
      color: white;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-weight: 600;
    }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background 0.15s;
    }
    .btn:hover { background: #1d4ed8; }
    .page-wrap {
      width: 100%;
      max-width: 960px;
      margin-bottom: 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      overflow: hidden;
      background-color: white;
      border: 1px solid #334155;
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
    }
    @media print {
      body { background: white; padding: 0; }
      .header { display: none; }
      .page-wrap { box-shadow: none; border: none; margin-bottom: 0; page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      <span>📓 ${item.name} (${xoppDoc.totalPages} pág.)</span>
      ${showPdfBackground ? '<span class="badge">Fundo PDF Ativo</span>' : ''}
    </div>
    <button class="btn" onclick="window.print()">Imprimir / Salvar em PDF</button>
  </div>
  ${xoppDoc.pages.map((p) => `<div class="page-wrap">${p.svgString}</div>`).join('\n')}
</body>
</html>`;
      const docBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(docBlob);
    }

    if (isMdNote) {
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${item.name} - Nexus Workspace</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 800px;
      width: 100%;
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
      line-height: 1.7;
    }
    pre { background: #0f172a; color: white; padding: 16px; border-radius: 8px; overflow-x: auto; }
    code { font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${item.name}</h1>
    ${renderMarkdown(content)}
  </div>
</body>
</html>`;
      const docBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(docBlob);
    }

    if (isImage) {
      return blobUrl;
    }

    return null;
  }, [isPdf, isXopp, isMdNote, isImage, blobUrl, xoppDoc, item.name, content, showPdfBackground]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-xs ${isFullscreen ? 'p-0' : ''}`}>
      <div
        className={`bg-white border border-neutral-200 flex flex-col shadow-2xl overflow-hidden transition-all duration-150 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none border-none'
            : 'w-full max-w-6xl h-[94vh] rounded-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between gap-4 bg-neutral-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {isXopp ? (
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <PenTool className="w-4 h-4" />
              </div>
            ) : isPdf ? (
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-900 truncate" title={item.name}>
                {item.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                <span className="font-semibold text-neutral-700">
                  {item.extension ? `.${item.extension.toUpperCase()}` : item.type}
                </span>
                <span>·</span>
                <span>{formatBytes(item.size)}</span>
                {showPdfBackground && isXopp && (
                  <>
                    <span>·</span>
                    <span className="text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded">
                      Fundo PDF Ativo
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons & View toggles */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Markdown Read / Edit mode toggle */}
            {isMdNote && (
              <div className="flex items-center p-0.5 bg-neutral-200/70 rounded-lg text-xs mr-1">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-white text-neutral-900 font-medium shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Leitura</span>
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === 'edit'
                      ? 'bg-white text-neutral-900 font-medium shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </div>
            )}

            {isMdNote && activeTab === 'edit' && (
              <button
                onClick={handleSaveNote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                {hasSavedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Salvo!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar</span>
                  </>
                )}
              </button>
            )}

            {/* Xournal++ Actions: Export SVG & Windows App open */}
            {isXopp && (
              <>
                <button
                  onClick={handleExportCurrentSvg}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
                  title="Exportar página atual como imagem SVG vetorial nítida com fundo"
                >
                  <FileDown className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Exportar SVG</span>
                </button>

                <button
                  onClick={async () => {
                    if (isOpeningXournal) return;
                    if (!osInfo.isWindows) {
                      setXournalBridgeStatus('A ponte do Xournal++ só pode ser executada no Windows.');
                      return;
                    }
                    if (!item.driveFileId) {
                      setXournalBridgeStatus('Clique em “Sincronize com Drive” antes de abrir esta nota.');
                      return;
                    }
                    if (!onOpenXournal) {
                      setXournalBridgeStatus('A integração da bridge não está disponível nesta tela.');
                      return;
                    }
                    setIsOpeningXournal(true);
                    setXournalBridgeStatus('Conectando à bridge Windows…');
                    try {
                      await onOpenXournal(item, setXournalBridgeStatus);
                    } catch (error) {
                      setXournalBridgeStatus(error instanceof Error ? error.message : 'Falha ao abrir a nota no Xournal++.');
                    } finally {
                      setIsOpeningXournal(false);
                    }
                  }}
                  disabled={isOpeningXournal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title={!osInfo.isWindows ? 'Disponível somente no Windows' : item.driveFileId ? 'Abrir o arquivo sincronizado pela bridge Windows' : 'Sincronize primeiro com o Google Drive'}
                >
                  {isOpeningXournal ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <PenTool className="w-3.5 h-3.5" />}
                  <span>{isOpeningXournal ? 'Aguardando Xournal++' : 'Abrir no Xournal++'}</span>
                </button>
                {xournalBridgeStatus && <span className="max-w-[210px] truncate text-[10px] text-neutral-500" title={xournalBridgeStatus}>{xournalBridgeStatus}</span>}
              </>
            )}

            {/* BOTÃO PARA ESTENDER EM UMA NOVA GUIA (como no PDF, com o fundo completo visível) */}
            {newTabUrl && (
              <a
                href={newTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Estender / Abrir em uma nova guia do navegador com o fundo completo"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Nova Guia</span>
              </a>
            )}

            {!isXopp && !isPdf && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
                title="Baixar arquivo para o computador"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Baixar</span>
              </button>
            )}

            {/* Rename Button in Modal */}
            {onRenameItem && (
              <button
                type="button"
                onClick={() => onRenameItem(item)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                title="Renomear item"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {/* Delete Button in Modal */}
            {onDeleteItem && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteItem(item);
                }}
                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Excluir arquivo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Specialized Toolbar for Xournal++ Note Navigation & PDF Background Controls */}
        {isXopp && xoppDoc && (
          <div className="px-5 py-2 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
            {/* Left: Multi-page navigation (Prev / Next / Page Counter) */}
            <div className="flex items-center gap-2">
              {xoppDoc.totalPages > 1 && (
                <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg px-2 py-0.5 shadow-2xs">
                  <button
                    onClick={() => setCurrentXoppPage((p) => Math.max(1, p - 1))}
                    disabled={currentXoppPage <= 1}
                    className="p-0.5 hover:bg-neutral-100 disabled:opacity-30 rounded cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] px-1 text-neutral-800 font-medium">
                    Pág. {currentXoppPage} / {xoppDoc.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentXoppPage((p) => Math.min(xoppDoc.totalPages, p + 1))}
                    disabled={currentXoppPage >= xoppDoc.totalPages}
                    className="p-0.5 hover:bg-neutral-100 disabled:opacity-30 rounded cursor-pointer"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* View Layout Switcher (Single Page vs Continuous Notebook) */}
              {xoppDoc.totalPages > 1 && (
                <div className="flex items-center gap-0.5 bg-neutral-200/70 p-0.5 rounded-lg text-[11px]">
                  <button
                    onClick={() => setXoppViewMode('single')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      xoppViewMode === 'single'
                        ? 'bg-white font-medium text-neutral-900 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Página Única
                  </button>
                  <button
                    onClick={() => setXoppViewMode('continuous')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      xoppViewMode === 'continuous'
                        ? 'bg-white font-medium text-neutral-900 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Rolar Todas
                  </button>
                </div>
              )}
            </div>

            {/* Center: CONTROLE DE FUNDO DO PDF (Atende explicitamente à solicitação: "tem que exibir o fundo do pdf") */}
            <div className="flex items-center gap-2">
              {/* Botão de Exibir/Ocultar Fundo PDF */}
              <button
                onClick={() => {
                  setShowPdfBackground(!showPdfBackground);
                  if (!showPdfBackground) {
                    setPaperPattern('pdf');
                    setPaperColor('#ffffff');
                  } else {
                    setPaperPattern('dotted');
                    setPaperColor('#fffdf3');
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer shadow-2xs transition-colors ${
                  showPdfBackground
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                }`}
                title="Exibir o fundo do PDF original da anotação"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showPdfBackground ? 'Fundo PDF: Exibindo' : 'Fundo PDF: Oculto'}</span>
              </button>

              {/* Vincular PDF externo se necessário */}
              <div className="relative">
                <button
                  onClick={() => setIsPdfSelectOpen(!isPdfSelectOpen)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg shadow-2xs cursor-pointer"
                  title="Vincular ou alterar o arquivo PDF de fundo desta anotação"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="hidden md:inline">
                    {linkedPdfName ? `PDF: ${linkedPdfName.substring(0, 16)}...` : 'Vincular PDF'}
                  </span>
                </button>

                {isPdfSelectOpen && (
                  <div className="absolute top-full mt-1.5 right-0 w-72 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 z-30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900">Selecionar PDF de Fundo</span>
                      <button
                        onClick={() => setIsPdfSelectOpen(false)}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {workspacePdfFiles.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                          Arquivos PDF no Espaço:
                        </span>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {workspacePdfFiles.map((pdf) => (
                            <button
                              key={pdf.id}
                              onClick={() => handleLinkWorkspacePdf(pdf)}
                              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-blue-50 hover:text-blue-700 truncate flex items-center gap-1.5 cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate">{pdf.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-1 border-t border-neutral-100">
                      <label className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar PDF do Computador</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleUploadBackgroundPdf}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Alternativa: Estilo de Papel Caderno se o usuário quiser desligar o PDF */}
              {!showPdfBackground && (
                <div className="flex items-center gap-1 bg-white border border-neutral-200 px-2 py-0.5 rounded-lg shadow-2xs text-[11px]">
                  <Grid className="w-3.5 h-3.5 text-neutral-400 mr-0.5" />
                  <button
                    onClick={() => setPaperPattern('dotted')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      paperPattern === 'dotted' ? 'bg-neutral-900 text-white font-medium' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    Pontilhado
                  </button>
                  <button
                    onClick={() => setPaperPattern('lined')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      paperPattern === 'lined' ? 'bg-neutral-900 text-white font-medium' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    Pautado
                  </button>
                </div>
              )}
            </div>

            {/* Right: Sharp Zoom Controls */}
            <div className="flex items-center gap-1 text-neutral-600 bg-white border border-neutral-200 px-2 py-0.5 rounded-lg shadow-2xs">
              <button
                onClick={() => setXoppZoom((prev) => Math.max(50, prev - 15))}
                className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 min-w-[42px] text-center font-medium text-neutral-800">
                {xoppZoom}%
              </span>
              <button
                onClick={() => setXoppZoom((prev) => Math.min(250, prev + 15))}
                className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setXoppZoom(100)}
                className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer ml-0.5"
                title="Redefinir para 100%"
              >
                100%
              </button>
              <button
                onClick={() => setXoppZoom(130)}
                className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                title="Ajustar à largura confortável"
              >
                Ajustar
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-neutral-100/70">
          {/* 1. PDF HIGH-FIDELITY VIEWER WITH HIGHLIGHTERS, COMMENTS AND ANNOTATIONS */}
          {isPdf && (
            <PdfViewer
              blob={blob}
              blobUrl={blobUrl}
              fileName={item.name}
              itemId={item.id}
              initialAnnotations={item.metadata?.pdfAnnotations}
              onSaveAnnotations={(annotations) => {
                if (onUpdateItemMetadata) {
                  onUpdateItemMetadata(item.id, {
                    ...(item.metadata || {}),
                    pdfAnnotations: annotations,
                  });
                }
              }}
              onDownload={handleDownload}
            />
          )}

          {/* 2. XOURNAL++ SHARP MULTI-PAGE NOTE RENDERER WITH GUARANTEED VISIBLE PDF BACKGROUND */}
          {isXopp && (
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center">
              {isParsingXopp || isRenderingPdfBg ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-neutral-600 font-medium">
                    {isRenderingPdfBg
                      ? 'Processando e renderizando o fundo do PDF em alta resolução...'
                      : 'Renderizando páginas vetoriais em alta fidelidade...'}
                  </p>
                </div>
              ) : xoppDoc && xoppDoc.pages.length > 0 ? (
                <div
                  className="flex flex-col items-center transition-transform duration-100 ease-out"
                  style={{
                    transform: `scale(${xoppZoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                >
                  {xoppViewMode === 'continuous' ? (
                    // Continuous Multi-Page Notebook Scroll Mode (neatly separated with shadows)
                    <div className="space-y-8 max-w-4xl w-full">
                      {xoppDoc.pages.map((p) => (
                        <div key={p.pageNumber} className="relative group">
                          <div className="absolute -top-3 left-3 bg-neutral-800 text-white text-[10px] font-mono px-2 py-0.5 rounded-full shadow-sm z-10 flex items-center gap-1.5">
                            <span>Página {p.pageNumber}</span>
                            {showPdfBackground && (
                              <span className="text-blue-300">· Fundo PDF</span>
                            )}
                          </div>
                          <div
                            className="rounded-lg shadow-xl border border-neutral-300 overflow-hidden relative bg-white"
                            dangerouslySetInnerHTML={{ __html: p.svgString }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Single Page Focused Reading Mode with guaranteed visible PDF background
                    <div className="max-w-3xl w-full">
                      <div
                        className="rounded-lg shadow-xl border border-neutral-300 overflow-hidden relative bg-white"
                        dangerouslySetInnerHTML={{
                          __html: (xoppDoc.pages[currentXoppPage - 1] || xoppDoc.pages[0]).svgString,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-neutral-200 space-y-3 max-w-md m-auto shadow-sm">
                  <PenTool className="w-10 h-10 text-blue-600 mx-auto" />
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {item.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Anotação Xournal++ pronta para visualização.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Arquivo .xopp</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. MARKDOWN NOTE VIEWER / EDITOR COM BIBLIOTECA DEDICADA */}
          {isMdNote && (
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
              <div className="max-w-4xl w-full">
                {activeTab === 'preview' ? (
                  <div className="bg-white rounded-xl shadow-xs border border-neutral-200 p-6 sm:p-10">
                    <div
                      className="prose prose-neutral max-w-none text-neutral-800 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(content || '_Nenhuma anotação inserida._'),
                      }}
                    />
                  </div>
                ) : (
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    onSave={handleSaveNote}
                    hasSavedNotice={hasSavedNotice}
                    height={isFullscreen ? 750 : 560}
                  />
                )}
              </div>
            </div>
          )}

          {/* 4. IMAGES AND OTHER MEDIA */}
          {isImage && blobUrl && (
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
              <img
                src={blobUrl}
                alt={item.name}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md border border-neutral-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
