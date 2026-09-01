import React from 'react';
import { Icon } from '../common/Icon';

interface BOQItem {
  item_id: string;
  item_name: string;
  model?: string;
  action: string;
  quantity: number;
  sor_code: string;
  rate: number;
  total_cost: number;
}

interface PricedBOQTableProps {
  /** Text search criteria. */
  searchQuery: string;
  /** Sets text search criteria. */
  setSearchQuery: (q: string) => void;
  /** List of BOQ items filtered by search criteria. */
  filteredItems: BOQItem[];
  /** Total count of all loaded billable items. */
  mappedItemsCount: number;
  /** List of selected item IDs. */
  selectedItemIds: string[];
  /** Toggles individual item selection. */
  onToggleSelectItem: (id: string) => void;
  /** Toggles all filtered items selection. */
  onToggleSelectAll: () => void;
}

/**
 * Filterable data table presenting priced Schedule of Rates (SOR) items.
 */
export const PricedBOQTable: React.FC<PricedBOQTableProps> = ({
  searchQuery,
  setSearchQuery,
  filteredItems,
  mappedItemsCount,
  selectedItemIds,
  onToggleSelectItem,
  onToggleSelectAll,
}) => {
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedItemIds.includes(item.item_id));

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 shrink-0 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search BOQ items (description, model, code...)"
            className="w-full h-8 bg-bg-app border border-border-color rounded-none pl-8 pr-3 text-xs text-text-secondary cursor-pointer hover:border-text-muted transition-colors duration-150 outline-none"
          />
        </div>
        <div className="text-[11px] text-text-muted font-semibold">
          Showing {filteredItems.length} of {mappedItemsCount} records
        </div>
      </div>

      {/* Data Table Grid */}
      <div className="flex-1 overflow-auto border border-border-color rounded-none min-h-0">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-bg-app font-bold border-b border-border-color text-text-secondary select-none text-center">
              <th className="py-2.5 px-2 text-center w-10 sticky left-0 z-20 bg-bg-app border-r border-border-color-light">
                <input 
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={onToggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-3 text-left w-16">Sl. No.</th>
              <th className="py-2.5 px-2 text-left">Description</th>
              <th className="py-2.5 px-2 w-16">Action</th>
              <th className="py-2.5 px-2 w-12">Qty</th>
              <th className="py-2.5 px-2 w-24">SOR Code</th>
              <th className="py-2.5 px-2 w-20 text-right">Rate</th>
              <th className="py-2.5 px-3 w-24 text-right">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const isSelected = selectedItemIds.includes(item.item_id);
                return (
                  <tr 
                    key={item.item_id} 
                    className={`border-b border-border-color-light hover:bg-bg-app/30 transition-colors duration-100 ${
                      isSelected ? 'bg-accent-blue/5' : 'opacity-60 bg-transparent'
                    }`}
                  >
                    <td className="py-2.5 px-2 text-center sticky left-0 z-10 bg-bg-panel border-r border-border-color-light">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectItem(item.item_id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-text-muted font-bold text-center">{index + 1}</td>
                    <td className="py-2.5 px-2 font-semibold">
                      <div>{item.item_name}</div>
                      {item.model && <div className="text-[9.5px] text-text-muted font-normal mt-0.5">Model: {item.model}</div>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-bold uppercase ${
                        item.action === 'INSTALL' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : item.action === 'REMOVE' || item.action === 'RECOVER'
                            ? 'bg-[#EE4324]/10 text-[#EE4324]' 
                            : 'bg-accent-blue-light text-accent-blue'
                      }`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-text-secondary">{item.sor_code}</td>
                    <td className="py-2.5 px-2 text-right text-text-secondary font-mono">${item.rate.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-accent-blue">${item.total_cost.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-text-muted font-bold">
                  No matching BOQ items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
