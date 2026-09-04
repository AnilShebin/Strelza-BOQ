import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileTextIcon, UploadCloudIcon, Trash2Icon, XIcon } from 'lucide-react';

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
  onOpenProject?: () => void;
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
  onOpenProject,
  pdfBase64,
  markups = [],
  onAddMarkup,
  onDeleteMarkup,
  onClearPageMarkups,
  highlightedBbox = null,
  onHighlightBbox,
  highlightAll = false,
  pageElements = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [originalPageSize, setOriginalPageSize] = useState<{ width: number; height: number } | null>(null);

  const getStrokeBounds = (stroke: any) => {
    if (!stroke.points || stroke.points.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const pt of stroke.points) {
      const cx = (pt.x / 1000) * dimensions.width;
      const cy = (pt.y / 1000) * dimensions.height;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
    return { minX, minY, maxX, maxY };
  };

  const isPointNearStroke = (stroke: any, px: number, py: number): boolean => {
    if (!stroke.points || stroke.points.length < 2) return false;
    const tolerance = (stroke.width || 3) * scale + 8;
    for (let i = 1; i < stroke.points.length; i++) {
      const ax = (stroke.points[i - 1].x / 1000) * dimensions.width;
      const ay = (stroke.points[i - 1].y / 1000) * dimensions.height;
      const bx = (stroke.points[i].x / 1000) * dimensions.width;
      const by = (stroke.points[i].y / 1000) * dimensions.height;
      const dx = bx - ax,
        dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const nearX = ax + t * dx,
        nearY = ay + t * dy;
      if (Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2) <= tolerance) return true;
    }
    return false;
  };

  // Redraw markup layer
  useEffect(() => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    markups
      .filter((s) => s.page === currentPage)
      .forEach((stroke) => {
        if (!stroke.points || stroke.points.length < 2) return;
        if (stroke.id === selectedMarkupId) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(242, 126, 32, 0.55)';
          ctx.lineWidth = ((stroke.width || 3) + 6) * scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(
            (stroke.points[0].x / 1000) * dimensions.width,
            (stroke.points[0].y / 1000) * dimensions.height
          );
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(
              (stroke.points[i].x / 1000) * dimensions.width,
              (stroke.points[i].y / 1000) * dimensions.height
            );
          }
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.strokeStyle = stroke.color || '#F27E20';
        ctx.lineWidth = (stroke.width || 3) * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(
          (stroke.points[0].x / 1000) * dimensions.width,
          (stroke.points[0].y / 1000) * dimensions.height
        );
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(
            (stroke.points[i].x / 1000) * dimensions.width,
            (stroke.points[i].y / 1000) * dimensions.height
          );
        }
        ctx.stroke();
      });
  }, [markups, currentPage, dimensions, scale, selectedMarkupId]);

  // Main PDF Render Engine - Solid & Flicker-Free
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }

      pdfDoc.getPage(currentPage).then((page: any) => {
        const textLayerDiv = textLayerRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const origVp = page.getViewport({
          scale: 1.0,
          rotation: ((page.rotate || 0) + rotation) % 360,
        });
        setOriginalPageSize({ width: origVp.width, height: origVp.height });

        let cs = 1.0;
        if (zoomMode === 'fit-width') {
          cs = (containerWidth - 48) / origVp.width;
        } else if (zoomMode === 'fit-page') {
          const ch = containerRef.current ? containerRef.current.clientHeight - 48 : 800;
          cs = Math.min((containerWidth - 48) / origVp.width, ch / origVp.height);
        } else {
          cs = zoomScale;
        }

        setScale(cs);
        const dpr = window.devicePixelRatio || 1;
        const vp = page.getViewport({
          scale: cs * dpr,
          rotation: ((page.rotate || 0) + rotation) % 360,
        });
        const tvp = page.getViewport({
          scale: cs,
          rotation: ((page.rotate || 0) + rotation) % 360,
        });

        setDimensions({ width: tvp.width, height: tvp.height });
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${tvp.width}px`;
        canvas.style.height = `${tvp.height}px`;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // ignore
          }
          renderTaskRef.current = null;
        }

        const rt = page.render({ canvasContext: ctx, viewport: vp });
        renderTaskRef.current = rt;

        rt.promise
          .then(() => {
            renderTaskRef.current = null;
            const pdfjsLib = (window as any).pdfjsLib;
            if (textLayerDiv && pdfjsLib) {
              textLayerDiv.innerHTML = '';
              textLayerDiv.style.setProperty('--scale-factor', String(cs));
              page
                .getTextContent()
                .then((tc: any) => {
                  if (pdfjsLib.TextLayer) {
                    const textLayer = new pdfjsLib.TextLayer({
                      textContentSource: tc,
                      container: textLayerDiv,
                      viewport: tvp,
                    });
                    textLayer.render();
                  } else if (pdfjsLib.renderTextLayer) {
                    pdfjsLib.renderTextLayer({
                      textContentSource: tc,
                      container: textLayerDiv,
                      viewport: tvp,
                    });
                  }
                  setLoading(false);
                })
                .catch(() => setLoading(false));
            } else {
              setLoading(false);
            }
          })
          .catch((err: any) => {
            if (err.name !== 'RenderingCancelledException') {
              console.error('PDF render error:', err);
              setLoading(false);
            }
          });
      }).catch(() => setLoading(false));
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      if (textLayerRef.current) textLayerRef.current.innerHTML = '';
      setDimensions({ width: 1000, height: 1400 });
      setLoading(false);
    }
  }, [pdfDoc, currentPage, containerWidth, zoomMode, zoomScale, rotation]);

  // Pen pointer interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactionMode !== 'pen') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const hit = markups
      .filter((s) => s.page === currentPage)
      .slice()
      .reverse()
      .find((s) => isPointNearStroke(s, px, py));

    if (hit) {
      setSelectedMarkupId(hit.id);
      return;
    }

    setSelectedMarkupId(null);
    isDrawingRef.current = true;
    const x = (px / dimensions.width) * 1000;
    const y = (py / dimensions.height) * 1000;
    currentStrokeRef.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || interactionMode !== 'pen') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / dimensions.width) * 1000;
    const y = ((e.clientY - rect.top) / dimensions.height) * 1000;
    currentStrokeRef.current.push({ x, y });

    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = currentStrokeRef.current;
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#F27E20';
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(
      (pts[pts.length - 2].x / 1000) * dimensions.width,
      (pts[pts.length - 2].y / 1000) * dimensions.height
    );
    ctx.lineTo(
      (pts[pts.length - 1].x / 1000) * dimensions.width,
      (pts[pts.length - 1].y / 1000) * dimensions.height
    );
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length > 1) {
      const newStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        page: currentPage,
        color: '#F27E20',
        width: 3,
        points: [...currentStrokeRef.current],
      };
      onAddMarkup(newStroke);
    }
    currentStrokeRef.current = [];
  };

  const selectedMarkup = markups.find((s) => s.id === selectedMarkupId);
  const selectedBounds = selectedMarkup ? getStrokeBounds(selectedMarkup) : null;

  if (!pdfBase64) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 my-auto mx-auto select-none max-w-lg">
        <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary shadow-xs">
          <FileTextIcon className="size-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground tracking-tight mb-1.5">
          No Drawing Loaded
        </h3>
        <p className="text-xs text-muted-foreground mb-5 leading-relaxed max-w-sm">
          To extract structural BOQ, panel antennas, and material items, select a telecom PDF drawing or import an existing project workspace.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <Button
            onClick={onLoadPDF}
            size="sm"
            className="h-9 px-4 text-xs gap-2 cursor-pointer bg-primary text-primary-foreground font-medium rounded-lg shadow-2xs hover:bg-primary/90 transition-all"
          >
            <UploadCloudIcon className="size-4" />
            <span>Import PDF Drawing</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto shrink-0 relative ${interactionMode === 'pan' ? 'pointer-events-none' : ''}`}
      style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
    >
      {loading && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex justify-center items-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      )}

      <div
        className={`pdf-page-wrapper relative ${
          interactionMode === 'pan' ? 'select-none pointer-events-none' : 'select-text'
        }`}
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
      >
        <canvas
          ref={canvasRef}
          className="pdf-render-canvas absolute inset-0 bg-white rounded-none border-none shadow-md"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        />
        <canvas
          ref={markupCanvasRef}
          className="absolute inset-0 z-20"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            pointerEvents: interactionMode === 'pen' ? 'auto' : 'none',
            cursor: interactionMode === 'pen' ? 'crosshair' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        <div
          ref={textLayerRef}
          className={`textLayer absolute inset-0 select-text z-10 overflow-hidden ${
            interactionMode === 'select' ? 'pointer-events-auto cursor-text' : 'pointer-events-none'
          }`}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            ['--scale-factor' as any]: scale,
          }}
        />

        {(() => {
          const pageSize = originalPageSize || {
            width: dimensions.width > 0 ? (dimensions.width / (scale || 1)) : 1000,
            height: dimensions.height > 0 ? (dimensions.height / (scale || 1)) : 1400,
          };

          return (
            <>
              {!highlightAll && highlightedBbox && (
                <div
                  className="absolute border-2 border-amber-500 dark:border-amber-400 bg-amber-500/25 dark:bg-amber-400/30 ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.7)] rounded z-30 pointer-events-none transition-all duration-150 animate-pulse"
                  style={{
                    left: `${(highlightedBbox[0] / pageSize.width) * dimensions.width}px`,
                    top: `${(highlightedBbox[1] / pageSize.height) * dimensions.height}px`,
                    width: `${((highlightedBbox[2] - highlightedBbox[0]) / pageSize.width) * dimensions.width}px`,
                    height: `${((highlightedBbox[3] - highlightedBbox[1]) / pageSize.height) * dimensions.height}px`,
                  }}
                >
                  <div className="absolute -top-5 left-0 bg-amber-500 dark:bg-amber-400 text-neutral-950 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded-t shadow-md whitespace-nowrap">
                    TARGET SCHEDULE
                  </div>
                </div>
              )}

              {highlightAll &&
                pageElements &&
                pageElements.map((el, idx) => {
                  if (!el.bbox) return null;
                  const isSingleSelected =
                    highlightedBbox &&
                    highlightedBbox[0] === el.bbox[0] &&
                    highlightedBbox[1] === el.bbox[1];

                  return (
                    <div
                      key={idx}
                      className={`absolute border-2 transition-all duration-150 rounded-xs pointer-events-none z-30 ${
                        isSingleSelected
                          ? 'border-amber-400 bg-amber-400/35 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
                          : 'border-cyan-500 dark:border-cyan-400 bg-cyan-500/20 dark:bg-cyan-400/25 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                      }`}
                      style={{
                        left: `${(el.bbox[0] / pageSize.width) * dimensions.width}px`,
                        top: `${(el.bbox[1] / pageSize.height) * dimensions.height}px`,
                        width: `${((el.bbox[2] - el.bbox[0]) / pageSize.width) * dimensions.width}px`,
                        height: `${((el.bbox[3] - el.bbox[1]) / pageSize.height) * dimensions.height}px`,
                      }}
                    >
                      <div className="absolute -top-4.5 left-0 bg-cyan-600 dark:bg-cyan-500 text-white font-mono font-semibold text-[8.5px] px-1.5 py-0 rounded-t shadow-xs truncate max-w-[160px]">
                        {el.title || el.name || `Schedule #${idx + 1}`}
                      </div>
                    </div>
                  );
                })}
            </>
          );
        })()}

        {interactionMode === 'pen' && selectedMarkup && selectedBounds && (
          <div
            className="absolute z-30 flex items-center gap-1 pointer-events-auto"
            style={{
              left: `${selectedBounds.minX}px`,
              top: `${Math.max(0, selectedBounds.minY - 34)}px`,
            }}
          >
            {onDeleteMarkup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMarkup(selectedMarkup.id);
                  setSelectedMarkupId(null);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-white text-xs font-semibold shadow-lg border-0 cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 bg-destructive"
                title="Delete markup"
              >
                <Trash2Icon className="size-3" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMarkupId(null);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shadow-lg border-0 cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 bg-neutral-700"
              title="Deselect"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
