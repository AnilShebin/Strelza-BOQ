import React, { useRef, useEffect, useState } from 'react';
import { Icon } from '../common/Icon';

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
  onDeleteMarkup: (id: string) => void;
  onClearPageMarkups: (page: number) => void;
  highlightedBbox?: [number, number, number, number] | null;
  onHighlightBbox?: (bbox: [number, number, number, number] | null) => void;
  highlightAll?: boolean;
  pageElements?: any[];
}

export const PDFCanvas: React.FC<PDFCanvasProps> = ({
  pdfDoc, currentPage, scale, rotation, zoomMode, zoomScale, setScale,
  dimensions, setDimensions, loading, setLoading, interactionMode, isPanning,
  containerWidth, containerRef, onLoadPDF, pdfBase64,
  markups = [], onAddMarkup, onDeleteMarkup, onClearPageMarkups,
  highlightedBbox = null, onHighlightBbox,
  highlightAll = false, pageElements = [],
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of stroke.points) {
      const cx = (pt.x / 1000) * dimensions.width;
      const cy = (pt.y / 1000) * dimensions.height;
      if (cx < minX) minX = cx; if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx; if (cy > maxY) maxY = cy;
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
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const nearX = ax + t * dx, nearY = ay + t * dy;
      if (Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2) <= tolerance) return true;
    }
    return false;
  };

  useEffect(() => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    markups.filter(s => s.page === currentPage).forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      if (stroke.id === selectedMarkupId) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,200,0,0.55)';
        ctx.lineWidth = ((stroke.width || 3) + 6) * scale;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.moveTo((stroke.points[0].x / 1000) * dimensions.width, (stroke.points[0].y / 1000) * dimensions.height);
        for (let i = 1; i < stroke.points.length; i++) ctx.lineTo((stroke.points[i].x / 1000) * dimensions.width, (stroke.points[i].y / 1000) * dimensions.height);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.strokeStyle = stroke.color || '#ff0000';
      ctx.lineWidth = (stroke.width || 3) * scale;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo((stroke.points[0].x / 1000) * dimensions.width, (stroke.points[0].y / 1000) * dimensions.height);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo((stroke.points[i].x / 1000) * dimensions.width, (stroke.points[i].y / 1000) * dimensions.height);
      ctx.stroke();
    });
  }, [markups, currentPage, dimensions, scale, selectedMarkupId]);

  useEffect(() => { if (interactionMode !== 'pen') setSelectedMarkupId(null); }, [interactionMode]);
  useEffect(() => { setSelectedMarkupId(null); }, [currentPage]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactionMode !== 'pen') return;
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pageStrokes = markups.filter(s => s.page === currentPage);
    for (let i = pageStrokes.length - 1; i >= 0; i--) {
      if (isPointNearStroke(pageStrokes[i], x, y)) { setSelectedMarkupId(pageStrokes[i].id); return; }
    }
    setSelectedMarkupId(null);
    isDrawingRef.current = true;
    currentStrokeRef.current = [{ x: (x / dimensions.width) * 1000, y: (y / dimensions.height) * 1000 }];
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3 * scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.moveTo(x, y); }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || interactionMode !== 'pen') return;
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStrokeRef.current.push({ x: (x / dimensions.width) * 1000, y: (y / dimensions.height) * 1000 });
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length >= 2) {
      onAddMarkup({ id: 'markup-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), page: currentPage, points: currentStrokeRef.current, color: '#ff0000', width: 3 });
    }
    currentStrokeRef.current = [];
  };

  const selectedMarkup = selectedMarkupId ? markups.find(s => s.id === selectedMarkupId) : null;
  const selectedBounds = selectedMarkup ? getStrokeBounds(selectedMarkup) : null;
  const pageMarkupCount = markups.filter(s => s.page === currentPage).length;

  useEffect(() => {
    if (pdfDoc) {
      setLoading(true);
      const pdfjsLib = (window as any).pdfjsLib;
      pdfDoc.getPage(currentPage).then((page: any) => {
        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas) { setLoading(false); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx) { setLoading(false); return; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
        const unscaled = page.getViewport({ scale: 1, rotation: ((page.rotate || 0) + rotation) % 360 });
        setOriginalPageSize({ width: unscaled.width, height: unscaled.height });
        let cs = 1.0;
        if (zoomMode === 'fit-width') cs = containerWidth / unscaled.width;
        else if (zoomMode === 'fit-page') {
          const ch = containerRef.current ? containerRef.current.clientHeight - 48 : 800;
          cs = Math.min(containerWidth / unscaled.width, (ch > 0 ? ch : 800) / unscaled.height);
        } else cs = zoomScale;
        setScale(cs);
        const dpr = window.devicePixelRatio || 1;
        const vp = page.getViewport({ scale: cs * dpr, rotation: ((page.rotate || 0) + rotation) % 360 });
        const tvp = page.getViewport({ scale: cs, rotation: ((page.rotate || 0) + rotation) % 360 });
        setDimensions({ width: tvp.width, height: tvp.height });
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.width = tvp.width + 'px'; canvas.style.height = tvp.height + 'px';
        const rt = page.render({ canvasContext: ctx, viewport: vp });
        renderTaskRef.current = rt;
        rt.promise.then(() => {
          renderTaskRef.current = null;
          if (textLayerDiv) {
            textLayerDiv.innerHTML = '';
            page.getTextContent().then((tc: any) => {
              if (pdfjsLib.TextLayer) {
                const textLayer = new pdfjsLib.TextLayer({ textContentSource: tc, container: textLayerDiv, viewport: tvp });
                textLayer.render();
              } else if (pdfjsLib.renderTextLayer) {
                pdfjsLib.renderTextLayer({ textContentSource: tc, container: textLayerDiv, viewport: tvp });
              }
              setLoading(false);
            }).catch(() => setLoading(false));
          } else setLoading(false);
        }).catch((err: any) => { if (err.name !== 'RenderingCancelledException') { console.error('PDF render error:', err); setLoading(false); } });
      }).catch(() => setLoading(false));
    } else {
      const canvas = canvasRef.current;
      if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.width = 0; canvas.height = 0; } }
      if (textLayerRef.current) textLayerRef.current.innerHTML = '';
      setDimensions({ width: 1000, height: 1400 }); setLoading(false);
    }
  }, [pdfDoc, currentPage, containerWidth, zoomMode, zoomScale, rotation]);

  if (!pdfBase64) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 my-auto mx-auto select-none max-w-md">
        <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center mb-5 text-accent-blue">
          <Icon name="file-text" size={28} />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-2">No Drawing Loaded</h3>
        <p className="text-xs text-text-muted mb-6 leading-relaxed">To extract structural BOQ and material items, select a telecom PDF drawing using the import tool.</p>
        <button onClick={onLoadPDF} className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer border-0">
          <Icon name="plus" size={12} /><span>Import PDF Drawing</span>
        </button>
      </div>
    );
  }

  return (
    <div className={"mx-auto shrink-0 relative " + (interactionMode === "pan" ? "pointer-events-none" : "")}
      style={{ width: dimensions.width + "px", height: dimensions.height + "px" }}>
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex justify-center items-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      )}
      <div className={"pdf-page-wrapper relative " + (interactionMode === "pan" ? "select-none pointer-events-none" : "select-text")}
        style={{ width: dimensions.width + "px", height: dimensions.height + "px" }}>
        <canvas ref={canvasRef} className="absolute inset-0 bg-white rounded-none border-none shadow-md"
          style={{ width: dimensions.width + "px", height: dimensions.height + "px" }} />
        <canvas ref={markupCanvasRef} className="absolute inset-0 z-20"
          style={{ width: dimensions.width + "px", height: dimensions.height + "px",
            pointerEvents: interactionMode === "pen" ? "auto" : "none",
            cursor: interactionMode === "pen" ? "crosshair" : "default" }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
        <div ref={textLayerRef} className="textLayer absolute inset-0 select-text cursor-text z-10"
          style={{ width: dimensions.width + "px", height: dimensions.height + "px", ["--scale-factor" as any]: scale }} />

        {!highlightAll && highlightedBbox && originalPageSize && (
          <div
            className="absolute border-2 border-dashed border-accent-blue bg-accent-blue/15 shadow-[0_0_12px_rgba(var(--color-accent-blue),0.4)] rounded animate-pulse z-30 pointer-events-none"
            style={{
              left: `${(highlightedBbox[0] / originalPageSize.width) * dimensions.width}px`,
              top: `${(highlightedBbox[1] / originalPageSize.height) * dimensions.height}px`,
              width: `${((highlightedBbox[2] - highlightedBbox[0]) / originalPageSize.width) * dimensions.width}px`,
              height: `${((highlightedBbox[3] - highlightedBbox[1]) / originalPageSize.height) * dimensions.height}px`,
            }}
          />
        )}

        {highlightAll && originalPageSize && pageElements && pageElements.map((el, idx) => {
          if (!el.bbox) return null;
          const borderClass = "border-accent-blue";
          const bgClass = "bg-accent-blue/10";
          return (
            <div
              key={idx}
              className={`absolute border-2 border-dashed ${borderClass} ${bgClass} rounded-sm pointer-events-none z-30`}
              style={{
                left: `${(el.bbox[0] / originalPageSize.width) * dimensions.width}px`,
                top: `${(el.bbox[1] / originalPageSize.height) * dimensions.height}px`,
                width: `${((el.bbox[2] - el.bbox[0]) / originalPageSize.width) * dimensions.width}px`,
                height: `${((el.bbox[3] - el.bbox[1]) / originalPageSize.height) * dimensions.height}px`,
              }}
            />
          );
        })}

        {interactionMode === "pen" && selectedMarkup && selectedBounds && (
          <div className="absolute z-30 flex items-center gap-1 pointer-events-auto"
            style={{ left: selectedBounds.minX + "px", top: Math.max(0, selectedBounds.minY - 34) + "px" }}>
            <button onClick={(e) => { e.stopPropagation(); onDeleteMarkup(selectedMarkup.id); setSelectedMarkupId(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-white text-xs font-semibold shadow-lg border-0 cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ background: "rgba(220,38,38,0.92)", backdropFilter: "blur(4px)" }} title="Delete markup">
              <Icon name="trash" size={10} /><span>Delete</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setSelectedMarkupId(null); }}
              className="flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shadow-lg border-0 cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ background: "rgba(80,80,80,0.85)", backdropFilter: "blur(4px)" }} title="Deselect">
              <Icon name="x" size={10} />
            </button>
          </div>
        )}


      </div>
    </div>
  );
};
