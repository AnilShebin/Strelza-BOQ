import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileTextIcon, SearchIcon, PlusIcon, PanelLeftCloseIcon } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = React.useState('');
  const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  const filteredPages = searchQuery.trim()
    ? pagesArray.filter((p) => p.toString().includes(searchQuery.trim()))
    : pagesArray;

  return (
    <div className="w-56 border-r border-border/80 bg-card flex flex-col shrink-0 select-none">
      {/* Panel Header */}
      <div className="h-10 flex items-center justify-between px-3.5 border-b border-border/80 shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Pages</h3>
          {totalPages > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/60">
              {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Search Pages Box */}
      <div className="p-2.5 border-b border-border/80 bg-muted/10 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!pdfName}
            className="h-7 pl-7.5 pr-2 text-xs bg-background/80 border-border/70 rounded-md"
          />
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3.5 items-center">
        {pdfName && filteredPages.length > 0 ? (
          filteredPages.map((pageNum) => {
            const isActive = currentPage === pageNum;
            return (
              <div
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className="flex flex-col items-center gap-1.5 cursor-pointer w-full group"
              >
                <div
                  className={`w-36 h-48 border rounded-lg p-2 overflow-hidden transition-all duration-150 flex flex-col justify-between shadow-2xs ${
                    isActive
                      ? 'border-primary ring-2 ring-primary/20 bg-background'
                      : 'border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-border/40 pb-1 mb-1">
                    <span className="text-[8.5px] font-mono font-semibold text-muted-foreground">
                      PAGE {pageNum}
                    </span>
                    <FileTextIcon className="size-2.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center opacity-30 gap-1">
                    <div className="w-16 h-1.5 bg-muted-foreground/30 rounded-full" />
                    <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
                    <div className="w-8 h-1.5 bg-muted-foreground/20 rounded-full" />
                  </div>
                </div>
                <span
                  className={`text-xs font-mono transition-colors ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {pageNum}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10 px-2 h-full gap-2">
            <span className="text-xs text-muted-foreground font-normal">No drawing loaded</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadPDF}
              className="h-7 text-xs gap-1 cursor-pointer border-dashed border-border"
            >
              <PlusIcon className="size-3" />
              <span>Import Drawing</span>
            </Button>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {pdfName && (
        <div className="p-2.5 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-between text-xs">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            -
          </Button>
          <span className="text-[11px] font-mono text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            +
          </Button>
        </div>
      )}
    </div>
  );
};
