import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  SparklesIcon,
  XIcon,
  AlertTriangleIcon,
  ListOrderedIcon,
  LayersIcon,
  FileSpreadsheetIcon,
} from 'lucide-react';

export type StructuredContent =
  | {
      headers: string[];
      rows: unknown[][];
    }
  | {
      fields: Record<string, unknown>;
    }
  | Record<string, unknown>;

export interface DocumentElement {
  page: number;
  type: 'structured' | 'unstructured';
  title: string | null;
  content: StructuredContent | string;
  bbox: [number, number, number, number] | null;
  confidence: number | null;
  is_reconciled?: boolean;
  reconciliation_source?: string;
}

interface PDFExtractionPanelProps {
  analyzing: boolean;
  analysisError: string | null;
  analyzedData: { elements?: DocumentElement[] } | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  columnWidths: Record<string, number[]>;
  startColumnResize: (e: React.MouseEvent, elementIdx: number, colIdx: number) => void;
  panelWidth: number;
  startResize: (e: React.MouseEvent) => void;
  isResizing: boolean;
  setShowExtractionPanel: (show: boolean) => void;
  onGenerateBOQ?: () => void;
  onViewDashboard?: () => void;
  extractedData?: any;
  extracting?: boolean;
  onStartExtraction?: (pages?: number[]) => void;
  onReextractPage?: (page: number) => void;
  extractingPage?: boolean;
  onHighlightBbox?: (bbox: [number, number, number, number] | null) => void;
  highlightedBbox?: [number, number, number, number] | null;
  highlightAll?: boolean;
  onToggleHighlightAll?: () => void;
  totalPages?: number;
  selectedPages: Set<number>;
  setSelectedPages: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export const PDFExtractionPanel: React.FC<PDFExtractionPanelProps> = ({
  analyzing,
  analysisError,
  analyzedData,
  currentPage,
  setCurrentPage,
  columnWidths,
  startColumnResize,
  panelWidth,
  startResize,
  isResizing,
  setShowExtractionPanel,
  onGenerateBOQ,
  onViewDashboard,
  extractedData,
  extracting = false,
  onStartExtraction,
  onReextractPage,
  extractingPage = false,
  onHighlightBbox,
  highlightedBbox = null,
  highlightAll = false,
  onToggleHighlightAll,
  totalPages = 1,
  selectedPages,
  setSelectedPages,
}) => {
  const pagesWithElements = Array.from(
    new Set(analyzedData?.elements?.map((el) => el.page) || [])
  ) as number[];
  pagesWithElements.sort((a, b) => a - b);

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="border-l border-border/80 bg-card flex flex-col shrink-0 min-h-0 overflow-hidden text-foreground relative select-none"
    >
      <div
        onMouseDown={startResize}
        className={`absolute top-0 bottom-0 left-0 w-1 cursor-col-resize z-50 hover:bg-primary/40 transition-colors ${
          isResizing ? 'bg-primary/80 w-1' : ''
        }`}
      />

      {/* Header */}
      <div className="h-10 px-3.5 border-b border-border/80 flex justify-between items-center shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <ListOrderedIcon className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Extraction Results</h3>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 select-none" title="Highlight all bounding boxes on page">
            <span className="text-[10px] font-medium text-muted-foreground">HIGHLIGHT</span>
            <button
              onClick={() => onToggleHighlightAll?.()}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none border-0 ${
                highlightAll ? 'bg-primary' : 'bg-muted border border-border/80'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                  highlightAll ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowExtractionPanel(false)}
            className="size-6 text-muted-foreground hover:text-foreground rounded"
            title="Hide Panel"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 select-none">
        {analyzing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 animate-pulse">
              <div className="h-4 bg-muted/60 rounded w-1/3" />
              <div className="h-28 bg-muted/40 rounded-lg" />
            </div>
            <div className="flex flex-col gap-1.5 animate-pulse">
              <div className="h-4 bg-muted/60 rounded w-1/2" />
              <div className="h-24 bg-muted/40 rounded-lg" />
            </div>
          </div>
        ) : analysisError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-rose-500/30 bg-rose-500/5 rounded-xl my-auto select-none gap-2">
            <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangleIcon className="size-5" />
            </div>
            <h4 className="text-xs font-semibold text-foreground">Extraction Failed</h4>
            <p className="text-[11px] text-rose-400 leading-relaxed max-w-xs">{analysisError}</p>
            {onGenerateBOQ && (
              <Button
                size="sm"
                onClick={onGenerateBOQ}
                className="h-7 text-xs bg-primary text-primary-foreground mt-2"
              >
                <span>Retry Extraction</span>
              </Button>
            )}
          </div>
        ) : analyzedData ? (
          (() => {
            const currentPageElements =
              analyzedData?.elements?.filter((el) => el.page === currentPage) || [];

            return (
              <>
                {currentPageElements.length > 0 ? (
                  currentPageElements.map((el, elIdx) => {
                    const isHighlighted =
                      highlightedBbox &&
                      el.bbox &&
                      highlightedBbox[0] === el.bbox[0] &&
                      highlightedBbox[1] === el.bbox[1] &&
                      highlightedBbox[2] === el.bbox[2] &&
                      highlightedBbox[3] === el.bbox[3];

                    return (
                      <div
                        key={elIdx}
                        onClick={() => {
                          if (el.bbox) {
                            if (isHighlighted) onHighlightBbox?.(null);
                            else onHighlightBbox?.(el.bbox);
                          }
                        }}
                        className={`flex flex-col gap-2 p-3 rounded-lg transition-all cursor-pointer border select-text ${
                          isHighlighted
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                            : 'bg-muted/30 border-border/70 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex justify-between items-center border-b border-border/40 pb-1.5 select-none">
                          <span className="text-[11px] font-semibold text-foreground truncate">
                            {el.title ||
                              (el.type === 'structured'
                                ? 'Extracted Structured Data'
                                : 'Extracted Note')}
                          </span>

                          {el.confidence !== null && el.confidence !== undefined && (
                            <span className="bg-primary/10 text-primary text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                              {(el.confidence * 100).toFixed(0)}% match
                            </span>
                          )}
                        </div>

                        {el.type === 'structured' ? (
                          (() => {
                            const content = el.content;
                            if (!content || typeof content !== 'object') {
                              return (
                                <div className="text-[10px] text-muted-foreground italic select-none">
                                  Empty structured content.
                                </div>
                              );
                            }

                            if (
                              'headers' in content &&
                              'rows' in content &&
                              Array.isArray(content.rows)
                            ) {
                              const headers = (content.headers || []) as string[];
                              const rows = (content.rows || []) as any[][];
                              const tableKey = `element-${currentPage}-${elIdx}`;
                              const currentWidths = columnWidths[tableKey] || [];

                              return (
                                <div className="overflow-x-auto border border-border/70 rounded-md bg-background max-h-[calc(45vh-80px)]">
                                  <table
                                    className="text-left border-separate text-[10px]"
                                    style={{
                                      borderSpacing: 0,
                                      tableLayout: currentWidths.length > 0 ? 'fixed' : 'auto',
                                      width: currentWidths.length > 0 ? 'max-content' : '100%',
                                      minWidth: '100%',
                                    }}
                                  >
                                    <thead>
                                      <tr className="bg-muted/80 text-foreground font-semibold select-none border-b border-border/70">
                                        {headers.map((hdr, hIdx) => {
                                          const colWidth = currentWidths[hIdx];
                                          return (
                                            <th
                                              key={hIdx}
                                              style={{
                                                width: colWidth ? `${colWidth}px` : undefined,
                                                minWidth: '60px',
                                              }}
                                              className="sticky top-0 bg-muted/95 z-10 py-1.5 px-2 font-medium whitespace-nowrap border-r border-b border-border/70 last:border-r-0"
                                            >
                                              <span className="truncate block pr-2">{hdr}</span>
                                            </th>
                                          );
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((row, rIdx) => (
                                        <tr
                                          key={rIdx}
                                          className="border-b border-border/40 last:border-b-0 hover:bg-muted/30"
                                        >
                                          {Array.isArray(row) &&
                                            row.map((cell, cIdx) => {
                                              const colWidth = currentWidths[cIdx];
                                              return (
                                                <td
                                                  key={cIdx}
                                                  style={{
                                                    width: colWidth ? `${colWidth}px` : undefined,
                                                    minWidth: '60px',
                                                  }}
                                                  className="py-1 px-2 border-r border-border/40 last:border-r-0 font-normal text-muted-foreground whitespace-pre-wrap break-words text-[10px]"
                                                >
                                                  {String(cell ?? '')}
                                                </td>
                                              );
                                            })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            }

                            if (
                              'fields' in content &&
                              content.fields &&
                              typeof content.fields === 'object'
                            ) {
                              const fields = content.fields as Record<string, any>;
                              return (
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px] p-2 bg-background border border-border/70 rounded-md">
                                  {Object.entries(fields).map(([key, val]) => (
                                    <React.Fragment key={key}>
                                      <div className="font-semibold text-foreground truncate">
                                        {key}:
                                      </div>
                                      <div className="text-muted-foreground break-words font-mono">
                                        {String(val ?? '')}
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px] p-2 bg-background border border-border/70 rounded-md">
                                {Object.entries(content).map(([key, val]) => (
                                  <React.Fragment key={key}>
                                    <div className="font-semibold text-foreground truncate">
                                      {key}:
                                    </div>
                                    <div className="text-muted-foreground break-words font-mono">
                                      {typeof val === 'object' && val !== null
                                        ? JSON.stringify(val)
                                        : String(val ?? '')}
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="bg-background border-l-2 border-primary p-2.5 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap select-text font-mono rounded-r-md">
                            {String(el.content ?? '')}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-xl my-4 select-none gap-2">
                    <FileSpreadsheetIcon className="size-7 text-muted-foreground/50" />
                    <h4 className="text-xs font-semibold text-foreground">
                      No Data on Page {currentPage}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      No structured schedule or equipment tables found on this page.
                    </p>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <div className="flex-1 flex flex-col p-2 bg-card min-h-0 select-none gap-3">
            <div>
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 text-primary">
                <SparklesIcon className="size-4" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">AI Drawing Scan Ready</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Select drawing sheets to scan for Bill of Quantities schedule tables.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const pages = new Set<number>();
                  for (let i = 1; i <= (totalPages || 1); i++) pages.add(i);
                  setSelectedPages(pages);
                }}
                className="h-6 px-2 text-[10px]"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPages(new Set())}
                className="h-6 px-2 text-[10px]"
              >
                Select None
              </Button>
            </div>

            <div className="flex-1 min-h-0 border border-border/70 rounded-lg bg-background overflow-y-auto p-2.5 grid grid-cols-2 gap-1.5">
              {Array.from({ length: totalPages || 1 }).map((_, index) => {
                const pageNum = index + 1;
                const isSelected = selectedPages.has(pageNum);
                return (
                  <label
                    key={pageNum}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                        : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        setSelectedPages((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(pageNum);
                          else next.delete(pageNum);
                          return next;
                        });
                      }}
                      className="size-3.5"
                    />
                    <span className="text-[11px]">Page {pageNum}</span>
                  </label>
                );
              })}
            </div>

            {onStartExtraction && (
              <Button
                onClick={() => onStartExtraction(Array.from(selectedPages))}
                disabled={extracting || selectedPages.size === 0}
                className="w-full h-8 text-xs font-medium cursor-pointer bg-primary text-primary-foreground shadow-2xs gap-1.5"
              >
                <SparklesIcon className="size-3.5 animate-pulse" />
                <span>
                  {extracting
                    ? 'Extracting Layouts...'
                    : `Start Extraction (${selectedPages.size} pages)`}
                </span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {analyzedData && (
        <div className="p-3 border-t border-border/80 bg-muted/20 shrink-0 select-none flex flex-col gap-2">
          {pagesWithElements.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {pagesWithElements.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                    currentPage === pageNum
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-background border border-border/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Page {pageNum}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {onReextractPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReextractPage(currentPage)}
                disabled={extractingPage}
                className="flex-1 h-7.5 text-xs gap-1 cursor-pointer"
              >
                <SparklesIcon className="size-3" />
                <span>{extractingPage ? 'Extracting...' : 'Extract Page'}</span>
              </Button>
            )}

            {onGenerateBOQ && (
              <Button
                size="sm"
                onClick={onGenerateBOQ}
                disabled={analyzing}
                className="flex-1 h-7.5 text-xs bg-primary text-primary-foreground font-medium cursor-pointer shadow-2xs"
              >
                <span>{analyzing ? 'Generating...' : 'Generate BOQ'}</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
