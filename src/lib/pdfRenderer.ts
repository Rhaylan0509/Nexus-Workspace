import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker with Vite asset URL for reliable offline loading
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
}

/**
 * Loads a PDF document from an ArrayBuffer or Blob with full support for image decoders (OpenJPEG, JBIG2)
 */
export async function loadPdfDocument(source: Blob | ArrayBuffer) {
  const arrayBuffer = source instanceof Blob ? await source.arrayBuffer() : source;
  const version = pdfjsLib.version || '6.4.299';
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`,
    wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/wasm/`,
  });
  return await loadingTask.promise;
}

/**
 * Renders a single page of a PDF document to a crisp, high-DPI data URL (image/png)
 */
export async function renderPdfPageToDataUrl(
  pdfDoc: any,
  pageNumber: number,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      return null;
    }

    const page = await pdfDoc.getPage(pageNumber);
    const initialViewport = page.getViewport({ scale: 1 });

    // Determine scale: default to 2.0x for retina crispness, or calculate based on target dimensions
    let scale = 2.0;
    if (targetWidth && targetWidth > 0) {
      scale = Math.max(1.5, Math.min(3.0, (targetWidth / initialViewport.width) * 2));
    }

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Guarantee white opaque background for PDF pages so no transparency or grey shows through
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    return {
      dataUrl,
      width: initialViewport.width,
      height: initialViewport.height,
    };
  } catch (err) {
    console.error(`Failed to render PDF page ${pageNumber} to image:`, err);
    return null;
  }
}

/**
 * Renders all pages of a PDF document into a Map of pageNumber -> dataUrl
 */
export async function renderAllPdfPagesToDataUrls(
  source: Blob | ArrayBuffer,
  maxPages: number = 20
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  try {
    const doc = await loadPdfDocument(source);
    const count = Math.min(doc.numPages, maxPages);

    for (let p = 1; p <= count; p++) {
      const rendered = await renderPdfPageToDataUrl(doc, p);
      if (rendered) {
        result.set(p, rendered.dataUrl);
      }
    }
  } catch (err) {
    console.error('Error rendering all PDF pages:', err);
  }
  return result;
}
