import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  SparklesIcon,
  XIcon,
  AlertTriangleIcon,
  FileSpreadsheetIcon,
  CheckCheckIcon,
  SquareIcon,
  HighlighterIcon,
  LayersIcon,
  TableIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  ScanLineIcon,
  FileTextIcon,
  CheckCircle2Icon,
  CpuIcon,
  InfoIcon,
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

  const totalSheets = Math.max(1, totalPages || 1);

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="border-l border-border/70 bg-card flex flex-col shrink-0 min-h-0 overflow-hidden text-foreground relative select-none shadow-xl transition-all"
    >
      {/* Resizing Handle */}
      <div
        onMouseDown={startResize}
        className={`absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize z-50 hover:bg-primary/50 transition-colors group ${
          isResizing ? 'bg-primary w-1.5 ring-2 ring-primary/30' : ''
        }`}
        title="Drag to resize panel"
      >
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1.5 h-8 bg-muted-foreground/30 group-hover:bg-primary rounded-r transition-colors" />
      </div>

      {/* Header */}
      <div className="h-12 px-3.5 border-b border-border/70 flex justify-between items-center shrink-0 bg-muted/30 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <ScanLineIcon className="size-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold tracking-tight text-foreground">
                Extraction Studio
              </h3>
              <Badge variant="secondary" className="text-[9px] font-medium h-4 px-1.5 py-0 bg-primary/10 text-primary border-0">
                AI Vision
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {analyzedData ? 'Table & Schedule Results' : 'Drawing Sheet Scanner'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Highlight Toggle Switch */}
          <button
            type="button"
            onClick={() => onToggleHighlightAll?.()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-all cursor-pointer border ${
              highlightAll
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30'
                : 'bg-muted/60 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
            }`}
            title="Highlight all detected bounding boxes on the drawing canvas"
          >
            <HighlighterIcon className={`size-3 ${highlightAll ? 'text-amber-500 dark:text-amber-400' : ''}`} />
            <span>Highlight</span>
            <span
              className={`size-1.5 rounded-full ${
                highlightAll ? 'bg-amber-500 dark:bg-amber-400 animate-ping' : 'bg-muted-foreground/40'
              }`}
            />
          </button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowExtractionPanel(false)}
            className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md"
            title="Close Panel"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0 select-none">
        {analyzing ? (
          /* Analyzing Loading State */
          <div className="flex-1 flex flex-col justify-center items-center p-4 gap-4 my-auto">
            <div className="relative size-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" />
              <div className="relative size-14 rounded-2xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary shadow-md">
                <CpuIcon className="size-7 animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-1 max-w-xs">
              <h4 className="text-xs font-semibold text-foreground">
                Analyzing Drawing Layouts
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Scanning drawing geometry, schedule tables, and engineering specifications...
              </p>
            </div>

            <div className="w-full max-w-xs bg-muted/50 border border-border/70 rounded-lg p-2.5 space-y-2 text-[10.5px]">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span>Neural table segmentation</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                <span>Text OCR & Bounding Box alignment</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                <span>BOQ column & unit reconciliation</span>
              </div>
            </div>
          </div>
        ) : analysisError ? (
          /* Analysis Error State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-5 border border-dashed border-destructive/40 bg-destructive/5 rounded-xl my-auto select-none gap-3">
            <div className="size-11 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center text-destructive shadow-xs">
              <AlertTriangleIcon className="size-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">Extraction Failed</h4>
              <p className="text-[11px] text-destructive/90 leading-relaxed max-w-xs">
                {analysisError}
              </p>
            </div>
            {onGenerateBOQ && (
              <Button
                size="sm"
                onClick={onGenerateBOQ}
                className="h-8 px-3 text-xs bg-primary text-primary-foreground mt-1 shadow-xs gap-1.5"
              >
                <RefreshCwIcon className="size-3.5" />
                <span>Retry Extraction</span>
              </Button>
            )}
          </div>
        ) : analyzedData ? (
          /* Extracted Data Results State */
          (() => {
            const currentPageElements =
              analyzedData?.elements?.filter((el) => el.page === currentPage) || [];

            return (
              <div className="flex flex-col gap-3">
                {/* Current Page Banner */}
                <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/40 border border-border/70">
                  <div className="flex items-center gap-2">
                    <LayersIcon className="size-3.5 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      Sheet {currentPage} of {totalSheets}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {currentPageElements.length}{' '}
                    {currentPageElements.length === 1 ? 'element' : 'elements'} found
                  </Badge>
                </div>

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
                        className={`flex flex-col gap-2 p-3 rounded-xl transition-all cursor-pointer border select-text shadow-2xs ${
                          isHighlighted
                            ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/40 shadow-xs'
                            : 'bg-card border-border/80 hover:border-primary/40 hover:bg-muted/20'
                        }`}
                      >
                        <div className="flex justify-between items-center border-b border-border/50 pb-2 select-none">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              {el.type === 'structured' ? (
                                <TableIcon className="size-3.5" />
                              ) : (
                                <FileTextIcon className="size-3.5" />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-foreground truncate">
                              {el.title ||
                                (el.type === 'structured'
                                  ? 'Schedule Table'
                                  : 'Drawing Note / Specification')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {el.confidence !== null && el.confidence !== undefined && (
                              <Badge
                                variant="outline"
                                className={`text-[9.5px] font-mono px-1.5 py-0 h-4.5 border ${
                                  el.confidence >= 0.85
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {(el.confidence * 100).toFixed(0)}% confidence
                              </Badge>
                            )}

                            {el.bbox && (
                              <span
                                className={`p-1 rounded text-[9px] ${
                                  isHighlighted
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Click to toggle highlight on drawing"
                              >
                                <HighlighterIcon className="size-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {el.type === 'structured' ? (
                          (() => {
                            const content = el.content;
                            if (!content || typeof content !== 'object') {
                              return (
                                <div className="text-[10px] text-muted-foreground italic select-none py-2 text-center">
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
                                <div className="overflow-x-auto border border-border/80 rounded-lg bg-background shadow-inner max-h-[calc(45vh-80px)]">
                                  <table
                                    className="text-left border-collapse text-[10px] w-full"
                                    style={{
                                      tableLayout: currentWidths.length > 0 ? 'fixed' : 'auto',
                                      width: currentWidths.length > 0 ? 'max-content' : '100%',
                                      minWidth: '100%',
                                    }}
                                  >
                                    <thead>
                                      <tr className="bg-muted/80 text-foreground font-semibold select-none border-b border-border/80">
                                        {headers.map((hdr, hIdx) => {
                                          const colWidth = currentWidths[hIdx];
                                          return (
                                            <th
                                              key={hIdx}
                                              style={{
                                                width: colWidth ? `${colWidth}px` : undefined,
                                                minWidth: '70px',
                                              }}
                                              className="sticky top-0 bg-muted/95 backdrop-blur-xs z-10 py-1.5 px-2.5 font-medium whitespace-nowrap border-r border-border/70 last:border-r-0 text-muted-foreground"
                                            >
                                              <span className="truncate block">{hdr}</span>
                                            </th>
                                          );
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {rows.map((row, rIdx) => (
                                        <tr
                                          key={rIdx}
                                          className="hover:bg-muted/40 transition-colors"
                                        >
                                          {Array.isArray(row) &&
                                            row.map((cell, cIdx) => {
                                              const colWidth = currentWidths[cIdx];
                                              return (
                                                <td
                                                  key={cIdx}
                                                  style={{
                                                    width: colWidth ? `${colWidth}px` : undefined,
                                                    minWidth: '70px',
                                                  }}
                                                  className="py-1.5 px-2.5 border-r border-border/40 last:border-r-0 font-normal text-foreground whitespace-pre-wrap break-words text-[10px]"
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
                                <div className="grid grid-cols-2 gap-1.5 text-[10.5px] p-2.5 bg-background border border-border/80 rounded-lg">
                                  {Object.entries(fields).map(([key, val]) => (
                                    <React.Fragment key={key}>
                                      <div className="font-medium text-muted-foreground truncate">
                                        {key}:
                                      </div>
                                      <div className="text-foreground font-mono font-medium break-words">
                                        {String(val ?? '')}
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-2 gap-1.5 text-[10.5px] p-2.5 bg-background border border-border/80 rounded-lg">
                                {Object.entries(content).map(([key, val]) => (
                                  <React.Fragment key={key}>
                                    <div className="font-medium text-muted-foreground truncate">
                                      {key}:
                                    </div>
                                    <div className="text-foreground font-mono font-medium break-words">
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
                          <div className="bg-background border-l-2 border-primary p-2.5 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap select-text font-mono rounded-r-lg border border-border/60">
                            {String(el.content ?? '')}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-xl my-4 select-none gap-2 bg-muted/10">
                    <FileSpreadsheetIcon className="size-8 text-muted-foreground/40" />
                    <h4 className="text-xs font-semibold text-foreground">
                      No Schedules on Sheet {currentPage}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs">
                      No schedule or equipment tables were detected on this page. Switch pages or re-extract this sheet.
                    </p>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* Pre-Extraction Sheet Selection State */
          <div className="flex-1 flex flex-col min-h-0 select-none gap-3">
            {/* Selection Header & Actions */}
            <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const pages = new Set<number>();
                    for (let i = 1; i <= totalSheets; i++) pages.add(i);
                    setSelectedPages(pages);
                  }}
                  className="h-6.5 px-2 text-[11px] gap-1 cursor-pointer hover:bg-muted font-medium"
                >
                  <CheckCheckIcon className="size-3 text-primary" />
                  <span>Select All</span>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedPages(new Set())}
                  className="h-6.5 px-2 text-[11px] gap-1 cursor-pointer hover:bg-muted font-medium text-muted-foreground"
                >
                  <SquareIcon className="size-3" />
                  <span>Clear</span>
                </Button>
              </div>

              <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5">
                {selectedPages.size} of {totalSheets} selected
              </Badge>
            </div>

            {/* Sheet Selector Grid */}
            <div className="flex-1 min-h-[220px] border border-border/70 rounded-xl bg-muted/10 overflow-y-auto p-2 grid grid-cols-2 gap-2">
              {Array.from({ length: totalSheets }).map((_, index) => {
                const pageNum = index + 1;
                const isSelected = selectedPages.has(pageNum);

                return (
                  <div
                    key={pageNum}
                    onClick={() => {
                      setSelectedPages((prev) => {
                        const next = new Set(prev);
                        if (isSelected) next.delete(pageNum);
                        else next.add(pageNum);
                        return next;
                      });
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer select-none ${
                      isSelected
                        ? 'border-primary/60 bg-primary/[0.08] text-foreground font-semibold shadow-2xs'
                        : 'border-border/60 bg-card hover:border-border hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Sheet {pageNum}</span>
                    </div>

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
                      className="size-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bottom Extraction CTA */}
            {onStartExtraction && (
              <div className="pt-1 flex flex-col gap-1.5">
                <Button
                  onClick={() => onStartExtraction(Array.from(selectedPages))}
                  disabled={extracting || selectedPages.size === 0}
                  className="w-full h-9.5 text-xs font-semibold cursor-pointer bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all gap-2"
                >
                  <SparklesIcon className="size-4 animate-pulse text-primary-foreground" />
                  <span>
                    {extracting
                      ? 'Extracting Drawing Schedules...'
                      : selectedPages.size === 0
                      ? 'Select Sheets to Extract'
                      : `Start Extraction (${selectedPages.size} ${
                          selectedPages.size === 1 ? 'Sheet' : 'Sheets'
                        })`}
                  </span>
                  <ArrowRightIcon className="size-3.5 opacity-80 ml-auto" />
                </Button>
                <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                  <InfoIcon className="size-3" />
                  Identifies BOQ schedule tables and equipment takeoffs
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation for Extracted Results */}
      {analyzedData && (
        <div className="p-3 border-t border-border/70 bg-muted/30 backdrop-blur-xs shrink-0 select-none flex flex-col gap-2.5 shadow-xs">
          {pagesWithElements.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto">
              <span className="text-[10px] font-medium text-muted-foreground mr-1">
                Sheets:
              </span>
              {pagesWithElements.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium cursor-pointer transition-all border ${
                    currentPage === pageNum
                      ? 'bg-primary text-primary-foreground font-semibold border-primary shadow-2xs'
                      : 'bg-card border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Sheet {pageNum}
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
                className="flex-1 h-8 text-xs gap-1.5 cursor-pointer hover:bg-muted font-medium"
              >
                <RefreshCwIcon className={`size-3.5 ${extractingPage ? 'animate-spin' : ''}`} />
                <span>{extractingPage ? 'Extracting...' : 'Re-scan Sheet'}</span>
              </Button>
            )}

            {onGenerateBOQ && (
              <Button
                size="sm"
                onClick={onGenerateBOQ}
                disabled={analyzing}
                className="flex-1 h-8 text-xs bg-primary text-primary-foreground font-semibold cursor-pointer shadow-xs hover:shadow-md gap-1.5"
              >
                <SparklesIcon className="size-3.5" />
                <span>{analyzing ? 'Generating...' : 'Generate BOQ'}</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
