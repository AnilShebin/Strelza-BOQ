import React from 'react';
import { Icon } from '../common/Icon';

interface ThumbnailsPanelProps {
  pdfName?: string;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onLoadPDF: () => void;
}

/**
 * PDF thumbnails navigation list selector.
 */
export const ThumbnailsPanel: React.FC<ThumbnailsPanelProps> = ({
  pdfName,
  totalPages,
  currentPage,
  setCurrentPage,
  onLoadPDF,
}) => {
  const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="w-[240px] border-r border-border bg-background flex flex-col shrink-0 select-none">
      <div className="h-[48px] flex items-center justify-between px-4 border-b border-border-light shrink-0">
        <h3 className="text-[13px] font-semibold text-text-primary">Pages</h3>
        <button className="text-text-muted hover:bg-border-color-light hover:text-text-primary p-1 rounded transition-colors duration-150 border-0 bg-transparent">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="p-3 border-b border-border-light shrink-0">
        <div className="relative">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search pages"
            disabled={!pdfName}
            className="w-full h-8 bg-bg-app border border-border-color rounded-md pl-8 pr-3 text-xs text-text-secondary cursor-pointer hover:border-text-muted transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 items-center">
        {pdfName ? (
          pagesArray.map((pageNum) => {
            const isActive = currentPage === pageNum;
            return (
              <div 
                key={pageNum} 
                onClick={() => setCurrentPage(pageNum)}
                className="flex flex-col items-center gap-1.5 cursor-pointer w-full"
              >
                <div 
                  className={`bg-white w-[140px] h-[180px] border-2 rounded p-2 overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-sm hover:border-primary/50 ${
                    isActive ? 'border-primary shadow-[0_0_0_3px_rgba(37,99,235,0.15)]' : 'border-border'
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                    <span className="text-[8px] font-bold text-slate-400">PAGE {pageNum}</span>
                    <Icon name="file-text" size={8} className="text-slate-400" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center opacity-40">
                    <Icon name="document" size={24} className="text-slate-300" />
                    <div className="w-12 h-1 bg-slate-200 mt-2 rounded-full" />
                    <div className="w-8 h-1 bg-slate-100 mt-1 rounded-full" />
                  </div>
                </div>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-primary font-bold' : 'text-text-secondary'}`}>
                  {pageNum}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10 px-2 h-full">
            <span className="text-xs text-muted-foreground font-medium">No pages loaded</span>
            <button 
              onClick={onLoadPDF}
              className="text-[11px] font-bold text-primary hover:underline mt-2 flex items-center gap-1 border-0 bg-transparent cursor-pointer"
            >
              <Icon name="plus" size={10} />
              <span>Import Drawing</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border-color-light bg-bg-panel shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button 
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="text-xs font-bold text-text-secondary w-4 h-4 flex items-center justify-center disabled:opacity-30 border-0 bg-transparent cursor-pointer"
          >
            -
          </button>
          <div className="flex-1 h-[4px] bg-border-color-light rounded-full relative">
            <div 
              className="h-full bg-accent-blue rounded-full" 
              style={{ width: pdfName ? `${(currentPage / totalPages) * 100}%` : '0%' }} 
            />
            <div 
              className="w-2.5 h-2.5 bg-accent-blue rounded-full absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer shadow-sm" 
              style={{ left: pdfName ? `${(currentPage / totalPages) * 100}%` : '0%' }} 
            />
          </div>
          <button 
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            className="text-xs font-bold text-text-secondary w-4 h-4 flex items-center justify-center disabled:opacity-30 border-0 bg-transparent cursor-pointer"
          >
            +
          </button>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            <button className="text-text-muted hover:bg-border-color-light hover:text-text-secondary p-1 rounded transition-colors duration-150 border-0 bg-transparent cursor-pointer">
              <Icon name="grid" size={12} />
            </button>
            <button className="text-text-muted hover:bg-border-color-light hover:text-text-secondary p-1 rounded transition-colors duration-150 border-0 bg-transparent cursor-pointer">
              <Icon name="layout-single" size={12} />
            </button>
          </div>
          
          <div className="flex gap-1">
            <button 
              onClick={onLoadPDF}
              className="text-text-muted hover:bg-border-color-light hover:text-text-secondary p-1 rounded transition-colors duration-150 border-0 bg-transparent cursor-pointer"
            >
              <Icon name="plus" size={12} />
            </button>
            <button className="text-text-muted hover:bg-border-color-light hover:text-text-secondary p-1 rounded transition-colors duration-150 border-0 bg-transparent cursor-pointer">
              <Icon name="trash" size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
