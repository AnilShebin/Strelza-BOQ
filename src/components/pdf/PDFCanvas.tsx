import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadCloudIcon, FileTextIcon, SparklesIcon } from 'lucide-react';

interface PDFCanvasProps {
  pdfDoc: any;
  currentPage: number;
  scale: number;
  rotation: number;
  zoomMode: 'fit-width' | 'fit-page' | 'custom';
  zoomScale: number;
  setScale: (s: number) => void;
  dimensions: { width: number; height: number };
  setDimensions: (dims: { width: number; height: number }) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  interactionMode: 'select' | 'pan' | 'pen';
  isPanning: boolean;
  containerWidth: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onLoadPDF: () => void;
  pdfBase64: string;
  markups: any[];
  onAddMarkup: (stroke: any) => void;
  onDeleteMarkup?: (id: string) => void;
  onClearPageMarkups?: (page: number) => void;
  highlightedBbox?: [number, number, number, number] | null;
  onHighlightBbox?: (bbox: [number, number, number, number] | null) => void;
  highlightAll?: boolean;
  pageElements?: any[];
}

export const PDFCanvas: React.FC<PDFCanvasProps> = ({
  pdfDoc,
  currentPage,
  scale,
  rotation,
  zoomMode,
  zoomScale,
  setScale,
  dimensions,
  setDimensions,
  loading,
  setLoading,
  interactionMode,
  isPanning,
  containerWidth,
  containerRef,
  onLoadPDF,
  pdfBase64,
  markups = [],
  onAddMarkup,
  highlightedBbox = null,
  onHighlightBbox,
  highlightAll = false,
  pageElements = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [hoveredElement, setHoveredElement] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Render PDF Page to Canvas via PDF.js
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    pdfDoc.getPage(currentPage).then((page: any) => {
      if (isCancelled) return;

      // Cancel previous in-flight render task
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
      }

      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      let computedScale = zoomScale;

      if (zoomMode === 'fit-width') {
        const availableWidth = Math.max(400, containerWidth - 48);
        computedScale = availableWidth / unscaledViewport.width;
      } else if (zoomMode === 'fit-page') {
        const containerHeight = containerRef.current?.clientHeight || 800;
        const scaleW = (containerWidth - 48) / unscaledViewport.width;
        const scaleH = (containerHeight - 48) / unscaledViewport.height;
        computedScale = Math.min(scaleW, scaleH);
      }

      setScale(computedScale);

      const viewport = page.getViewport({ scale: computedScale, rotation });
      setDimensions({ width: viewport.width, height: viewport.height });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;

      task.promise
        .then(() => {
          setLoading(false);
        })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error('PDF page render error:', err);
          }
        });
    }).catch((err: any) => {
      console.error('Failed to get page:', err);
      setLoading(false);
    });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, rotation, zoomMode, zoomScale, containerWidth]);

  // Redraw Markup Layer
  const redrawMarkups = useCallback(() => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageStrokes = markups.filter((s) => s.page === currentPage);
    pageStrokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color || '#F27E20';
      ctx.lineWidth = (stroke.width || 3) * (scale / 1.0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = stroke.points[0];
      ctx.moveTo((first.x / 1000) * dimensions.width, (first.y / 1000) * dimensions.height);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt.x / 1000) * dimensions.width, (pt.y / 1000) * dimensions.height);
      }
      ctx.stroke();
    });
  }, [markups, currentPage, dimensions, scale]);

  useEffect(() => {
    redrawMarkups();
  }, [redrawMarkups]);

  // Pen Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionMode !== 'pen') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / dimensions.width) * 1000;
    const y = ((e.clientY - rect.top) / dimensions.height) * 1000;

    isDrawingRef.current = true;
    currentPointsRef.current = [{ x, y }];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || interactionMode !== 'pen') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / dimensions.width) * 1000;
    const y = ((e.clientY - rect.top) / dimensions.height) * 1000;

    currentPointsRef.current.push({ x, y });

    // Live draw stroke
    const canvas = markupCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && currentPointsRef.current.length >= 2) {
        const pts = currentPointsRef.current;
        const prev = pts[pts.length - 2];
        const curr = pts[pts.length - 1];

        ctx.beginPath();
        ctx.strokeStyle = '#F27E20';
        ctx.lineWidth = 3 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo((prev.x / 1000) * dimensions.width, (prev.y / 1000) * dimensions.height);
        ctx.lineTo((curr.x / 1000) * dimensions.width, (curr.y / 1000) * dimensions.height);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentPointsRef.current.length > 1) {
      const newStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        page: currentPage,
        color: '#F27E20',
        width: 3,
        points: [...currentPointsRef.current],
      };
      onAddMarkup(newStroke);
    }
    currentPointsRef.current = [];
  };

  // Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      onLoadPDF();
    }
  };

  return (
    <div
      className="flex-1 flex justify-center items-start min-h-full p-6 select-none relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pdfBase64 ? (
        /* PDF Sheet Stage */
        <div
          className="relative transition-all duration-75 shadow-2xl rounded-sm bg-white overflow-hidden ring-1 ring-black/10 dark:ring-white/10"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            cursor:
              interactionMode === 'pan'
                ? isPanning
                  ? 'grabbing'
                  : 'grab'
                : interactionMode === 'pen'
                ? 'crosshair'
                : 'default',
          }}
        >
          {/* Main Document Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 block z-0"
            style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
          />

          {/* Interactive Bounding Box Overlays */}
          {pageElements.map((el, idx) => {
            if (!el.bbox || !Array.isArray(el.bbox) || el.bbox.length < 4) return null;
            const [ymin, xmin, ymax, xmax] = el.bbox;
            const top = (ymin / 1000) * dimensions.height;
            const left = (xmin / 1000) * dimensions.width;
            const width = ((xmax - xmin) / 1000) * dimensions.width;
            const height = ((ymax - ymin) / 1000) * dimensions.height;

            const isHighlighted =
              highlightAll ||
              (highlightedBbox &&
                highlightedBbox[0] === ymin &&
                highlightedBbox[1] === xmin &&
                highlightedBbox[2] === ymax &&
                highlightedBbox[3] === xmax);

            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onHighlightBbox) {
                    onHighlightBbox(isHighlighted && !highlightAll ? null : el.bbox);
                  }
                }}
                onMouseEnter={() => setHoveredElement(el)}
                onMouseLeave={() => setHoveredElement(null)}
                style={{
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
                className={`absolute z-10 transition-all rounded-xs cursor-pointer border ${
                  isHighlighted
                    ? 'border-primary bg-primary/20 ring-2 ring-primary/40 shadow-xs'
                    : 'border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/15'
                }`}
              >
                {/* Element Hover Tooltip */}
                {hoveredElement === el && (
                  <div className="absolute -top-7 left-0 bg-popover text-popover-foreground text-[10px] font-medium px-2 py-0.5 rounded shadow-md border border-border whitespace-nowrap z-30 pointer-events-none">
                    {el.title || (el.type === 'structured' ? 'Schedule Table' : 'Note')}
                    {el.confidence && ` (${(el.confidence * 100).toFixed(0)}%)`}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pen Markup Canvas Overlay */}
          <canvas
            ref={markupCanvasRef}
            className="absolute top-0 left-0 z-20 pointer-events-auto"
            style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      ) : (
        /* Empty Drop-Zone Stage */
        <div
          onClick={onLoadPDF}
          className={`flex flex-col items-center justify-center text-center p-10 max-w-md w-full border-2 border-dashed rounded-2xl my-auto transition-all cursor-pointer select-none gap-4 shadow-sm ${
            isDragOver
              ? 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.02]'
              : 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <div className="size-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary shadow-xs">
            <UploadCloudIcon className="size-8 animate-bounce" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">
              Open Engineering Drawing PDF
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag & drop an architectural or engineering drawing PDF here, or click to browse files.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[10.5px]">
              Vector Drawings
            </Badge>
            <Badge variant="secondary" className="text-[10.5px]">
              Multi-page Sheets
            </Badge>
            <Badge variant="secondary" className="text-[10.5px]">
              Schedule Tables
            </Badge>
          </div>

          <Button
            size="default"
            onClick={(e) => {
              e.stopPropagation();
              onLoadPDF();
            }}
            className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground shadow-md gap-2 cursor-pointer mt-2"
          >
            <FileTextIcon className="size-3.5" />
            <span>Select PDF File</span>
          </Button>
        </div>
      )}
    </div>
  );
};
