import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileTextIcon, SearchIcon, PlusIcon, LayersIcon } from 'lucide-react';

interface ThumbnailsPanelProps {
  pdfName?: string;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onLoadPDF: () => void;
}

export const ThumbnailsPanel: React.FC<ThumbnailsPanelProps> = ({
  pdfName,
  totalPages,
  currentPage,
  setCurrentPage,
  onLoadPDF,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const total = Math.max(0, totalPages || 0);
  const pagesArray = Array.from({ length: total }, (_, i) => i + 1);

  const filteredPages = searchQuery.trim()
    ? pagesArray.filter((p) => p.toString().includes(searchQuery.trim()))
    : pagesArray;

  return (
    <div className="w-56 border-r border-border/80 bg-card flex flex-col shrink-0 select-none shadow-xs z-10">
      {/* Header */}
      <div className="h-11 px-3 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/25">
        <div className="flex items-center gap-2">
          <LayersIcon className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Sheets</h3>
          {total > 0 && (
            <Badge variant="secondary" className="text-[9.5px] font-mono h-4 px-1.5 py-0">
              {total}
            </Badge>
          )}
        </div>
      </div>

      {/* Search Input */}
      {total > 1 && (
        <div className="p-2 border-b border-border/60 bg-muted/10 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search sheet #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 pr-2 text-xs bg-background/80 border-border/60 rounded-md"
            />
          </div>
        </div>
      )}

      {/* Sheet Thumbnails List */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 items-center">
        {pdfName && filteredPages.length > 0 ? (
          filteredPages.map((pageNum) => {
            const isActive = currentPage === pageNum;
            return (
              <div
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className="flex flex-col items-center gap-1 cursor-pointer w-full group"
              >
                <div
                  className={`w-44 h-32 rounded-xl border p-2 relative overflow-hidden transition-all duration-150 flex flex-col justify-between shadow-2xs ${
                    isActive
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.04]'
                      : 'border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs'
                  }`}
                >
                  {/* Miniature CAD Blueprint Background Pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:6px_6px] opacity-40 pointer-events-none" />

                  {/* Header in Thumbnail */}
                  <div className="relative z-1 flex justify-between items-center border-b border-border/40 pb-1">
                    <span className="text-[8px] font-mono font-semibold text-foreground">
                      SHEET {pageNum}
                    </span>
                    <FileTextIcon className="size-2.5 text-muted-foreground" />
                  </div>

                  {/* Wireframe Mockup Lines */}
                  <div className="relative z-1 flex flex-col justify-center items-center opacity-40 gap-1 my-auto">
                    <div className="w-24 h-1 bg-muted-foreground/30 rounded-full" />
                    <div className="w-16 h-1 bg-muted-foreground/20 rounded-full" />
                    <div className="w-20 h-1 bg-muted-foreground/20 rounded-full" />
                  </div>

                  {/* Title Block Mock */}
                  <div className="relative z-1 self-end bg-muted/80 border border-border/50 rounded-xs px-1 py-0.2 text-[6.5px] font-mono text-muted-foreground">
                    DWG-{pageNum}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-mono transition-colors ${
                    isActive
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  Page {pageNum}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12 px-2 h-full gap-2.5 my-auto">
            <FileTextIcon className="size-8 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground font-normal">
              No drawing active
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadPDF}
              className="h-7 text-xs gap-1.5 cursor-pointer border-dashed border-border mt-1"
            >
              <PlusIcon className="size-3 text-primary" />
              <span>Open PDF</span>
            </Button>
          </div>
        )}
      </div>

      {/* Footer Quick Stepper */}
      {pdfName && total > 1 && (
        <div className="p-2 border-t border-border/70 bg-muted/20 shrink-0 flex items-center justify-between text-xs">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            -
          </Button>
          <span className="text-[10.5px] font-mono text-muted-foreground">
            {currentPage} of {total}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={currentPage >= total}
            onClick={() => setCurrentPage(Math.min(total, currentPage + 1))}
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            +
          </Button>
        </div>
      )}
    </div>
  );
};
