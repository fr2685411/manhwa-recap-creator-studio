import * as pdfjsLib from 'pdfjs-dist';

// Use unpkg worker or bundle worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF worker setup warning:', e);
}

export interface ExtractedPage {
  pageNumber: number;
  dataUrl: string;
}

export async function extractPagesFromPdf(
  file: File,
  options: {
    maxPages?: number;
    scale?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<ExtractedPage[]> {
  const { maxPages = 15, scale = 1.4, onProgress } = options;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const results: ExtractedPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const renderContext = {
        canvasContext: ctx,
        viewport,
      };
      await page.render(renderContext as any).promise;

      // High quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      results.push({
        pageNumber: i,
        dataUrl,
      });
    }

    if (onProgress) {
      onProgress(i, numPages);
    }
  }

  return results;
}
