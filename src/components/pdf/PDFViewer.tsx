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
  // Viewer Navigation & Display State
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<'fit-width' | 'fit-page' | 'custom'>('fit-width');
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan' | 'pen'>('select');
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState({ width: 900, height: 1200 });
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Panels State
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [showExtractionPanel, setShowExtractionPanel] = useState<boolean>(true);
  const [panelWidth, setPanelWidth] = useState<number>(460);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number[]>>({});

  // Active PDF.js Doc Handle
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // DOM Refs
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Sync selected pages when totalPages changes
  useEffect(() => {
    if (totalPages) {
      const pages = new Set<number>();
      for (let i = 1; i <= totalPages; i++) pages.add(i);
      setSelectedPages(pages);
    }
  }, [totalPages]);

  // Decode and Load PDF document using PDF.js
  useEffect(() => {
    if (!pdfBase64) {
      setPdfDoc(null);
      setLoading(false);
      return;
    }

    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      console.warn('PDF.js library is not loaded on window.');
      return;
    }

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
          console.error('PDF.js parse failed:', err);
          setLoading(false);
        });
    } catch (err) {
      console.error('Failed to decode PDF base64:', err);
      setLoading(false);
    }
  }, [pdfBase64, onDocumentLoad]);

  // Reset rotation when switching pages/documents
  useEffect(() => {
    setRotation(0);
  }, [currentPage, pdfBase64]);

  // Container Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(400, containerRef.current.offsetWidth - 48));
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pdfDoc]);

  // Zoom helpers
  const zoomIn = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.min(4.0, Math.round((prev + 0.2) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.max(0.25, Math.round((prev - 0.2) * 100) / 100));
  }, []);

  const handleZoomSelect = useCallback((mode: 'fit-width' | 'fit-page' | number) => {
    if (typeof mode === 'number') {
      setZoomMode('custom');
      setZoomScale(mode);
    } else {
      setZoomMode(mode);
    }
  }, []);

  // Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
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
      } else if (e.key === '+' || (e.ctrlKey && e.key === '=')) {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || (e.ctrlKey && e.key === '-')) {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        handleZoomSelect('fit-width');
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
  }, [currentPage, totalPages, zoomIn, zoomOut, handleZoomSelect, setCurrentPage]);

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'pan' || !containerRef.current) return;
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
      setPanelWidth(Math.max(300, Math.min(viewerRect.width * 0.7, newWidth)));
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

  // Column Resizing within extracted data tables
  const startColumnResize = (e: React.MouseEvent, elementIdx: number, colIdx: number) => {
    e.preventDefault();
  };

  const currentPageElements =
    analyzedData?.elements?.filter((el: any) => el.page === currentPage) || [];
  const pageMarkupCount = markups.filter((s) => s.page === currentPage).length;

  return (
    <div
      ref={viewerRef}
      className="flex-1 flex flex-col bg-muted/20 relative overflow-hidden min-h-0 min-w-0 select-none"
    >
      {/* Top Toolbar */}
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
        handleZoomSelect={handleZoomSelect}
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

      {/* Main Workspace Stage */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0">
        {/* Left Thumbnails Sidebar */}
        {showThumbnails && (
          <ThumbnailsPanel
            pdfName={pdfName}
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onLoadPDF={onLoadPDF}
          />
        )}

        {/* Center Canvas Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex-1 overflow-auto relative bg-neutral-900/5 dark:bg-neutral-950/40 flex flex-col min-h-0 min-w-0 select-none"
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
            highlightAll={highlightAll}
            pageElements={currentPageElements}
          />

          {/* Bottom Document Status Bar */}
          {pdfName && (
            <div className="h-6 bg-card/80 border-t border-border/60 shrink-0 flex items-center justify-between px-3 text-[10.5px] text-muted-foreground font-mono select-none backdrop-blur-xs">
              <span className="truncate max-w-sm">
                {pdfName}
              </span>
              <span>
                Sheet {currentPage} of {totalPages || 1} • {Math.round(scale * 100)}% Zoom
              </span>
            </div>
          )}
        </div>

        {/* Right Extraction Panel */}
        {showExtractionPanel && (
          <PDFExtractionPanel
            analyzing={analyzing}
            analysisError={analysisError}
            analyzedData={analyzedData}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            columnWidths={columnWidths}
            startColumnResize={startColumnResize}
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
            highlightAll={highlightAll}
            onToggleHighlightAll={onToggleHighlightAll}
            selectedPages={selectedPages}
            setSelectedPages={setSelectedPages}
          />
        )}
      </div>
    </div>
  );
};
