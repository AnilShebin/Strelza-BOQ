import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PDFToolbar } from './PDFToolbar';
import { PDFCanvas } from './PDFCanvas';
import { PDFExtractionPanel } from './PDFExtractionPanel';

interface PDFViewerProps {
  pdfName?: string;
  pdfBase64: string;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onDocumentLoad: (pages: number) => void;
  onLoadPDF: () => void;
  isMaximized: boolean;
  analyzedData: any;
  analyzing: boolean;
  analysisError: string | null;
  onGenerateBOQ?: () => void;
  onViewDashboard?: () => void;
  extractedData?: any;
  extracting?: boolean;
  onStartExtraction?: (pages?: number[]) => void;
  onReextractPage?: (page: number) => void;
  extractingPage?: boolean;
  highlightedBbox?: [number, number, number, number] | null;
  onHighlightBbox?: (bbox: [number, number, number, number] | null) => void;
  markups: any[];
  onAddMarkup: (stroke: any) => void;
  onDeleteMarkup: (id: string) => void;
  onClearPageMarkups: (page: number) => void;
  onUndoMarkup?: () => void;
  onRedoMarkup?: () => void;
  canUndoMarkup?: boolean;
  canRedoMarkup?: boolean;
  highlightAll?: boolean;
  onToggleHighlightAll?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  projectVersions?: any[];
  activeVersionId?: string;
  onSelectVersion?: (id: string) => void;
}

/**
 * PDF Viewer Shell container component.
 * Manages document loading context, zooming levels, and mouse drag behaviors.
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfName,
  pdfBase64,
  totalPages,
  currentPage,
  setCurrentPage,
  onDocumentLoad,
  onLoadPDF,
  isMaximized,
  analyzedData,
  analyzing,
  analysisError,
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
  onSaveProject,
  onOpenProject,
  projectVersions = [],
  activeVersionId = '',
  onSelectVersion,
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
  const [showExtractionPanel, setShowExtractionPanel] = useState(true);
  const [panelWidth, setPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number[]>>({});
  const [activeColResize, setActiveColResize] = useState<{
    tableIdx: number;
    colIdx: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoomIn = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.min(5.0, Math.round((prev + 0.15) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomMode('custom');
    setZoomScale((prev) => Math.max(0.25, Math.round((prev - 0.15) * 100) / 100));
  }, []);

  // Intercept Ctrl + mouse scroll to zoom PDF and prevent page zoom
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
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoomIn, zoomOut]);

  const toggleFullscreen = () => {
    if (!viewerRef.current) return;
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
    } else {
      document.exitFullscreen();
    }
  };

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'pan' || !pdfBase64 || !containerRef.current) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
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

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing || !viewerRef.current) return;
    const viewerRect = viewerRef.current.getBoundingClientRect();
    const newWidth = viewerRect.right - e.clientX;
    setPanelWidth(Math.max(280, Math.min(viewerRect.width * 0.75, newWidth)));
  }, [isResizing]);

  const stopResize = useCallback(() => setIsResizing(false), []);

  // Columns resize inside raw grids
  const startColumnResize = (e: React.MouseEvent, tableIdx: number, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const tr = th?.parentElement;
    if (!tr) return;
    const thElements = Array.from(tr.querySelectorAll('th'));
    const initialWidths = thElements.map(el => el.getBoundingClientRect().width);
    setColumnWidths(prev => ({ ...prev, [`table-${tableIdx}`]: initialWidths }));
    setActiveColResize({ tableIdx, colIdx, startX: e.clientX, startWidth: initialWidths[colIdx] });
  };

  const resizeColumn = useCallback((e: MouseEvent) => {
    if (!activeColResize) return;
    const dx = e.clientX - activeColResize.startX;
    const newWidth = Math.max(50, activeColResize.startWidth + dx);
    setColumnWidths(prev => {
      const tableKey = `table-${activeColResize.tableIdx}`;
      const currentWidths = [...(prev[tableKey] || [])];
      if (currentWidths.length > activeColResize.colIdx) {
        currentWidths[activeColResize.colIdx] = newWidth;
      }
      return { ...prev, [tableKey]: currentWidths };
    });
  }, [activeColResize]);

  const stopColumnResize = useCallback(() => setActiveColResize(null), []);

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

  useEffect(() => {
    if (activeColResize) {
      window.addEventListener('mousemove', resizeColumn);
      window.addEventListener('mouseup', stopColumnResize);
    }
    return () => {
      window.removeEventListener('mousemove', resizeColumn);
      window.removeEventListener('mouseup', stopColumnResize);
    };
  }, [activeColResize, resizeColumn, stopColumnResize]);

  // Handle document viewport size
  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(600, containerRef.current.offsetWidth - 64));
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
        pdfjsLib.getDocument({ data: bytes }).promise.then((pdf: any) => {
          setPdfDoc(pdf);
          onDocumentLoad(pdf.numPages);
          setLoading(false);
        }).catch((err: any) => {
          console.error("PDF.js loading failed:", err);
          setLoading(false);
        });
      } catch (e) {
        console.error("Base64 decode failed:", e);
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

  const currentPageElements = analyzedData?.elements?.filter((el: any) => el.page === currentPage) || [];
  const pageMarkupCount = (markups || []).filter((s) => s.page === currentPage).length;

  return (
    <div ref={viewerRef} className="flex-1 flex flex-col bg-bg-app relative overflow-hidden min-h-0 min-w-0">
      <style>{`
        .adobe-grab, .adobe-grab * { cursor: grab !important; }
        .adobe-grabbing, .adobe-grabbing * { cursor: grabbing !important; }
        .dark .pdf-page-wrapper { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.1); }
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
        handleZoomSelect={(m) => typeof m === 'number' ? (setZoomMode('custom'), setZoomScale(m)) : setZoomMode(m)}
        toggleFullscreen={toggleFullscreen}
        showExtractionPanel={showExtractionPanel}
        setShowExtractionPanel={setShowExtractionPanel}
        analyzing={analyzing}
        analyzedData={analyzedData}
        onGenerateBOQ={onGenerateBOQ}
        extractedData={extractedData}
        extracting={extracting}
        onStartExtraction={(pages) => {
          const targetPages = pages || (selectedPages.size > 0 ? Array.from(selectedPages) : undefined);
          onStartExtraction && onStartExtraction(targetPages);
        }}
        onClearPageMarkups={onClearPageMarkups}
        pageMarkupCount={pageMarkupCount}
        onUndoMarkup={onUndoMarkup}
        onRedoMarkup={onRedoMarkup}
        canUndoMarkup={canUndoMarkup}
        canRedoMarkup={canRedoMarkup}
        onSaveProject={onSaveProject}
        onOpenProject={onOpenProject}
        projectVersions={projectVersions}
        activeVersionId={activeVersionId}
        onSelectVersion={onSelectVersion}
      />

      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
        {isResizing && <div className="fixed inset-0 cursor-col-resize z-[9999] select-none" />}

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div
            ref={containerRef}
            className={`flex-1 overflow-auto py-6 px-6 flex flex-col items-start justify-start gap-6 min-h-0 bg-bg-app transition-colors duration-150 ${interactionMode === 'pan' ? (isPanning ? 'adobe-grabbing select-none' : 'adobe-grab select-none') : 'cursor-default'}`}
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
              onOpenProject={onOpenProject}
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
          </div>

          {isMaximized && (
            <div className="h-[22px] bg-bg-panel border-t border-border-color shrink-0 flex items-center px-4 select-none">
              <span className="text-[10px] text-text-secondary font-semibold font-display tracking-wide uppercase">
                {pdfName ? `${pdfName} • Sheet ${currentPage} of ${totalPages}` : 'No document active'}
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
