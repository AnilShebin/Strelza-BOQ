import React from 'react';
import { Icon } from '../common/Icon';

interface KPICardsProps {
  /** Total sum cost of all mapped SOR items. */
  totalCost: number;
  /** Total quantity count of all active equipment. */
  totalItems: number;
  /** Number of warning checklist checks triggered. */
  warningCount: number;
}

/**
 * KPI stats cards grid displaying estimations summary.
 */
export const KPICards: React.FC<KPICardsProps> = ({ totalCost, totalItems, warningCount }) => {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6 shrink-0 select-none">
      {/* Total Mapped Cost */}
      <div className="bg-bg-panel border border-border-color rounded-none p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Mapped Cost</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-xl font-bold font-display text-accent-blue">
            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-text-muted font-bold">AUD</span>
        </div>
      </div>

      {/* Total Billable Items */}
      <div className="bg-bg-panel border border-border-color rounded-none p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Billable Items</span>
        <div className="text-xl font-bold font-display mt-1 text-text-primary">
          {totalItems} <span className="text-xs text-text-muted font-semibold">qty</span>
        </div>
      </div>

      {/* Price book Status */}
      <div className="bg-bg-panel border border-border-color rounded-none p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Price book Status</span>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-text-secondary truncate">active_price_list.xlsx</span>
        </div>
      </div>

      {/* Compliance Warnings */}
      <div className="bg-bg-panel border border-border-color rounded-none p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Compliance Status</span>
        <div className="flex items-center gap-1.5 mt-1">
          {warningCount > 0 ? (
            <>
              <Icon name="warning" size={14} className="text-[#EE4324]" />
              <span className="text-xs font-bold text-[#EE4324]">{warningCount} Warnings Flagged</span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="2 5 4 7 8 3" />
                </svg>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">All Checks Passed</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
