import React from 'react';
import { Icon } from '../common/Icon';

interface ExtractedTableItem {
  page: number;
  table_type: string;
  table_title?: string;
}

interface ExtractedTablesListProps {
  /** Index of currently selected table in inspector, or null for priced items list. */
  selectedTableIndex: number | null;
  /** Sets the active selected table in inspector. */
  setSelectedTableIndex: (idx: number | null) => void;
  /** Count of compiled billable items. */
  mappedItemsCount: number;
  /** List of engineering tables extracted from document vector layers. */
  extractedTables: ExtractedTableItem[];
}

/**
 * Vertical list selector in dashboard sidebar to toggle between priced list and raw drawing grids.
 */
export const ExtractedTablesList: React.FC<ExtractedTablesListProps> = ({
  selectedTableIndex,
  setSelectedTableIndex,
  mappedItemsCount,
  extractedTables,
}) => {
  return (
    <div className="bg-bg-panel border border-border-color rounded-none p-4 flex flex-col h-[180px] shrink-0 shadow-sm select-none">
      <h3 className="text-xs font-bold font-display uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5 border-b border-border-color-light pb-2 shrink-0">
        <Icon name="layout-single" size={13} className="text-accent-blue" />
        <span>Extracted Sheet Tables</span>
      </h3>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 min-h-0">
        <button
          onClick={() => setSelectedTableIndex(null)}
          className={`w-full text-left px-3 py-2 rounded-none text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
            selectedTableIndex === null 
              ? 'bg-accent-blue-light border border-accent-blue-border text-accent-blue font-bold shadow-sm' 
              : 'border border-transparent hover:bg-bg-app text-text-secondary'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="action-list" size={13} />
            <span>Priced BOQ Items list</span>
          </div>
          <span className="text-[10px] text-text-muted font-bold">{mappedItemsCount} lines</span>
        </button>

        {extractedTables.map((table, idx) => {
          const label = table.table_title || (table.table_type === 'ANTENNA_CONFIGURATION' ? 'Antenna Config' : 'Equipment Notes');
          return (
            <button
              key={idx}
              onClick={() => setSelectedTableIndex(idx)}
              className={`w-full text-left px-3 py-2 rounded-none text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                selectedTableIndex === idx 
                  ? 'bg-accent-blue-light border border-accent-blue-border text-accent-blue font-bold shadow-sm' 
                  : 'border border-transparent hover:bg-bg-app text-text-secondary'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <Icon name="document" size={13} />
                <span className="truncate">{label}</span>
              </div>
              <span className="text-[10px] text-text-muted font-bold shrink-0">Sheet {table.page}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
