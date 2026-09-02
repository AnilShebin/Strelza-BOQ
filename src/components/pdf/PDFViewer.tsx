import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PDFToolbar } from './PDFToolbar';
import { PDFCanvas } from './PDFCanvas';
import { ThumbnailsPanel } from './ThumbnailsPanel';
import { PDFExtractionPanel } from './PDFExtractionPanel';

interface PDFViewerProps {
  pdfName?: string;
  pdfBase64: string;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onDocumentLoad: (pages: number) => void;
  onLoadPDF: () => void;
  isMaximized?: boolean;
  analyzedData?: any;
  analyzing?: boolean;
  analysisError?: string | null;
  onGenerateBOQ?: () => void;
  onViewDashboard?: () => void;
  extractedData?: any;
  extracting?: boolean;
  onStartExtraction?: (pages?: number[]) => void;
  onReextractPage?: (page: number) => void;
  extractingPage?: boolean;
  highlightedBbox?: [number, number, number, number] | null;
  onHighlightBbox?: (bbox: [number, number, number, number] | null) => void;
  markups?: any[];
  onAddMarkup: (stroke: any) => void;
  onDeleteMarkup?: (id: string) => void;
  onClearPageMarkups?: (page: number) => void;
  onUndoMarkup?: () => void;
  onRedoMarkup?: () => void;
  canUndoMarkup?: boolean;
  canRedoMarkup?: boolean;
  highlightAll?: boolean;
  onToggleHighlightAll?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfName,
  pdfBase64,
  totalPages,
  currentPage,
  setCurrentPage,
  onDocumentLoad,
  onLoadPDF,
  isMaximized = false,
  analyzedData,
  analyzing = false,
  analysisError = null,
  onGenerateBOQ,
  onViewDashboard,
  extractedData,
  extracting = false,
  onStartExtraction,
  onReextractPage,
  extractingPage = false,
  highlightedBbox = null,
  onHighlightBbox,
  markups = [],
  onAddMarkup,
  onDeleteMarkup,
  onClearPageMarkups,
  onUndoMarkup,
  onRedoMarkup,
  canUndoMarkup = false,
  canRedoMarkup = false,
  highlightAll = false,
  onToggleHighlightAll,
}) => {
  const [zoomScale, setZoomScale] = useState(1.0);
  const [zoomMode, setZoomMode] = useState<'fit-width' | 'fit-page' | 'custom'>('fit-width');
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan' | 'pen'>('select');
  const [isPanning, setIsPanning] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (totalPages) {
      const pages = new Set<number>();
      for (let i = 1; i <= totalPages; i++) {
        pages.add(i);
      }
      setSelectedPages(pages);
    }
  }, [totalPages]);

  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1400 });
  const [containerWidth, setContainerWidth] = useState(800);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showExtractionPanel, setShowExtractionPanel] = useState(true);
  const [panelWidth, setPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number[]>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!viewerRef.current) return;
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const zoomIn = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.min(5.0, Math.round((prev + 0.15) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.max(0.25, Math.round((prev - 0.15) * 100) / 100));
  }, []);

  // Intercept Ctrl + mouse scroll to zoom PDF
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        setCurrentPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault();
        setCurrentPage(currentPage + 1);
      } else if (e.key === 'h' || e.key === 'H') {
        setInteractionMode('pan');
      } else if (e.key === 'v' || e.key === 'V') {
        setInteractionMode('select');
      } else if (e.key === 'p' || e.key === 'P') {
        setInteractionMode('pen');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, setCurrentPage]);

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'pan' || !pdfBase64 || !containerRef.current) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || interactionMode !== 'pan' || !containerRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => setIsPanning(false);

  // Resize right extraction panel
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !viewerRef.current) return;
      const viewerRect = viewerRef.current.getBoundingClientRect();
      const newWidth = viewerRect.right - e.clientX;
      setPanelWidth(Math.max(280, Math.min(viewerRect.width * 0.75, newWidth)));
    },
    [isResizing]
  );

  const stopResize = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, resize, stopResize]);

  // Handle document viewport size
  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(400, containerRef.current.offsetWidth - 48));
      }
    };
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [pdfDoc]);

  // Decode and load PDF document bytes
  useEffect(() => {
    if (pdfBase64) {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) return;
      setLoading(true);
      try {
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfjsLib
          .getDocument({ data: bytes })
          .promise.then((pdf: any) => {
            setPdfDoc(pdf);
            onDocumentLoad(pdf.numPages);
            setLoading(false);
          })
          .catch((err: any) => {
            console.error('PDF.js loading failed:', err);
            setLoading(false);
          });
      } catch (e) {
        console.error('Base64 decode failed:', e);
        setLoading(false);
      }
    } else {
      setPdfDoc(null);
      setLoading(false);
    }
  }, [pdfBase64]);

  useEffect(() => {
    setRotation(0);
  }, [currentPage, pdfBase64]);

  const currentPageElements =
    analyzedData?.elements?.filter((el: any) => el.page === currentPage) || [];
  const pageMarkupCount = (markups || []).filter((s) => s.page === currentPage).length;
  const [internalHighlightAll, setInternalHighlightAll] = useState(false);
  const activeHighlightAll =
    onToggleHighlightAll ? highlightAll : internalHighlightAll;
  const handleToggleHighlightAll =
    onToggleHighlightAll || (() => setInternalHighlightAll((prev) => !prev));

  return (
    <div
      ref={viewerRef}
      className="flex-1 flex flex-col bg-muted/15 relative overflow-hidden min-h-0 min-w-0 select-none"
    >
      <style>{`
        .adobe-grab, .adobe-grab * { cursor: grab !important; }
        .adobe-grabbing, .adobe-grabbing * { cursor: grabbing !important; }
        .dark .pdf-render-canvas { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.1); }
      `}</style>

      <PDFToolbar
        pdfBase64={pdfBase64}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        scale={scale}
        rotation={rotation}
        setRotation={setRotation}
        zoomMode={zoomMode}
        zoomScale={zoomScale}
        handleZoomSelect={(m) =>
          typeof m === 'number'
            ? (setZoomMode('custom'), setZoomScale(m))
            : setZoomMode(m)
        }
        toggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        showExtractionPanel={showExtractionPanel}
        setShowExtractionPanel={setShowExtractionPanel}
        showThumbnails={showThumbnails}
        setShowThumbnails={setShowThumbnails}
        onClearPageMarkups={onClearPageMarkups}
        pageMarkupCount={pageMarkupCount}
        onUndoMarkup={onUndoMarkup}
        onRedoMarkup={onRedoMarkup}
        canUndoMarkup={canUndoMarkup}
        canRedoMarkup={canRedoMarkup}
      />

      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
        {isResizing && <div className="fixed inset-0 cursor-col-resize z-[9999] select-none" />}

        {/* Optional Collapsible Left Thumbnails Panel */}
        {showThumbnails && (
          <ThumbnailsPanel
            pdfName={pdfName}
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onLoadPDF={onLoadPDF}
          />
        )}

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div
            ref={containerRef}
            className={`flex-1 overflow-auto py-6 px-6 flex flex-col items-start justify-start gap-6 min-h-0 bg-neutral-900/5 dark:bg-neutral-950/40 transition-colors duration-150 ${
              interactionMode === 'pan'
                ? isPanning
                  ? 'adobe-grabbing select-none'
                  : 'adobe-grab select-none'
                : 'cursor-default'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <PDFCanvas
              pdfDoc={pdfDoc}
              currentPage={currentPage}
              scale={scale}
              rotation={rotation}
              zoomMode={zoomMode}
              zoomScale={zoomScale}
              setScale={setScale}
              dimensions={dimensions}
              setDimensions={setDimensions}
              loading={loading}
              setLoading={setLoading}
              interactionMode={interactionMode}
              isPanning={isPanning}
              containerWidth={containerWidth}
              containerRef={containerRef}
              onLoadPDF={onLoadPDF}
              pdfBase64={pdfBase64}
              markups={markups}
              onAddMarkup={onAddMarkup}
              onDeleteMarkup={onDeleteMarkup}
              onClearPageMarkups={onClearPageMarkups}
              highlightedBbox={highlightedBbox}
              onHighlightBbox={onHighlightBbox}
              highlightAll={activeHighlightAll}
              pageElements={currentPageElements}
            />
          </div>

          {pdfName && (
            <div className="h-6 bg-card border-t border-border/70 shrink-0 flex items-center justify-between px-4 text-[10px] text-muted-foreground font-mono select-none">
              <span className="truncate max-w-sm">
                {pdfName}
              </span>
              <span>
                Sheet {currentPage} of {totalPages || 1} • {Math.round(scale * 100)}% Zoom
              </span>
            </div>
          )}
        </div>

        {pdfBase64 && showExtractionPanel && (
          <PDFExtractionPanel
            analyzing={analyzing}
            analysisError={analysisError}
            analyzedData={analyzedData}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            columnWidths={columnWidths}
            startColumnResize={(e) => e.preventDefault()}
            panelWidth={panelWidth}
            startResize={startResize}
            isResizing={isResizing}
            setShowExtractionPanel={setShowExtractionPanel}
            onGenerateBOQ={onGenerateBOQ}
            onViewDashboard={onViewDashboard}
            extractedData={extractedData}
            extracting={extracting}
            onStartExtraction={onStartExtraction}
            totalPages={totalPages}
            onReextractPage={onReextractPage}
            extractingPage={extractingPage}
            highlightedBbox={highlightedBbox}
            onHighlightBbox={onHighlightBbox}
            highlightAll={activeHighlightAll}
            onToggleHighlightAll={handleToggleHighlightAll}
            selectedPages={selectedPages}
            setSelectedPages={setSelectedPages}
          />
        )}
      </div>
    </div>
  );
};
