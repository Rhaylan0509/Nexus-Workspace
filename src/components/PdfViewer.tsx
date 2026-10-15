import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  FileText,
  RefreshCw,
  Highlighter,
  PenTool,
  MessageSquare,
  Type,
  Eraser,
  Undo2,
  Trash2,
  Printer,
  Check,
  X,
  MessageCircle,
  LayoutGrid,
  CheckCircle2,
  Search,
  Edit2,
  Plus,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  PdfAnnotationsData,
  PdfHighlight,
  PdfComment,
  PdfDrawingStroke,
  PdfDrawingPoint,
  PdfTextAnnotation,
} from '../types';

// Configure worker using Vite asset or CDN fallback
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '6.4.299'}/pdf.worker.min.mjs`;
  }
}

export type PdfActiveTool =
  | 'select'
  | 'highlight-rect'
  | 'highlight-free'
  | 'pen'
  | 'comment'
  | 'text'
  | 'eraser';

export interface HighlighterColorOption {
  id: string;
  name: string;
  bgHex: string;
  borderHex: string;
}

export const HIGHLIGHTER_COLORS: HighlighterColorOption[] = [
  { id: 'yellow', name: 'Amarelo', bgHex: '#facc15', borderHex: '#eab308' },
  { id: 'green', name: 'Verde', bgHex: '#4ade80', borderHex: '#22c55e' },
  { id: 'pink', name: 'Rosa', bgHex: '#f472b6', borderHex: '#ec4899' },
  { id: 'blue', name: 'Azul', bgHex: '#38bdf8', borderHex: '#0284c7' },
  { id: 'orange', name: 'Laranja', bgHex: '#fb923c', borderHex: '#f97316' },
];

export const PEN_COLORS = [
  { id: 'black', hex: '#1e293b', name: 'Preto' },
  { id: 'blue', hex: '#2563eb', name: 'Azul' },
  { id: 'red', hex: '#dc2626', name: 'Vermelho' },
  { id: 'green', hex: '#16a34a', name: 'Verde' },
];

interface PdfViewerProps {
  blob: Blob | null;
  blobUrl: string | null;
  fileName: string;
  itemId?: string;
  initialAnnotations?: PdfAnnotationsData;
  onSaveAnnotations?: (annotations: PdfAnnotationsData) => void;
  onDownload: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  blob,
  blobUrl,
  fileName,
  itemId,
  initialAnnotations,
  onSaveAnnotations,
  onDownload,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [scale, setScale] = useState<number>(1.25);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'comments' | 'thumbnails'>('comments');
  const [commentSearch, setCommentSearch] = useState<string>('');

  // Dimensions of rendered page in CSS pixels
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Active Tool and Styling
  const [activeTool, setActiveTool] = useState<PdfActiveTool>('select');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(HIGHLIGHTER_COLORS[0].id);
  const [selectedPenColor, setSelectedPenColor] = useState<string>(PEN_COLORS[1].hex);
  const [penStrokeWidth, setPenStrokeWidth] = useState<number>(2.5);

  // Annotations State
  const [annotations, setAnnotations] = useState<PdfAnnotationsData>(() => {
    if (initialAnnotations) return initialAnnotations;
    if (itemId) {
      try {
        const cached = localStorage.getItem(`nexus_pdf_ann_${itemId}`);
        if (cached) return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return {
      highlights: [],
      comments: [],
      drawings: [],
      textNotes: [],
    };
  });

  const [hasSavedFeedback, setHasSavedFeedback] = useState<boolean>(false);

  // In-progress interactions
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState<PdfDrawingPoint[]>([]);

  // Popover state
  const [newCommentPos, setNewCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [newCommentAuthor, setNewCommentAuthor] = useState<string>('Revisor');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');

  // Text note state
  const [newTextPos, setNewTextPos] = useState<{ x: number; y: number } | null>(null);
  const [newTextValue, setNewTextValue] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);

  // Sync external initialAnnotations
  useEffect(() => {
    if (initialAnnotations) {
      setAnnotations(initialAnnotations);
    }
  }, [initialAnnotations]);

  // Persist annotations
  const saveAnnotationsToStateAndStorage = useCallback(
    (newAnnotations: PdfAnnotationsData) => {
      setAnnotations(newAnnotations);
      if (itemId) {
        try {
          localStorage.setItem(`nexus_pdf_ann_${itemId}`, JSON.stringify(newAnnotations));
        } catch (e) {
          // ignore
        }
      }
      if (onSaveAnnotations) {
        onSaveAnnotations(newAnnotations);
      }
      setHasSavedFeedback(true);
      setTimeout(() => setHasSavedFeedback(false), 2000);
    },
    [itemId, onSaveAnnotations]
  );

  // Load PDF document from blob or blobUrl
  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      if (blobUrl) {
        fetch(blobUrl)
          .then((r) => r.blob())
          .then((b) => loadPdf(b))
          .catch((err) => {
            if (!isCancelled) {
              setLoadError('Não foi possível carregar o arquivo PDF.');
              setIsLoading(false);
            }
          });
      } else {
        setIsLoading(false);
      }
      return;
    }

    loadPdf(blob);

    async function loadPdf(pdfBlob: Blob) {
      try {
        setIsLoading(true);
        setLoadError(null);
        const arrayBuffer = await pdfBlob.arrayBuffer();

        const version = pdfjsLib.version || '6.4.299';
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`,
          wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/wasm/`,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setIsLoading(false);
      } catch (err: any) {
        console.warn('PDF.js loading error:', err);
        if (!isCancelled) {
          setLoadError('Erro ao processar as páginas do PDF.');
          setIsLoading(false);
        }
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [blob, blobUrl]);

  // Render current page onto canvas with high-DPI
  useEffect(() => {
    if (!pdfDocRef.current || currentPage < 1) return;

    let isCancelled = false;

    async function renderPage() {
      try {
        // Safely cancel any active render task before starting a new one
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // ignore cancellation
          }
          renderTaskRef.current = null;
        }

        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        // High-DPI support: scale viewport directly so images and strokes render at full resolution
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        const actualViewport = page.getViewport({ scale: scale * pixelRatio, rotation });
        const cssViewport = page.getViewport({ scale, rotation });

        canvas.width = Math.floor(actualViewport.width);
        canvas.height = Math.floor(actualViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        setPageDimensions({
          width: Math.floor(cssViewport.width),
          height: Math.floor(cssViewport.height),
        });

        // Paint clean solid white background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: actualViewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        const isCancelledErr =
          err?.name === 'RenderingCancelledException' ||
          err?.message?.toLowerCase().includes('cancel');

        if (!isCancelledErr) {
          console.warn('Non-fatal render warning:', err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, scale, rotation]);

  // PDF.js text layer makes the rendered page selectable while keeping the
  // canvas as the visual source. Highlight rectangles are stored as page percentages.
  useEffect(() => {
    let cancelled = false;
    let textLayerTask: any = null;
    const container = textLayerRef.current;
    const doc = pdfDocRef.current;
    if (!container || !doc || !pageDimensions.width) return;
    container.replaceChildren();
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale, rotation });
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const TextLayer = (pdfjsLib as any).TextLayer;
        if (!TextLayer) return;
        textLayerTask = new TextLayer({ textContentSource: textContent, container, viewport });
        await textLayerTask.render();
      } catch (error) {
        if (!cancelled) console.warn('PDF text selection layer could not be rendered:', error);
      }
    })();
    return () => {
      cancelled = true;
      try { textLayerTask?.cancel?.(); } catch { /* ignore */ }
      container.replaceChildren();
    };
  }, [currentPage, scale, rotation, pageDimensions.width]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      setCurrentPage(nextP);
      setPageInput(String(nextP));
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const nextP = currentPage + 1;
      setCurrentPage(nextP);
      setPageInput(String(nextP));
    }
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setCurrentPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.25).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleFitWidth = () => setScale(1.35);

  // Mouse percentage coordinates relative to overlay
  const getOverlayPercentCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on popups, inputs, textareas, or buttons so text isn't erased
    const target = e.target as HTMLElement;
    if (
      target.closest('.no-canvas-click') ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON'
    ) {
      return;
    }

    if (activeTool === 'select') {
      if (selectedCommentId) setSelectedCommentId(null);
      if (newCommentPos) setNewCommentPos(null);
      return;
    }

    const coords = getOverlayPercentCoords(e);

    if (activeTool === 'highlight-rect') {
      setIsDrawing(true);
      setDragStartPoint(coords);
      setCurrentDragRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    } else if (activeTool === 'highlight-free' || activeTool === 'pen') {
      setIsDrawing(true);
      setCurrentDrawingPoints([coords]);
    } else if (activeTool === 'comment') {
      setNewCommentPos(coords);
      setNewCommentText('');
      setSelectedCommentId(null);
      setEditingCommentId(null);
    } else if (activeTool === 'text') {
      setNewTextPos(coords);
      setNewTextValue('');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getOverlayPercentCoords(e);

    if (activeTool === 'highlight-rect' && dragStartPoint) {
      const minX = Math.min(dragStartPoint.x, coords.x);
      const minY = Math.min(dragStartPoint.y, coords.y);
      const width = Math.abs(coords.x - dragStartPoint.x);
      const height = Math.abs(coords.y - dragStartPoint.y);
      setCurrentDragRect({ x: minX, y: minY, width, height });
    } else if ((activeTool === 'highlight-free' || activeTool === 'pen') && currentDrawingPoints.length > 0) {
      setCurrentDrawingPoints((prev) => [...prev, coords]);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'select') {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      const overlay = overlayRef.current;
      if (selectedText && selection && overlay) {
        const bounds = overlay.getBoundingClientRect();
        const highlights = Array.from(selection.getRangeAt(0).getClientRects())
          .filter((rect) => rect.width > 1 && rect.height > 1)
          .map((rect): PdfHighlight => ({
            id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            pageNumber: currentPage,
            x: Math.max(0, ((rect.left - bounds.left) / bounds.width) * 100),
            y: Math.max(0, ((rect.top - bounds.top) / bounds.height) * 100),
            width: Math.min(100, (rect.width / bounds.width) * 100),
            height: Math.min(100, (rect.height / bounds.height) * 100),
            color: '#facc15',
            text: selectedText,
            createdAt: Date.now(),
          }));
        if (highlights.length) {
          saveAnnotationsToStateAndStorage({ ...annotations, highlights: [...annotations.highlights, ...highlights] });
        }
        selection.removeAllRanges();
      }
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'highlight-rect' && currentDragRect && (currentDragRect.width > 0.5 || currentDragRect.height > 0.5)) {
      const activeColor = HIGHLIGHTER_COLORS.find((c) => c.id === selectedHighlightColor) || HIGHLIGHTER_COLORS[0];
      const newHighlight: PdfHighlight = {
        id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: currentPage,
        x: currentDragRect.x,
        y: currentDragRect.y,
        width: currentDragRect.width,
        height: Math.max(currentDragRect.height, 1.2),
        color: activeColor.bgHex,
        createdAt: Date.now(),
      };
      saveAnnotationsToStateAndStorage({
        ...annotations,
        highlights: [...annotations.highlights, newHighlight],
      });
      setCurrentDragRect(null);
      setDragStartPoint(null);
    } else if ((activeTool === 'highlight-free' || activeTool === 'pen') && currentDrawingPoints.length > 1) {
      const isHighlighter = activeTool === 'highlight-free';
      const activeColor = isHighlighter
        ? (HIGHLIGHTER_COLORS.find((c) => c.id === selectedHighlightColor)?.bgHex || '#facc15')
        : selectedPenColor;

      const newStroke: PdfDrawingStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: currentPage,
        tool: isHighlighter ? 'highlighter' : 'pen',
        points: currentDrawingPoints,
        color: activeColor,
        width: isHighlighter ? 12 : penStrokeWidth,
        opacity: isHighlighter ? 0.45 : 0.95,
        createdAt: Date.now(),
      };

      saveAnnotationsToStateAndStorage({
        ...annotations,
        drawings: [...annotations.drawings, newStroke],
      });
      setCurrentDrawingPoints([]);
    }
  };

  const handleSaveNewComment = () => {
    if (!newCommentPos || !newCommentText.trim()) return;
    const newComment: PdfComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: currentPage,
      x: +newCommentPos.x.toFixed(2),
      y: +newCommentPos.y.toFixed(2),
      author: newCommentAuthor.trim() || 'Revisor',
      text: newCommentText.trim(),
      resolved: false,
      createdAt: Date.now(),
    };

    saveAnnotationsToStateAndStorage({
      ...annotations,
      comments: [...annotations.comments, newComment],
    });
    setNewCommentPos(null);
    setNewCommentText('');
    setActiveTool('select');
    setSelectedCommentId(newComment.id);
  };

  const handleUpdateCommentText = (id: string, newText: string) => {
    if (!newText.trim()) return;
    saveAnnotationsToStateAndStorage({
      ...annotations,
      comments: annotations.comments.map((c) =>
        c.id === id ? { ...c, text: newText.trim() } : c
      ),
    });
    setEditingCommentId(null);
  };

  const handleSaveNewText = () => {
    if (!newTextPos || !newTextValue.trim()) return;
    const newNote: PdfTextAnnotation = {
      id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: currentPage,
      x: newTextPos.x,
      y: newTextPos.y,
      text: newTextValue.trim(),
      fontSize: 14,
      color: selectedPenColor,
      backgroundColor: '#ffffff',
      createdAt: Date.now(),
    };

    saveAnnotationsToStateAndStorage({
      ...annotations,
      textNotes: [...annotations.textNotes, newNote],
    });
    setNewTextPos(null);
    setNewTextValue('');
  };

  const handleRemoveHighlight = (id: string, e: React.MouseEvent) => {
    if (activeTool !== 'eraser') return;
    e.stopPropagation();
    saveAnnotationsToStateAndStorage({
      ...annotations,
      highlights: annotations.highlights.filter((h) => h.id !== id),
    });
  };

  const handleRemoveComment = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    saveAnnotationsToStateAndStorage({
      ...annotations,
      comments: annotations.comments.filter((c) => c.id !== id),
    });
    if (selectedCommentId === id) setSelectedCommentId(null);
  };

  const handleToggleResolveComment = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    saveAnnotationsToStateAndStorage({
      ...annotations,
      comments: annotations.comments.map((c) =>
        c.id === id ? { ...c, resolved: !c.resolved } : c
      ),
    });
  };

  const handleRemoveDrawing = (id: string, e: React.MouseEvent) => {
    if (activeTool !== 'eraser') return;
    e.stopPropagation();
    saveAnnotationsToStateAndStorage({
      ...annotations,
      drawings: annotations.drawings.filter((d) => d.id !== id),
    });
  };

  const handleRemoveTextNote = (id: string, e: React.MouseEvent) => {
    if (activeTool !== 'eraser') return;
    e.stopPropagation();
    saveAnnotationsToStateAndStorage({
      ...annotations,
      textNotes: annotations.textNotes.filter((t) => t.id !== id),
    });
  };

  const handleUndo = () => {
    const pageHighlights = annotations.highlights.filter((h) => h.pageNumber === currentPage);
    const pageDrawings = annotations.drawings.filter((d) => d.pageNumber === currentPage);
    const pageComments = annotations.comments.filter((c) => c.pageNumber === currentPage);
    const pageTexts = annotations.textNotes.filter((t) => t.pageNumber === currentPage);

    const allPageItems = [
      ...pageHighlights.map((i) => ({ ...i, kind: 'highlight' })),
      ...pageDrawings.map((i) => ({ ...i, kind: 'drawing' })),
      ...pageComments.map((i) => ({ ...i, kind: 'comment' })),
      ...pageTexts.map((i) => ({ ...i, kind: 'text' })),
    ].sort((a, b) => b.createdAt - a.createdAt);

    if (allPageItems.length === 0) return;
    const latest = allPageItems[0];

    saveAnnotationsToStateAndStorage({
      ...annotations,
      highlights: annotations.highlights.filter((h) => h.id !== latest.id),
      drawings: annotations.drawings.filter((d) => d.id !== latest.id),
      comments: annotations.comments.filter((c) => c.id !== latest.id),
      textNotes: annotations.textNotes.filter((t) => t.id !== latest.id),
    });
  };

  const handleClearPage = () => {
    saveAnnotationsToStateAndStorage({
      ...annotations,
      highlights: annotations.highlights.filter((h) => h.pageNumber !== currentPage),
      drawings: annotations.drawings.filter((d) => d.pageNumber !== currentPage),
      comments: annotations.comments.filter((c) => c.pageNumber !== currentPage),
      textNotes: annotations.textNotes.filter((t) => t.pageNumber !== currentPage),
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const currentPageHighlights = annotations.highlights.filter((h) => h.pageNumber === currentPage);
  const currentPageComments = annotations.comments.filter((c) => c.pageNumber === currentPage);
  const currentPageDrawings = annotations.drawings.filter((d) => d.pageNumber === currentPage);
  const currentPageTexts = annotations.textNotes.filter((t) => t.pageNumber === currentPage);

  const filteredComments = annotations.comments.filter((c) => {
    if (!commentSearch.trim()) return true;
    const q = commentSearch.toLowerCase();
    return c.text.toLowerCase().includes(q) || c.author.toLowerCase().includes(q);
  });

  return (
    <div className="w-full h-full flex flex-col bg-neutral-900/5 overflow-hidden">
      {/* COMPACT SINGLE-ROW TOOLBAR (Leaves maximum vertical space for the document) */}
      <div className="bg-neutral-850 text-white flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs shrink-0 shadow-sm border-b border-neutral-700/80 bg-neutral-900 overflow-x-auto min-h-[42px]">
        {/* Left: Navigation and Sidebar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer text-xs ${
              isSidebarOpen ? 'bg-blue-600 text-white font-medium' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
            title="Painel de comentários e miniaturas"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Painel</span>
            {annotations.comments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-[10px] font-bold flex items-center justify-center text-white">
                {annotations.comments.length}
              </span>
            )}
          </button>

          {numPages > 0 && (
            <div className="flex items-center gap-0.5 bg-neutral-800 px-1 py-0.5 rounded-md text-[11px]">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-neutral-700 disabled:opacity-30 rounded cursor-pointer transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <form onSubmit={handlePageJump} className="flex items-center gap-1 font-mono text-[11px] px-1">
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => setPageInput(String(currentPage))}
                  className="w-7 text-center bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-white text-xs font-mono focus:outline-none"
                />
                <span className="text-neutral-400">/</span>
                <span>{numPages}</span>
              </form>

              <button
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="p-1 hover:bg-neutral-700 disabled:opacity-30 rounded cursor-pointer transition-colors"
                title="Próxima Página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-neutral-800 px-1 py-0.5 rounded-md text-[11px]">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-neutral-700 rounded cursor-pointer text-neutral-300"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[11px] px-1 min-w-[34px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-neutral-700 rounded cursor-pointer text-neutral-300"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={handleFitWidth}
              className="px-1.5 py-0.5 text-[10px] hover:bg-neutral-700 rounded cursor-pointer text-neutral-300 hidden md:inline"
              title="Ajustar à largura"
            >
              Largura
            </button>
            <button
              onClick={handleRotate}
              className="p-1 hover:bg-neutral-700 rounded cursor-pointer text-neutral-300"
              title="Girar 90 graus"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Center: ANNOTATION TOOLS */}
        <div className="flex items-center gap-1 bg-neutral-800/90 p-0.5 rounded-lg border border-neutral-700/80 shrink-0">
          {/* Leitura */}
          <button
            onClick={() => setActiveTool('select')}
            className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTool === 'select'
                ? 'bg-neutral-700 text-white font-medium shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Selecione um trecho do texto do PDF para destacá-lo em amarelo"
          >
            Leitura
          </button>

          {/* Marca-texto */}
          <div className="flex items-center gap-0.5 bg-neutral-900/50 rounded px-1 py-0.5">
            <button
              onClick={() => setActiveTool(activeTool === 'highlight-rect' ? 'select' : 'highlight-rect')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                activeTool === 'highlight-rect'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-xs'
                  : 'text-amber-400 hover:bg-neutral-800'
              }`}
              title="Marca-texto: selecione e arraste sobre o texto"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Marca-texto</span>
            </button>

            {/* Compact Highlighter Color Dots */}
            {activeTool === 'highlight-rect' && (
              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-neutral-700">
                {HIGHLIGHTER_COLORS.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedHighlightColor(col.id)}
                    className={`w-3 h-3 rounded-full cursor-pointer transition-transform ${
                      selectedHighlightColor === col.id ? 'ring-2 ring-white scale-125' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col.bgHex }}
                    title={col.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Comentário */}
          <button
            onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
              activeTool === 'comment'
                ? 'bg-blue-600 text-white font-medium shadow-xs'
                : 'text-blue-300 hover:bg-neutral-700'
            }`}
            title="Clique na página para adicionar um comentário"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">Comentar</span>
          </button>

          {/* Caneta */}
          <div className="flex items-center gap-0.5 bg-neutral-900/50 rounded px-1 py-0.5">
            <button
              onClick={() => setActiveTool(activeTool === 'pen' ? 'select' : 'pen')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-neutral-200 text-neutral-900 shadow-xs'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
              title="Caneta para anotações manuais"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            {activeTool === 'pen' && (
              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-neutral-700">
                {PEN_COLORS.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedPenColor(col.hex)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
                      selectedPenColor === col.hex ? 'ring-2 ring-white scale-125' : 'opacity-70'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Texto */}
          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              activeTool === 'text'
                ? 'bg-neutral-200 text-neutral-900 shadow-xs'
                : 'text-neutral-300 hover:bg-neutral-700'
            }`}
            title="Adicionar texto"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* Borracha */}
          <button
            onClick={() => setActiveTool(activeTool === 'eraser' ? 'select' : 'eraser')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-rose-600 text-white font-medium shadow-xs'
                : 'text-neutral-300 hover:text-rose-400 hover:bg-neutral-700'
            }`}
            title="Borracha: clique para remover anotação"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-neutral-700 mx-0.5" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            className="p-1 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded cursor-pointer"
            title="Desfazer"
          >
            <Undo2 className="w-3 h-3" />
          </button>

          {/* Clear */}
          <button
            onClick={handleClearPage}
            className="p-1 hover:bg-neutral-700 text-neutral-400 hover:text-rose-400 rounded cursor-pointer"
            title="Limpar anotações da página"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          {hasSavedFeedback && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-1">
              <Check className="w-3 h-3" /> Salvo
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handlePrint}
            className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Imprimir com anotações"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDownload}
            className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Baixar PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BODY CONTENT: SIDEBAR + CANVASES */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR: COMMENTS & MINIATURAS */}
        {isSidebarOpen && (
          <aside className="w-72 bg-white border-r border-neutral-200 flex flex-col shrink-0 shadow-lg z-20">
            {/* Sidebar Tabs */}
            <div className="flex items-center border-b border-neutral-200 bg-neutral-50 p-1 text-xs">
              <button
                onClick={() => setSidebarTab('comments')}
                className={`flex-1 py-1 font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  sidebarTab === 'comments'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Comentários ({annotations.comments.length})</span>
              </button>
              <button
                onClick={() => setSidebarTab('thumbnails')}
                className={`flex-1 py-1 font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  sidebarTab === 'thumbnails'
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Páginas ({numPages})</span>
              </button>
            </div>

            {/* Comments Tab Body */}
            {sidebarTab === 'comments' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-2 border-b border-neutral-100 bg-white">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={commentSearch}
                      onChange={(e) => setCommentSearch(e.target.value)}
                      className="w-full text-xs pl-7 pr-2 py-1 bg-neutral-100 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {filteredComments.length === 0 ? (
                    <div className="text-center py-10 px-3 space-y-1 text-neutral-400">
                      <MessageCircle className="w-7 h-7 mx-auto text-neutral-300" />
                      <p className="text-xs font-medium text-neutral-600">Nenhum comentário</p>
                      <p className="text-[11px] text-neutral-400">
                        Use o botão <strong className="text-neutral-700">Comentar</strong> e clique na página.
                      </p>
                    </div>
                  ) : (
                    filteredComments.map((comm) => (
                      <div
                        key={comm.id}
                        onClick={() => {
                          setCurrentPage(comm.pageNumber);
                          setPageInput(String(comm.pageNumber));
                          setSelectedCommentId(comm.id);
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs ${
                          comm.resolved
                            ? 'bg-neutral-50/80 border-neutral-200 opacity-60'
                            : comm.pageNumber === currentPage
                            ? 'bg-blue-50/60 border-blue-200 ring-1 ring-blue-300 shadow-2xs'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            <span className="font-semibold text-neutral-900">{comm.author}</span>
                            <span className="text-[9.5px] font-mono text-blue-600 bg-blue-100/70 px-1 py-0.2 rounded font-medium">
                              Pág. {comm.pageNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleToggleResolveComment(comm.id, e)}
                              className={`p-0.5 rounded transition-colors ${
                                comm.resolved ? 'text-emerald-600 bg-emerald-50' : 'text-neutral-400 hover:text-emerald-600'
                              }`}
                              title={comm.resolved ? 'Resolvido' : 'Marcar resolvido'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleRemoveComment(comm.id, e)}
                              className="p-0.5 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-neutral-700 leading-relaxed break-words text-[11.5px]">{comm.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Thumbnails Tab Body */}
            {sidebarTab === 'thumbnails' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {Array.from({ length: numPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = pNum === currentPage;
                  return (
                    <div
                      key={pNum}
                      onClick={() => {
                        setCurrentPage(pNum);
                        setPageInput(String(pNum));
                      }}
                      className={`p-1.5 rounded-xl border cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="w-full aspect-[1/1.3] bg-white rounded border border-neutral-200 flex flex-col items-center justify-center relative">
                        <FileText className={`w-6 h-6 ${isCurrent ? 'text-blue-500' : 'text-neutral-300'}`} />
                        <span className="text-[10px] font-semibold text-neutral-600 mt-1 font-mono">
                          Pág. {pNum}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        {/* MAIN VIEWER CANVAS CONTAINER */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center bg-neutral-200/60 relative">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3 m-auto">
              <RefreshCw className="w-8 h-8 text-neutral-600 animate-spin" />
              <p className="text-xs text-neutral-600 font-medium">Carregando páginas do PDF...</p>
            </div>
          ) : loadError ? (
            <div className="text-center p-8 bg-white rounded-xl border border-neutral-300 space-y-3 m-auto max-w-sm">
              <FileText className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-semibold text-neutral-900">Visualização de PDF</h3>
              <p className="text-xs text-neutral-600">{loadError}</p>
              <button
                onClick={onDownload}
                className="px-4 py-2 bg-neutral-900 text-white text-xs rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                Baixar Arquivo PDF
              </button>
            </div>
          ) : (
            <div
              className="relative shadow-xl rounded-sm border border-neutral-300 bg-white mx-auto my-auto transition-all"
              style={{
                width: pageDimensions.width > 0 ? `${pageDimensions.width}px` : 'auto',
                height: pageDimensions.height > 0 ? `${pageDimensions.height}px` : 'auto',
              }}
            >
              {/* PDF Background Canvas */}
              <canvas
                ref={canvasRef}
                className="bg-white block select-none"
              />

              {/* INTERACTIVE ANNOTATION LAYER */}
              <div
                ref={overlayRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`absolute inset-0 z-10 ${
                  activeTool === 'select'
                    ? 'cursor-default'
                    : activeTool === 'highlight-rect' || activeTool === 'highlight-free'
                    ? 'cursor-crosshair'
                    : activeTool === 'pen'
                    ? 'cursor-crosshair'
                    : activeTool === 'comment'
                    ? 'cursor-cell'
                    : activeTool === 'text'
                    ? 'cursor-text'
                    : activeTool === 'eraser'
                    ? 'cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div ref={textLayerRef} className="pdf-text-layer" aria-label="Texto do PDF selecionável" />
                {/* 1. SVG Drawings Layer */}
                <svg
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {currentPageDrawings.map((stroke) => {
                    if (stroke.points.length < 2) return null;
                    const pathD = stroke.points.reduce((acc, pt, idx) => {
                      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                    }, '');

                    return (
                      <path
                        key={stroke.id}
                        d={pathD}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.tool === 'highlighter' ? 3.0 : 0.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={stroke.opacity}
                        style={{
                          pointerEvents: activeTool === 'eraser' ? 'auto' : 'none',
                          cursor: activeTool === 'eraser' ? 'pointer' : 'default',
                        }}
                        onClick={(e) => handleRemoveDrawing(stroke.id, e)}
                        className={activeTool === 'eraser' ? 'hover:opacity-30 transition-opacity' : ''}
                      />
                    );
                  })}

                  {/* Active drawing stroke preview */}
                  {isDrawing && (activeTool === 'pen' || activeTool === 'highlight-free') && currentDrawingPoints.length > 1 && (
                    <path
                      d={currentDrawingPoints.reduce(
                        (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                        ''
                      )}
                      fill="none"
                      stroke={
                        activeTool === 'highlight-free'
                          ? (HIGHLIGHTER_COLORS.find((c) => c.id === selectedHighlightColor)?.bgHex || '#facc15')
                          : selectedPenColor
                      }
                      strokeWidth={activeTool === 'highlight-free' ? 3.0 : 0.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={activeTool === 'highlight-free' ? 0.45 : 0.95}
                    />
                  )}
                </svg>

                {/* 2. RECTANGLE HIGHLIGHTS */}
                {currentPageHighlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={(e) => handleRemoveHighlight(hl.id, e)}
                    style={{
                      left: `${hl.x}%`,
                      top: `${hl.y}%`,
                      width: `${hl.width}%`,
                      height: `${hl.height}%`,
                      backgroundColor: hl.color,
                      mixBlendMode: 'multiply',
                      opacity: 0.45,
                    }}
                    className={`absolute rounded-xs transition-all ${
                      activeTool === 'eraser'
                        ? 'hover:ring-2 hover:ring-rose-500 hover:opacity-80 cursor-pointer pointer-events-auto'
                        : 'pointer-events-none'
                    }`}
                    title={activeTool === 'eraser' ? 'Clique para apagar marca-texto' : undefined}
                  />
                ))}

                {/* Active highlight drag preview */}
                {isDrawing && activeTool === 'highlight-rect' && currentDragRect && (
                  <div
                    style={{
                      left: `${currentDragRect.x}%`,
                      top: `${currentDragRect.y}%`,
                      width: `${currentDragRect.width}%`,
                      height: `${Math.max(currentDragRect.height, 1.2)}%`,
                      backgroundColor:
                        HIGHLIGHTER_COLORS.find((c) => c.id === selectedHighlightColor)?.bgHex || '#facc15',
                      mixBlendMode: 'multiply',
                      opacity: 0.45,
                    }}
                    className="absolute border border-amber-400 rounded-xs pointer-events-none"
                  />
                )}

                {/* 3. TEXT NOTES */}
                {currentPageTexts.map((txt) => (
                  <div
                    key={txt.id}
                    onClick={(e) => handleRemoveTextNote(txt.id, e)}
                    style={{
                      left: `${txt.x}%`,
                      top: `${txt.y}%`,
                      color: txt.color,
                      backgroundColor: txt.backgroundColor || 'transparent',
                    }}
                    className={`absolute px-1.5 py-0.5 rounded text-xs font-sans whitespace-pre-wrap select-text shadow-2xs border border-transparent ${
                      activeTool === 'eraser'
                        ? 'hover:border-rose-400 hover:bg-rose-50/80 cursor-pointer pointer-events-auto'
                        : 'bg-white/90 border-neutral-300'
                    }`}
                  >
                    {txt.text}
                  </div>
                ))}

                {/* 4. COMMENT PINS */}
                {currentPageComments.map((comm) => {
                  const isSelected = selectedCommentId === comm.id;
                  const isEditingThis = editingCommentId === comm.id;
                  const isNearRightEdge = comm.x > 60;
                  const isNearBottomEdge = comm.y > 70;

                  return (
                    <div
                      key={comm.id}
                      style={{
                        left: `${comm.x}%`,
                        top: `${comm.y}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group no-canvas-click"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCommentId(isSelected ? null : comm.id);
                          setEditingCommentId(null);
                        }}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-md transition-transform hover:scale-110 cursor-pointer ${
                          comm.resolved
                            ? 'bg-neutral-500'
                            : isSelected
                            ? 'bg-blue-700 ring-2 ring-white scale-110'
                            : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                        title={`Comentário por ${comm.author}: "${comm.text.substring(0, 30)}"`}
                      >
                        <MessageSquare className="w-2.5 h-2.5 fill-white" />
                      </button>

                      {isSelected && (
                        <div
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute z-30 w-64 bg-white rounded-xl shadow-2xl border border-neutral-200 p-2.5 text-xs text-neutral-800 space-y-2 animate-in fade-in no-canvas-click ${
                            isNearRightEdge ? 'right-7' : 'left-7'
                          } ${isNearBottomEdge ? 'bottom-0' : '-top-2'}`}
                        >
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                              <span className="font-semibold text-neutral-900 truncate">{comm.author}</span>
                              {comm.resolved && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-medium">
                                  Resolvido
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleResolveComment(comm.id)}
                                className={`p-0.5 rounded transition-colors ${
                                  comm.resolved ? 'text-emerald-600 bg-emerald-50' : 'text-neutral-400 hover:text-emerald-600'
                                }`}
                                title={comm.resolved ? 'Marcar como não resolvido' : 'Marcar como resolvido'}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(comm.id);
                                  setEditingCommentText(comm.text);
                                }}
                                className="p-0.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
                                title="Editar texto do comentário"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveComment(comm.id)}
                                className="p-0.5 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCommentId(null)}
                                className="p-0.5 rounded text-neutral-400 hover:text-neutral-700"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditingThis ? (
                            <div className="space-y-1.5">
                              <textarea
                                autoFocus
                                rows={2}
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full text-xs p-1.5 bg-neutral-50 rounded border border-blue-400 focus:outline-none resize-none"
                              />
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-2 py-0.5 text-[11px] rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCommentText(comm.id, editingCommentText)}
                                  className="px-2 py-0.5 text-[11px] rounded bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-2xs"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-neutral-700 leading-relaxed break-words text-[11.5px] whitespace-pre-wrap">
                              {comm.text}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 5. NEW COMMENT INPUT MODAL */}
                {newCommentPos && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      left: `${Math.min(Math.max(newCommentPos.x, 15), 75)}%`,
                      top: `${Math.min(Math.max(newCommentPos.y, 10), 80)}%`,
                    }}
                    className="absolute z-30 w-72 bg-white rounded-xl shadow-2xl border border-neutral-200 p-3 space-y-2 text-xs animate-in fade-in no-canvas-click"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
                      <span className="font-semibold text-neutral-900">Novo Comentário</span>
                      <button
                        type="button"
                        onClick={() => setNewCommentPos(null)}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      autoFocus
                      rows={2}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveNewComment();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setNewCommentPos(null);
                        }
                      }}
                      placeholder="Escreva seu comentário..."
                      className="w-full text-xs p-1.5 bg-neutral-50 rounded-lg border border-neutral-200 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                    />

                    <div className="flex items-center justify-between gap-1.5">
                      <input
                        type="text"
                        value={newCommentAuthor}
                        onChange={(e) => setNewCommentAuthor(e.target.value)}
                        placeholder="Seu nome"
                        className="w-20 text-[10px] px-1.5 py-0.5 bg-neutral-100 rounded border border-neutral-200 focus:outline-none"
                      />

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNewCommentPos(null)}
                          className="px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer text-[11px]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewComment}
                          disabled={!newCommentText.trim()}
                          className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded shadow-2xs cursor-pointer text-[11px]"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. NEW TEXT NOTE MODAL */}
                {newTextPos && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      left: `${Math.min(newTextPos.x, 70)}%`,
                      top: `${Math.min(newTextPos.y, 85)}%`,
                    }}
                    className="absolute z-30 w-56 bg-white rounded-xl shadow-2xl border border-neutral-200 p-2 space-y-1.5 text-xs"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={newTextValue}
                      onChange={(e) => setNewTextValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNewText();
                        if (e.key === 'Escape') setNewTextPos(null);
                      }}
                      placeholder="Digite a nota..."
                      className="w-full text-xs p-1 bg-neutral-50 rounded border border-neutral-200 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setNewTextPos(null)}
                        className="px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 rounded text-[11px]"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveNewText}
                        disabled={!newTextValue.trim()}
                        className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[11px] font-medium cursor-pointer"
                      >
                        Inserir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
