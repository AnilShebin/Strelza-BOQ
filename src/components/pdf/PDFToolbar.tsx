import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Undo2Icon,
  Redo2Icon,
  MousePointerIcon,
  HandIcon,
  PenToolIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  ChevronDownIcon,
  RotateCwIcon,
  MaximizeIcon,
  SparklesIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  LayersIcon,
  FolderOpenIcon,
  SaveIcon,
} from 'lucide-react';

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
  const activeVersion = projectVersions.find((v) => v.id === activeVersionId);
  const activeVersionText = activeVersion ? `Ver ${activeVersion.versionName || '1.0'}` : 'Version 1.0';

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    }
  };

  return (
    <div className="h-10 border-b border-border/80 bg-card/60 backdrop-blur-md flex justify-between items-center px-3.5 shrink-0 select-none">
      {/* Start of Toolbar: Open Project, Save Project, Page Navigation & Undo/Redo */}
      <div className="flex items-center gap-1.5">
        {onOpenProject && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenProject}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            title="Open Project File (.json)"
          >
            <FolderOpenIcon className="size-3.5" />
          </Button>
        )}

        {onSaveProject && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSaveProject}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            title="Save Project File (.json)"
          >
            <SaveIcon className="size-3.5" />
          </Button>
        )}

        {(onOpenProject || onSaveProject) && (
          <div className="h-3.5 w-[1px] bg-border/80 shrink-0 self-center mx-0.5" />
        )}

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64 || currentPage <= 1}
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeftIcon className="size-3.5" />
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="text"
            value={pdfBase64 ? currentPage : '0'}
            onChange={handlePageInputChange}
            disabled={!pdfBase64}
            className="w-8 h-6 border border-border/70 rounded text-center font-medium text-xs text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <span className="text-[11px] text-muted-foreground/80 font-normal">
            / {pdfBase64 ? totalPages : '0'}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64 || currentPage >= totalPages}
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          title="Next Page"
        >
          <ChevronRightIcon className="size-3.5" />
        </Button>

        <div className="h-3.5 w-[1px] bg-border/80 shrink-0 self-center mx-1" />

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64 || !canUndoMarkup}
          onClick={onUndoMarkup}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
          title="Undo Redline (Ctrl+Z)"
        >
          <Undo2Icon className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64 || !canRedoMarkup}
          onClick={onRedoMarkup}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
          title="Redo Redline (Ctrl+Y)"
        >
          <Redo2Icon className="size-3.5" />
        </Button>
      </div>

      {/* Interaction Mode & Zoom Controls */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 border-r border-border/80 pr-2">
          <Button
            variant={interactionMode === 'select' ? 'secondary' : 'ghost'}
            size="icon"
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('select')}
            className={`size-7 rounded-md ${interactionMode === 'select' ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="Select Text Tool"
          >
            <MousePointerIcon className="size-3.5" />
          </Button>

          <Button
            variant={interactionMode === 'pan' ? 'secondary' : 'ghost'}
            size="icon"
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('pan')}
            className={`size-7 rounded-md ${interactionMode === 'pan' ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="Hand Panning Tool"
          >
            <HandIcon className="size-3.5" />
          </Button>

          <Button
            variant={interactionMode === 'pen' ? 'secondary' : 'ghost'}
            size="icon"
            disabled={!pdfBase64}
            onClick={() => setInteractionMode('pen')}
            className={`size-7 rounded-md ${interactionMode === 'pen' ? 'text-rose-500 bg-rose-500/10' : 'text-muted-foreground'}`}
            title="Pen Markup Tool (Red)"
          >
            <PenToolIcon className="size-3.5" />
          </Button>

          {pageMarkupCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!pdfBase64}
              onClick={() => onClearPageMarkups?.(currentPage)}
              className="size-7 rounded-md text-rose-500 hover:bg-rose-500/10"
              title={`Clear ${pageMarkupCount} markup(s) on current page`}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Zoom Controls */}
        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64}
          onClick={zoomOut}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          title="Zoom Out"
        >
          <ZoomOutIcon className="size-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!pdfBase64}
              className="h-7 px-2 text-xs font-medium text-foreground gap-1 hover:bg-muted/60"
            >
              <span>{Math.round(scale * 100)}%</span>
              <ChevronDownIcon className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-36 text-xs">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">Zoom Presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => handleZoomSelect(level)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span>{level * 100}%</span>
                {zoomMode === 'custom' && zoomScale === level && <span className="text-primary font-bold">✓</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleZoomSelect('fit-width')} className="text-xs cursor-pointer">
              <span>Fit Width</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleZoomSelect('fit-page')} className="text-xs cursor-pointer">
              <span>Fit Page</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64}
          onClick={zoomIn}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          title="Zoom In"
        >
          <ZoomInIcon className="size-3.5" />
        </Button>

        <div className="h-3.5 w-[1px] bg-border/80 shrink-0 self-center mx-1" />

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64}
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          title="Rotate Clockwise"
        >
          <RotateCwIcon className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={!pdfBase64}
          onClick={toggleFullscreen}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          title="Fullscreen Mode"
        >
          <MaximizeIcon className="size-3.5" />
        </Button>

        {/* Project Versions */}
        {projectVersions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 rounded-md border-border/70">
                <LayersIcon className="size-3 text-muted-foreground" />
                <span>{activeVersionText}</span>
                <ChevronDownIcon className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">Versions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projectVersions.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  onClick={() => onSelectVersion?.(v.id)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>Version {v.versionName || '1.0'}</span>
                  {v.id === activeVersionId && <span className="text-primary font-bold">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Extract Action Button */}
        {pdfBase64 && onStartExtraction && (
          <Button
            size="sm"
            onClick={() => onStartExtraction && onStartExtraction()}
            disabled={extracting}
            className="h-7 px-3 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-medium rounded-lg shadow-2xs hover:bg-primary/90 ml-1"
          >
            <SparklesIcon className={`size-3.5 ${extracting ? 'animate-pulse' : ''}`} />
            <span>{extracting ? 'Extracting...' : (extractedData || analyzedData) ? 'Extract Again' : 'Extract Data'}</span>
          </Button>
        )}

        {/* Toggle Panel Button */}
        {pdfBase64 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExtractionPanel(!showExtractionPanel)}
            className={`size-7 rounded-md ${showExtractionPanel ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title={showExtractionPanel ? 'Collapse Extraction Panel' : 'Expand Extraction Panel'}
          >
            {showExtractionPanel ? <PanelRightCloseIcon className="size-3.5" /> : <PanelRightOpenIcon className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
};
