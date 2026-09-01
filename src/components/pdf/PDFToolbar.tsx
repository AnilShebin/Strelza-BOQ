import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';

interface PDFToolbarProps {
  pdfBase64: string;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  interactionMode: 'select' | 'pan' | 'pen';
  setInteractionMode: (mode: 'select' | 'pan' | 'pen') => void;
  zoomIn: () => void;
  zoomOut: () => void;
  scale: number;
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  zoomMode: 'fit-width' | 'fit-page' | 'custom';
  zoomScale: number;
  handleZoomSelect: (mode: 'fit-width' | 'fit-page' | number) => void;
  toggleFullscreen: () => void;
  showExtractionPanel: boolean;
  setShowExtractionPanel: (show: boolean) => void;
  analyzing: boolean;
  analyzedData: any;
  onGenerateBOQ?: () => void;
  extractedData?: any;
  extracting?: boolean;
  onStartExtraction?: (pages?: number[]) => void;
  onClearPageMarkups?: (page: number) => void;
  pageMarkupCount?: number;
  onUndoMarkup?: () => void;
  onRedoMarkup?: () => void;
  canUndoMarkup?: boolean;
  canRedoMarkup?: boolean;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  projectVersions?: any[];
  activeVersionId?: string;
  onSelectVersion?: (id: string) => void;
}

/**
 * Top toolbar for the PDF Viewer interface containing controls for zoom,
 * fit, rotation, page navigation, cursor tool, and BOQ execution.
 */
export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  pdfBase64,
  currentPage,
  totalPages,
  setCurrentPage,
  interactionMode,
  setInteractionMode,
  zoomIn,
  zoomOut,
  scale,
  rotation,
  setRotation,
  zoomMode,
  zoomScale,
  handleZoomSelect,
  toggleFullscreen,
  showExtractionPanel,
  setShowExtractionPanel,
  analyzing,
  analyzedData,
  onGenerateBOQ,
  extractedData,
  extracting = false,
  onStartExtraction,
  onClearPageMarkups,
  pageMarkupCount = 0,
  onUndoMarkup,
  onRedoMarkup,
  canUndoMarkup = false,
  canRedoMarkup = false,
  onSaveProject,
  onOpenProject,
  projectVersions = [],
  activeVersionId = '',
  onSelectVersion,
}) => {
  const [isZoomDropdownOpen, setIsZoomDropdownOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isVersionOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
        setIsVersionOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isVersionOpen]);

  const activeVersion = projectVersions.find(v => v.id === activeVersionId);
  const activeVersionText = activeVersion ? `Ver ${activeVersion.versionName || '1.0'}` : 'Select Ver';
  const activeVersionIndex = projectVersions.findIndex(v => v.id === activeVersionId);

  useEffect(() => {
    if (!isZoomDropdownOpen) return;
    const handleOutsideClick = () => setIsZoomDropdownOpen(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isZoomDropdownOpen]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    }
  };

  return (
    <div className="h-[40px] border-b border-border bg-bg-panel flex justify-between items-center px-4 shrink-0 select-none">
      {/* Page navigation controls */}
      <div className="flex items-center gap-2">
        <button 
          disabled={!pdfBase64 || currentPage <= 1}
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer border-0 bg-transparent"
          title="Previous Page"
        >
          <Icon name="arrow-left" size={14} />
        </button>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input 
            type="text" 
            value={pdfBase64 ? currentPage : "0"} 
            onChange={handlePageInputChange}
            disabled={!pdfBase64}
            className="w-8 h-[24px] border border-border-color rounded text-center font-semibold text-xs text-text-primary bg-bg-app focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:opacity-50" 
          />
          <span className="text-text-muted">/ {pdfBase64 ? totalPages : "0"}</span>
        </div>
        <button 
          disabled={!pdfBase64 || currentPage >= totalPages}
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer border-0 bg-transparent"
          title="Next Page"
        >
          <Icon name="arrow-right" size={14} />
        </button>

        <div className="h-3.5 w-[1px] bg-border-color-light shrink-0 self-center mx-1" />

        <button
          disabled={!pdfBase64 || !canUndoMarkup}
          onClick={onUndoMarkup}
          className={`h-7 w-7 flex items-center justify-center rounded transition-colors duration-150 border-0 bg-transparent ${
            !canUndoMarkup 
              ? 'text-text-muted/30 cursor-not-allowed' 
              : 'text-text-muted hover:bg-bg-app hover:text-text-primary cursor-pointer'
          }`}
          title="Undo Redline (Ctrl+Z)"
        >
          <Icon name="undo" size={13} />
        </button>

        <button
          disabled={!pdfBase64 || !canRedoMarkup}
          onClick={onRedoMarkup}
          className={`h-7 w-7 flex items-center justify-center rounded transition-colors duration-150 border-0 bg-transparent ${
            !canRedoMarkup 
              ? 'text-text-muted/30 cursor-not-allowed' 
              : 'text-text-muted hover:bg-bg-app hover:text-text-primary cursor-pointer'
          }`}
          title="Redo Redline (Ctrl+Y)"
        >
          <Icon name="redo" size={13} />
        </button>
      </div>

      {/* Interaction, zoom and page actions */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 border-r border-border-color-light pr-2.5">
          <button 
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('select')}
            className={`p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent ${interactionMode === 'select' ? 'text-accent-blue bg-accent-blue-light font-bold' : 'text-text-muted hover:bg-bg-app'}`}
            title="Select Text Tool"
          >
            <Icon name="select" size={14} />
          </button>
          <button 
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('pan')}
            className={`p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent ${interactionMode === 'pan' ? 'text-accent-blue bg-accent-blue-light font-bold' : 'text-text-muted hover:bg-bg-app'}`}
            title="Hand Panning Tool"
          >
            <Icon name="hand" size={14} />
          </button>
          <button 
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('pen')}
            className={`p-1.5 rounded flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent ${interactionMode === 'pen' ? 'text-[#ff3b30] bg-[#ff3b30]/10 font-bold' : 'text-text-muted hover:bg-bg-app'}`}
            title="Pen Markup Tool (Red)"
          >
            <Icon name="edit" size={14} />
          </button>
          
          <button 
            disabled={!pdfBase64 || pageMarkupCount === 0}
            onClick={() => onClearPageMarkups?.(currentPage)}
            className={`p-1.5 rounded flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent ${pageMarkupCount > 0 ? 'text-[#ff3b30] hover:bg-[#ff3b30]/10' : 'text-text-muted/40 cursor-not-allowed'}`}
            title={`Clear all ${pageMarkupCount} markup(s) on current page`}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>

        <button 
          disabled={!pdfBase64}
          onClick={zoomOut}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent"
          title="Zoom Out"
        >
          <Icon name="minus" size={14} />
        </button>
        
        <div className="relative">
          <button 
            disabled={!pdfBase64}
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomDropdownOpen(!isZoomDropdownOpen);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-text-secondary px-2 py-1 rounded hover:bg-bg-app cursor-pointer transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none border-0 bg-transparent"
            title="Zoom Presets"
          >
            <span>{Math.round(scale * 100)}%</span>
            <Icon name="chevron-down" size={10} className="opacity-70" />
          </button>

          {isZoomDropdownOpen && (
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-bg-panel border border-border-color rounded-xl shadow-xl py-1.5 z-[99] min-w-[120px] text-xs font-semibold text-text-secondary animate-in fade-in slide-in-from-top-1 duration-150">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0].map((level) => (
                <button
                  key={level}
                  onClick={() => handleZoomSelect(level)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-bg-app hover:text-text-primary flex justify-between items-center transition-colors cursor-pointer border-0 bg-transparent"
                >
                  <span>{level * 100}%</span>
                  {zoomMode === 'custom' && zoomScale === level && (
                    <span className="text-accent-blue font-bold text-[10px]">✓</span>
                  )}
                </button>
              ))}
              <div className="h-[1px] bg-border-color-light my-1" />
              <button
                onClick={() => handleZoomSelect('fit-width')}
                className="w-full text-left px-3.5 py-1.5 hover:bg-bg-app hover:text-text-primary flex justify-between items-center transition-colors cursor-pointer border-0 bg-transparent"
              >
                <span>Fit Width</span>
                {zoomMode === 'fit-width' && <span className="text-accent-blue font-bold text-[10px]">✓</span>}
              </button>
              <button
                onClick={() => handleZoomSelect('fit-page')}
                className="w-full text-left px-3.5 py-1.5 hover:bg-bg-app hover:text-text-primary flex justify-between items-center transition-colors cursor-pointer border-0 bg-transparent"
              >
                <span>Fit Page</span>
                {zoomMode === 'fit-page' && <span className="text-accent-blue font-bold text-[10px]">✓</span>}
              </button>
            </div>
          )}
        </div>

        <button 
          disabled={!pdfBase64}
          onClick={zoomIn}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent"
          title="Zoom In"
        >
          <Icon name="plus" size={14} />
        </button>
        
        <div className="w-[1px] h-4 bg-border-color-light mx-1 shrink-0" />
        
        <button 
          disabled={!pdfBase64}
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent"
          title="Rotate Clockwise"
        >
          <Icon name="rotate-cw" size={14} />
        </button>
        
        <button 
          disabled={!pdfBase64}
          onClick={toggleFullscreen}
          className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent"
          title="Fullscreen Mode"
        >
          <Icon name="fullscreen" size={14} />
        </button>
        
        <button 
          disabled={!pdfBase64}
          onClick={() => handleZoomSelect(zoomMode === 'fit-width' ? 'fit-page' : 'fit-width')}
          className={`p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-30 border-0 bg-transparent ${
            zoomMode !== 'custom' 
              ? 'text-accent-blue bg-accent-blue-light' 
              : 'text-text-muted hover:bg-bg-app hover:text-text-primary'
          }`}
          title={zoomMode === 'fit-width' ? "Fit to Page" : "Fit to Width"}
        >
          <Icon name={zoomMode === 'fit-width' ? 'fit-page' : 'fit-width'} size={14} />
        </button>

        {projectVersions.length > 0 && (
          <>
            <div className="h-3.5 w-[1px] bg-border-color-light shrink-0 self-center mx-1" />
            
            <div className="flex items-center gap-1.5 font-sans" ref={versionDropdownRef}>
              <div className="relative">
                <button
                  disabled={!pdfBase64}
                  onClick={() => setIsVersionOpen(!isVersionOpen)}
                  className="flex items-center gap-1 text-xs font-semibold text-text-secondary px-2 py-1 rounded hover:bg-bg-app cursor-pointer transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none border-0 bg-transparent h-[28px]"
                  title="Switch Project Version"
                >
                  <span>{activeVersionText}</span>
                  <Icon name="chevron-down" size={10} className="opacity-70" />
                </button>

                {isVersionOpen && (
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-bg-panel border border-border-color rounded-xl shadow-xl py-1.5 z-[999] min-w-[120px] max-h-[240px] overflow-y-auto text-xs font-semibold text-text-secondary animate-in fade-in slide-in-from-top-1 duration-150">
                    {projectVersions.map((v) => {
                      const isSelected = v.id === activeVersionId;
                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            onSelectVersion?.(v.id);
                            setIsVersionOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-bg-app hover:text-text-primary flex justify-between items-center transition-colors cursor-pointer border-0 bg-transparent font-semibold text-text-secondary"
                        >
                          <span>Version {v.versionName || '1.0'}</span>
                          {isSelected && (
                            <span className="text-accent-blue font-bold text-[10px]">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeVersion && (
                <div className="relative group/info flex items-center justify-center">
                  <button 
                    disabled={!pdfBase64}
                    className="text-text-muted hover:bg-bg-app p-1.5 rounded flex items-center justify-center transition-colors duration-150 disabled:opacity-30 border-0 bg-transparent cursor-pointer"
                  >
                    <Icon name="explain" size={14} />
                  </button>
                  
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-bg-panel border border-border-color rounded-xl p-3 shadow-xl w-[210px] z-[1000] pointer-events-none normal-case font-normal text-text-secondary leading-relaxed select-none hidden group-hover/info:block animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="text-[10px] font-bold text-text-primary mb-1.5 border-b border-border-color-light pb-1 select-none">Active Version Details</div>
                    <div className="flex justify-between gap-2 mt-1 select-none">
                      <span className="text-[9px] text-text-muted">Timestamp:</span>
                      <span className="text-[9px] font-semibold text-text-primary text-right">{activeVersion.timestamp}</span>
                    </div>
                    <div className="flex justify-between gap-2 mt-1 select-none">
                      <span className="text-[9px] text-text-muted">Markups:</span>
                      <span className="text-[9px] font-semibold text-text-primary">{activeVersion.markups?.length || 0} redlines</span>
                    </div>
                    <div className="flex justify-between gap-2 mt-1 select-none">
                      <span className="text-[9px] text-text-muted">BOQ status:</span>
                      <span className={`text-[9px] font-bold ${activeVersion.analyzedData ? 'text-[#34c759]' : 'text-text-muted'}`}>
                        {activeVersion.analyzedData ? 'Generated' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-3.5 w-[1px] bg-border-color-light shrink-0 self-center mx-1" />
          </>
        )}

        {pdfBase64 && onStartExtraction && (
          <button
            onClick={() => onStartExtraction && onStartExtraction()}
            disabled={extracting}
            className="bg-[#EE4324] hover:bg-[#EE4324]/90 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ml-1.5 disabled:opacity-50 border-0"
            title="Run AI layout and notes extraction"
          >
            <Icon name="sparkles" size={12} className={extracting ? "animate-pulse" : ""} />
            <span>{extracting ? 'Extracting...' : (extractedData || analyzedData) ? 'Extract Again' : 'Extract Data'}</span>
          </button>
        )}

        {pdfBase64 && (
          <button 
            onClick={() => setShowExtractionPanel(!showExtractionPanel)}
            className={`p-1.5 rounded flex items-center justify-center transition-colors duration-150 cursor-pointer border-0 bg-transparent ${showExtractionPanel ? 'text-accent-blue bg-accent-blue-light' : 'text-text-muted hover:bg-bg-app'}`}
            title={showExtractionPanel ? "Collapse Extraction Panel" : "Expand Extraction Panel"}
          >
            <Icon name="panel-right" size={16} />
          </button>
        )}
      </div>
    </div>
  );
};


