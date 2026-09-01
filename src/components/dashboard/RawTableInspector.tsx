import React from 'react';
import { Icon } from '../common/Icon';

interface Cell {
  row_idx: number;
  col_idx: number;
  rowspan: number;
  colspan: number;
  text: string;
}

interface SelectedTable {
  table_title?: string;
  table_type: string;
  page: number;
  headers: string[];
  rows: string[][];
  cells?: Cell[];
}

interface RawTableInspectorProps {
  /** The specific extracted table model to inspect in details view. */
  selectedTable: SelectedTable;
  /** Callback to clear selected table and return back to priced BOQ dashboard. */
  onBackToBOQ: () => void;
}

/**
 * Renders original drawing sheet tables (Antenna configurations or equipment notes).
 * Employs an exact coordinate mesh layout to display merged cells (rowspan/colspan) correctly.
 */
export const RawTableInspector: React.FC<RawTableInspectorProps> = ({
  selectedTable,
  onBackToBOQ,
}) => {
  const title = selectedTable.table_title || (selectedTable.table_type === 'ANTENNA_CONFIGURATION' ? 'Antenna Configuration Table' : 'Equipment Notes Table');

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* Inspector Header */}
      <div className="flex justify-between items-center mb-4 shrink-0 pb-2 border-b border-border-color-light">
        <div>
          <h4 className="text-xs font-bold text-accent-blue uppercase tracking-wider font-display">
            {title}
          </h4>
          <p className="text-[10px] text-text-muted font-semibold mt-0.5">Extracted from PDF Drawing — Sheet {selectedTable.page}</p>
        </div>
        <button
          onClick={onBackToBOQ}
          className="bg-bg-app hover:bg-border-color-light text-text-secondary px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold flex items-center gap-1.5 border border-border-color transition-all cursor-pointer"
        >
          <Icon name="arrow-left" size={11} />
          <span>Back to BOQ list</span>
        </button>
      </div>

      {/* Grid Inspector Canvas */}
      <div className="flex-1 overflow-auto border border-border-color rounded-lg min-h-0 bg-bg-app/10">
        <table className="w-full text-left border-separate text-[10.5px]" style={{ borderSpacing: 0 }}>
          {selectedTable.cells && selectedTable.cells.length > 0 ? (
            /* Rich cell renderer preserving merged cells structures */
            (() => {
              const cells = selectedTable.cells;
              const numRows = Math.max(...cells.map((c) => c.row_idx + c.rowspan), 0);
              const numCols = Math.max(...cells.map((c) => c.col_idx + c.colspan), 0);
              const row0Cells = cells.filter((c) => c.row_idx === 0);
              const HEADER_ROWS = (row0Cells.length === 1 && (row0Cells[0].colspan > 1 || numCols === 1)) ? 2 : 1;

              const titleText = selectedTable.table_title || '';
              const row0Text = row0Cells.map((c) => c.text).join('').trim();
              const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();
              const showTitleRow = titleText && normalize(titleText) !== normalize(row0Text);

              const renderRow = (rIdx: number, isHead: boolean) => (
                <tr
                  key={rIdx}
                  className="border-b border-border-color-light hover:bg-bg-panel/40 transition-colors last:border-b-0"
                >
                  {Array.from({ length: numCols }).map((_, cIdx) => {
                    const cell = cells.find((c) => c.row_idx === rIdx && c.col_idx === cIdx);
                    if (!cell) return null;
                    const CellTag = isHead ? 'th' : 'td';
                    return (
                      <CellTag
                        key={cIdx}
                        rowSpan={cell.rowspan}
                        colSpan={cell.colspan}
                        className={`py-2 px-3 border-r border-b last:border-r-0 font-medium whitespace-pre-wrap ${
                          isHead
                            ? 'bg-bg-app font-bold text-text-secondary select-none text-center border-border-color'
                            : 'border-border-color-light text-text-primary'
                        }`}
                      >
                        {cell.text}
                      </CellTag>
                    );
                  })}
                </tr>
              );

              return (
                <>
                  <thead className="sticky top-0 z-20" style={{ boxShadow: '0 1px 0 var(--border-color, #333)' }}>
                    {showTitleRow && (
                      <tr>
                        <th
                          colSpan={numCols}
                          className="py-1.5 px-3 bg-bg-app font-bold text-text-secondary text-center border-b border-border-color whitespace-normal text-[10.5px] uppercase tracking-wide"
                        >
                          {titleText}
                        </th>
                      </tr>
                    )}
                    {Array.from({ length: Math.min(HEADER_ROWS, numRows) }).map((_, rIdx) =>
                      renderRow(rIdx, true)
                    )}
                  </thead>
                  <tbody>
                    {Array.from({ length: numRows - HEADER_ROWS }).map((_, i) =>
                      renderRow(HEADER_ROWS + i, false)
                    )}
                  </tbody>
                </>
              );
            })()
          ) : (
            /* Flat fallback row renderer */
            <>
              <thead>
                <tr className="bg-bg-app border-b border-border-color text-text-secondary select-none font-bold">
                  {selectedTable.headers.map((hdr, hIdx) => (
                    <th key={hIdx} className="py-2 px-3 border-r border-border-color last:border-r-0 whitespace-nowrap">
                      {hdr || `Column ${hIdx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedTable.rows.map((row, rIdx) => (
                  <tr 
                    key={rIdx} 
                    className="border-b border-border-color-light hover:bg-bg-panel/40 transition-colors last:border-b-0"
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 border-r border-border-color-light last:border-r-0 font-medium whitespace-pre-wrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
};
