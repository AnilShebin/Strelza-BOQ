import React, { useState } from 'react';
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
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoveHorizontalIcon,
  ScanIcon,
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
  toggleFullscreen?: () => void;
  isFullscreen?: boolean;
  showExtractionPanel: boolean;
  setShowExtractionPanel: (show: boolean) => void;
  showThumbnails?: boolean;
  setShowThumbnails?: (show: boolean) => void;
  onClearPageMarkups?: (page: number) => void;
  pageMarkupCount?: number;
  onUndoMarkup?: () => void;
  onRedoMarkup?: () => void;
  canUndoMarkup?: boolean;
  canRedoMarkup?: boolean;
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
  isFullscreen = false,
  showExtractionPanel,
  setShowExtractionPanel,
  showThumbnails = false,
  setShowThumbnails,
  onClearPageMarkups,
  pageMarkupCount = 0,
  onUndoMarkup,
  onRedoMarkup,
  canUndoMarkup = false,
  canRedoMarkup = false,
}) => {
  const [pageInput, setPageInput] = useState<string>(currentPage.toString());

  React.useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const currentZoomPercent = Math.round(
    (zoomMode === 'custom' ? zoomScale : scale) * 100
  );

  return (
    <div className="h-11 px-3 border-b border-border/80 bg-card/95 backdrop-blur-xs flex items-center justify-between shrink-0 select-none z-20 gap-3">
      {/* Left Section: Thumbnails Toggle & Page Navigation */}
      <div className="flex items-center gap-1.5 shrink-0">
        {setShowThumbnails && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`size-7 rounded-md cursor-pointer ${
              showThumbnails
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={showThumbnails ? 'Hide Thumbnails' : 'Show Thumbnails'}
          >
            {showThumbnails ? (
              <PanelLeftCloseIcon className="size-3.5" />
            ) : (
              <PanelLeftOpenIcon className="size-3.5" />
            )}
          </Button>
        )}

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!pdfBase64 || currentPage <= 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>

          <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              disabled={!pdfBase64}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              className="w-8 h-6.5 text-center text-xs font-mono font-medium bg-muted/50 border border-border/70 rounded focus:border-primary focus:outline-none text-foreground disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-muted-foreground">
              / {totalPages || 1}
            </span>
          </form>

          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!pdfBase64 || currentPage >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Next Page (Right Arrow)"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Right / End Section: Tool Modes, Fit Controls, Zoom, Rotation, Fullscreen & Extraction */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {/* Interaction Mode Group */}
        <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setInteractionMode('select')}
            className={`size-6 rounded-md cursor-pointer transition-colors ${
              interactionMode === 'select'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Selection Tool (V)"
          >
            <MousePointerIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setInteractionMode('pan')}
            className={`size-6 rounded-md cursor-pointer transition-colors ${
              interactionMode === 'pan'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Hand Tool / Pan (H)"
          >
            <HandIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setInteractionMode('pen')}
            className={`size-6 rounded-md cursor-pointer transition-colors ${
              interactionMode === 'pen'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Markup Pen (P)"
          >
            <PenToolIcon className="size-3.5" />
          </Button>
        </div>

        {/* Pen Undo/Redo/Clear Actions */}
        {interactionMode === 'pen' && (
          <div className="flex items-center gap-0.5 pl-1 border-l border-border/60">
            {onUndoMarkup && (
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!canUndoMarkup}
                onClick={onUndoMarkup}
                className="size-6.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Undo Stroke (Ctrl+Z)"
              >
                <Undo2Icon className="size-3" />
              </Button>
            )}

            {onRedoMarkup && (
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!canRedoMarkup}
                onClick={onRedoMarkup}
                className="size-6.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Redo Stroke (Ctrl+Y)"
              >
                <Redo2Icon className="size-3" />
              </Button>
            )}

            {onClearPageMarkups && pageMarkupCount > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onClearPageMarkups(currentPage)}
                className="size-6.5 text-destructive hover:bg-destructive/10"
                title="Clear Page Markups"
              >
                <Trash2Icon className="size-3" />
              </Button>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Dedicated Fit Width & Fit Page Buttons */}
        <Button
          variant={zoomMode === 'fit-width' ? 'secondary' : 'ghost'}
          size="icon-xs"
          disabled={!pdfBase64}
          onClick={() => handleZoomSelect('fit-width')}
          className={`size-7 rounded-md cursor-pointer ${
            zoomMode === 'fit-width'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Fit Width"
        >
          <MoveHorizontalIcon className="size-3.5" />
        </Button>

        <Button
          variant={zoomMode === 'fit-page' ? 'secondary' : 'ghost'}
          size="icon-xs"
          disabled={!pdfBase64}
          onClick={() => handleZoomSelect('fit-page')}
          className={`size-7 rounded-md cursor-pointer ${
            zoomMode === 'fit-page'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Fit Page"
        >
          <ScanIcon className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!pdfBase64}
            onClick={zoomOut}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOutIcon className="size-3.5" />
          </Button>

          {/* Zoom Preset Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                disabled={!pdfBase64}
                className="h-6.5 px-2 text-[11px] font-mono font-medium gap-1 bg-background hover:bg-muted border-border/70"
              >
                <span>{currentZoomPercent}%</span>
                <ChevronDownIcon className="size-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 text-xs">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground font-semibold uppercase">
                Zoom Presets
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleZoomSelect('fit-width')}>
                Fit Width
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect('fit-page')}>
                Fit Page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleZoomSelect(0.5)}>
                50%
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect(0.75)}>
                75%
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect(1.0)}>
                100% (Actual)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect(1.25)}>
                125%
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect(1.5)}>
                150%
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleZoomSelect(2.0)}>
                200%
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!pdfBase64}
            onClick={zoomIn}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Zoom In (Ctrl +)"
          >
            <ZoomInIcon className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Rotate Tool */}
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!pdfBase64}
          onClick={() => setRotation((prev) => (prev + 90) % 360)}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Rotate 90° Clockwise"
        >
          <RotateCwIcon className="size-3.5" />
        </Button>

        {/* Fullscreen Tool */}
        {toggleFullscreen && (
          <Button
            variant={isFullscreen ? 'secondary' : 'ghost'}
            size="icon-xs"
            disabled={!pdfBase64}
            onClick={toggleFullscreen}
            className={`size-7 rounded-md cursor-pointer ${
              isFullscreen
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
          >
            {isFullscreen ? (
              <MinimizeIcon className="size-3.5" />
            ) : (
              <MaximizeIcon className="size-3.5" />
            )}
          </Button>
        )}

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Toggle Right Panel Button */}
        <Button
          variant={showExtractionPanel ? 'secondary' : 'ghost'}
          size="icon-xs"
          onClick={() => setShowExtractionPanel(!showExtractionPanel)}
          className={`size-7 rounded-md cursor-pointer ${
            showExtractionPanel
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={showExtractionPanel ? 'Collapse Panel' : 'Expand Panel'}
        >
          {showExtractionPanel ? (
            <PanelRightCloseIcon className="size-3.5" />
          ) : (
            <PanelRightOpenIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
};
