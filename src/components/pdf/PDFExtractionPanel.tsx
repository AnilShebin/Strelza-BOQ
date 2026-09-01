import React from 'react';
import { Icon } from '../common/Icon';

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

/**
 * Side sheet panel displaying universal AI-extracted structured and unstructured elements page-by-page.
 */
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
  // Pre-calculate pages with elements to render in a fixed footer block
  const pagesWithElements = Array.from(
    new Set(analyzedData?.elements?.map((el) => el.page) || [])
  ) as number[];
  pagesWithElements.sort((a, b) => a - b);

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="border-l border-border bg-bg-panel flex flex-col shrink-0 min-h-0 overflow-hidden text-text-primary relative select-none"
    >
      <div
        onMouseDown={startResize}
        className={`absolute top-0 bottom-0 left-0 w-1 cursor-col-resize z-50 hover:bg-accent-blue/40 transition-colors ${isResizing ? 'bg-accent-blue/80 w-1' : ''}`}
      />

      <div className="h-[48px] px-4 border-b border-border-color-light flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Icon name="action-list" size={14} className="text-accent-blue" />
          <h3 className="text-xs font-bold font-display uppercase tracking-wider text-text-secondary">Extraction Results</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 select-none" title="Highlight all bounding boxes on page">
            <span className="text-[10px] font-bold text-text-muted">HIGHLIGHT ALL</span>
            <button
              onClick={() => onToggleHighlightAll?.()}
              className={`relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none border-0 ${
                highlightAll ? 'bg-accent-blue' : 'bg-border-color'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                  highlightAll ? 'translate-x-[15px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => setShowExtractionPanel(false)}
            className="text-text-muted hover:bg-bg-app hover:text-text-primary p-1 rounded transition-colors cursor-pointer border-0 bg-transparent"
            title="Hide Panel"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-0 select-none">
        {analyzing ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5 animate-pulse">
              <div className="h-4 bg-border-color-light rounded w-1/3" />
              <div className="h-32 bg-border-color-light rounded" />
            </div>
            <div className="flex flex-col gap-1.5 animate-pulse">
              <div className="h-4 bg-border-color-light rounded w-1/2" />
              <div className="h-24 bg-border-color-light rounded" />
            </div>
          </div>
        ) : analysisError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#EE4324]/20 bg-[#EE4324]/5 rounded-none my-auto select-none">
            <div className="w-12 h-12 rounded-full bg-[#EE4324]/10 flex items-center justify-center mb-4 text-[#EE4324]">
              <Icon name="warning" size={20} />
            </div>
            <h4 className="text-xs font-bold text-text-primary mb-1">Extraction Failed</h4>
            <p className="text-[10px] text-[#EE4324] font-semibold leading-relaxed mb-4">{analysisError}</p>
            <p className="text-[9.5px] text-text-muted leading-relaxed mb-5">
              Please verify that the backend Python server is running on port 8000. Start it via:
              <code className="block mt-2 p-1.5 bg-bg-app border border-border-color rounded-none text-[8.5px] font-mono select-all text-left">
                .\backend\venv\Scripts\python.exe backend\main.py
              </code>
            </p>
            {onGenerateBOQ && (
              <button
                onClick={onGenerateBOQ}
                className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2 rounded-none text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow border-0"
              >
                <Icon name="plus" size={10} />
                <span>Retry Extraction</span>
              </button>
            )}
          </div>
        ) : analyzedData ? (
          (() => {
            const currentPageElements = analyzedData?.elements?.filter((el) => el.page === currentPage) || [];

            return (
              <>
                {currentPageElements.length > 0 ? (
                   currentPageElements.map((el, elIdx) => {
                     const isHighlighted = highlightedBbox && el.bbox &&
                       highlightedBbox[0] === el.bbox[0] &&
                       highlightedBbox[1] === el.bbox[1] &&
                       highlightedBbox[2] === el.bbox[2] &&
                       highlightedBbox[3] === el.bbox[3];
                     
                     let containerClass = "flex flex-col gap-1.5 p-2 rounded-md transition-all cursor-pointer border select-text ";
                     containerClass += isHighlighted 
                       ? "border-accent-blue bg-accent-blue/5 shadow-sm" 
                       : "bg-bg-app/45 border-border-color hover:bg-bg-app/75";

                     return (
                       <div 
                         key={elIdx} 
                         className={containerClass}
                         onClick={() => {
                           if (el.bbox) {
                             // Toggle highlight
                             if (isHighlighted) {
                               onHighlightBbox?.(null);
                             } else {
                               onHighlightBbox?.(el.bbox);
                             }
                           }
                         }}
                       >
                         <div className="flex justify-between items-center border-b border-border-color-light pb-1 mb-0.5 select-none">
                           <span className="text-[10px] font-bold text-accent-blue font-display truncate">
                             {el.title || (el.type === 'structured' ? 'Extracted Structured Data' : 'Extracted Unstructured Note')}
                           </span>
                           
                           {el.confidence !== null && el.confidence !== undefined && (
                             <span className="bg-accent-blue/10 text-accent-blue text-[8.5px] font-bold px-1.5 py-0.5 rounded shrink-0">
                               {(el.confidence * 100).toFixed(0)}% confidence
                             </span>
                           )}
                         </div>

                      {el.type === 'structured' ? (
                        (() => {
                          const content = el.content;
                          if (!content || typeof content !== 'object') {
                            return (
                              <div className="text-[10px] text-text-muted italic select-none">
                                Empty structured content.
                              </div>
                            );
                          }

                          // Case A: Table structures (headers + rows)
                          if ('headers' in content && 'rows' in content && Array.isArray(content.rows)) {
                            const headers = (content.headers || []) as string[];
                            const rows = (content.rows || []) as any[][];
                            const tableKey = `element-${currentPage}-${elIdx}`;
                            const currentWidths = columnWidths[tableKey] || [];

                            return (
                              <div className="overflow-x-auto border border-border-color rounded-none bg-bg-panel max-h-[calc(50vh-100px)]">
                                <table
                                  className="text-left border-separate text-[9px]"
                                  style={{
                                    borderSpacing: 0,
                                    tableLayout: currentWidths.length > 0 ? 'fixed' : 'auto',
                                    width: currentWidths.length > 0 ? 'max-content' : '100%',
                                    minWidth: '100%'
                                  }}
                                >
                                  <thead>
                                    <tr className="font-semibold text-text-secondary select-none">
                                      {headers.map((hdr, hIdx) => {
                                        const colWidth = currentWidths[hIdx];
                                        return (
                                          <th
                                            key={hIdx}
                                            style={{ width: colWidth ? `${colWidth}px` : undefined, minWidth: '50px' }}
                                            className="sticky top-0 bg-bg-app z-10 py-1 px-1.5 font-bold whitespace-nowrap border-r border-b border-border-color last:border-r-0 group"
                                          >
                                            <span className="truncate block pr-2.5">{hdr}</span>
                                            {hIdx < headers.length - 1 && (
                                              <div
                                                onMouseDown={(e) => startColumnResize(e, elIdx, hIdx)}
                                                className="absolute top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-accent-blue/30 transition-colors"
                                                style={{ right: '-4px' }}
                                              />
                                            )}
                                          </th>
                                        );
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((row, rIdx) => (
                                      <tr key={rIdx} className="border-b border-border-color-light last:border-b-0 hover:bg-bg-app/20">
                                        {Array.isArray(row) && row.map((cell, cIdx) => {
                                          const colWidth = currentWidths[cIdx];
                                          return (
                                            <td
                                              key={cIdx}
                                              style={{ width: colWidth ? `${colWidth}px` : undefined, minWidth: '50px' }}
                                              className="py-1.5 px-1.5 border-r border-border-color-light last:border-r-0 whitespace-pre-wrap break-words font-medium text-text-secondary"
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

                          // Case B: Key-Value layout (fields object)
                          if ('fields' in content && content.fields && typeof content.fields === 'object') {
                            const fields = content.fields as Record<string, any>;
                            return (
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] p-2 bg-bg-app border border-border-color-light rounded-none">
                                {Object.entries(fields).map(([key, val]) => (
                                  <React.Fragment key={key}>
                                    <div className="font-bold text-text-secondary truncate">{key}:</div>
                                    <div className="text-text-muted break-words">{String(val ?? '')}</div>
                                  </React.Fragment>
                                ))}
                              </div>
                            );
                          }

                          // Case C: Fallback for generic objects
                          return (
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] p-2 bg-bg-app border border-border-color-light rounded-none">
                              {Object.entries(content).map(([key, val]) => (
                                <React.Fragment key={key}>
                                  <div className="font-bold text-text-secondary truncate">{key}:</div>
                                  <div className="text-text-muted break-words">
                                    {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        // unstructured element
                        <div className="bg-bg-app border-l-2 border-accent-blue bg-bg-panel p-2.5 text-[9.5px] leading-relaxed text-text-secondary whitespace-pre-wrap select-text font-medium">
                          {String(el.content ?? '')}
                        </div>
                      )}
                    </div>
                  );
                })
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-color rounded-none my-4 select-none">
                    <div className="w-10 h-10 rounded-full bg-border-color-light flex items-center justify-center mb-3 text-text-muted">
                      <Icon name="layout-single" size={16} />
                    </div>
                    <h4 className="text-xs font-bold text-text-primary mb-1">No Data on Page {currentPage}</h4>
                    <p className="text-[10px] text-text-muted leading-relaxed">No meaningful structured or unstructured information was extracted for this page.</p>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <div className="flex-1 flex flex-col p-4 bg-bg-panel min-h-0 select-none">
            {/* Header info */}
            <div className="mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center mb-3 text-accent-blue">
                <Icon name="action-list" size={18} />
              </div>
              <h4 className="text-xs font-bold text-text-primary mb-1">AI Extraction Pending</h4>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Please select the drawing pages to scan for BOQ tables. Skipping cover sheets and general notes saves Gemini Vision API credits.
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const pages = new Set<number>();
                  for (let i = 1; i <= (totalPages || 1); i++) {
                    pages.add(i);
                  }
                  setSelectedPages(pages);
                }}
                className="px-2 py-1 text-[9.5px] font-bold border border-border-color bg-bg-app hover:bg-bg-panel text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPages(new Set());
                }}
                className="px-2 py-1 text-[9.5px] font-bold border border-border-color bg-bg-app hover:bg-bg-panel text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
              >
                Select None
              </button>
            </div>

            {/* Scrollable grid list of checkboxes */}
            <div className="flex-1 min-h-0 border border-border-color rounded bg-bg-app overflow-y-auto p-3 grid grid-cols-2 gap-2 custom-scrollbar mb-4">
              {Array.from({ length: totalPages || 1 }).map((_, index) => {
                const pageNum = index + 1;
                const isSelected = selectedPages.has(pageNum);
                return (
                  <label
                    key={pageNum}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-accent-blue/45 bg-accent-blue/5 text-text-primary'
                        : 'border-border-color-light hover:bg-bg-panel/40 text-text-secondary'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedPages((prev) => {
                          const next = new Set(prev);
                          if (next.has(pageNum)) {
                            next.delete(pageNum);
                          } else {
                            next.add(pageNum);
                          }
                          return next;
                        });
                      }}
                      className="rounded border-border-color text-accent-blue focus:ring-accent-blue/20 w-3 h-3"
                    />
                    <span className="text-[10px] font-bold">Page {pageNum}</span>
                  </label>
                );
              })}
            </div>

            {/* Start Extraction button */}
            {onStartExtraction && (
              <button
                onClick={() => {
                  onStartExtraction(Array.from(selectedPages));
                }}
                disabled={extracting || selectedPages.size === 0}
                className="w-full bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow border-0"
              >
                <Icon name="sparkles" size={11} className="animate-pulse" />
                <span>{extracting ? 'Extracting Layouts...' : `Start Extraction (${selectedPages.size} pages)`}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pages Navigation & Generate BOQ: Rendered as a fixed footer panel block when data is loaded */}
      {analyzedData && (
        <div className="p-3 border-t border-border-color-light bg-bg-panel shrink-0 select-none flex flex-col gap-2.5">
          {pagesWithElements.length > 0 && (
            <>
              <h4 className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider">Pages with Extracted Data</h4>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 mb-1">
                {pagesWithElements.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 py-1 rounded-none text-[9.5px] font-bold transition-all cursor-pointer ${currentPage === pageNum
                        ? 'bg-accent-blue text-white shadow-sm'
                        : 'bg-bg-app border border-border-color text-text-secondary hover:bg-border-color-light'
                      }`}
                  >
                    Page {pageNum}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2">
            {onReextractPage && (
              <button
                onClick={() => onReextractPage(currentPage)}
                disabled={extractingPage}
                className="flex-1 bg-bg-app hover:bg-border-color-light text-text-primary border border-border-color py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Extract data for the current page only"
              >
                <Icon name="sparkles" size={12} className={extractingPage ? "animate-pulse" : ""} />
                <span>{extractingPage ? 'Extracting Page...' : 'Extract Page'}</span>
              </button>
            )}

            {onGenerateBOQ && (
              <button
                onClick={onGenerateBOQ}
                disabled={analyzing}
                className="flex-1 bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer border-0"
                title="Generate Bill of Quantities"
              >
                <Icon name="action-list" size={12} />
                <span>{analyzing ? 'Generating...' : 'Generate BOQ'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
