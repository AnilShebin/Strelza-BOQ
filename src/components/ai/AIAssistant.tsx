import React, { useState } from 'react';
import { Icon } from '../common/Icon';

interface AIAssistantProps {
  pdfName?: string;
  pdfPath?: string;
  pdfSize?: string;
  pdfPages?: number;
  onLoadPDF: () => void;
}

/**
 * Sidebar Panel detailing raw estimated billable components matching the sheet notes.
 */
export const AIAssistant: React.FC<AIAssistantProps> = ({
  pdfName = 'FC_DRAWING_001.pdf',
  pdfPath = 'c:/Users/AnilShebinSJ/BOQEngine/FC_DRAWING_001.pdf',
  pdfSize = '18.7 MB',
  pdfPages = 24,
  onLoadPDF,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'proposed' | 'existing' | 'remove'>('all');

  const boqItems = [
    { id: 1, desc: 'Panel Antenna', qty: 9, unit: 'Nos', status: 'Proposed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { id: 2, desc: 'RRH Unit', qty: 6, unit: 'Nos', status: 'Proposed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { id: 3, desc: 'MW Dish', qty: 2, unit: 'Nos', status: 'Proposed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { id: 4, desc: 'Coax Cable (1/2")', qty: 120, unit: 'm', status: 'Proposed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { id: 5, desc: 'Hybrid Cable (1 5/8")', qty: 90, unit: 'm', status: 'Proposed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { id: 6, desc: 'Existing Antenna', qty: 3, unit: 'Nos', status: 'Existing', statusColor: 'bg-accent-blue-light text-accent-blue border border-accent-blue-border' },
    { id: 7, desc: 'Antenna to be Removed', qty: 2, unit: 'Nos', status: 'Remove', statusColor: 'bg-red-500/10 text-[#EE4324] border border-red-500/20' },
  ];

  return (
    <aside className="w-[280px] border-l border-border-color bg-bg-panel flex flex-col shrink-0 min-h-0">
      <div className="h-[48px] flex items-center justify-between px-3 border-b border-border-color-light shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-bold text-[12px] text-text-primary">BOQ Items (124)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-text-muted">
          <button className="hover:text-text-secondary p-1 rounded transition-colors duration-150">
            <Icon name="filter" size={14} />
          </button>
          <button className="hover:text-text-secondary p-1 rounded transition-colors duration-150">
            <Icon name="more-horizontal" size={14} />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-border-color-light shrink-0">
        <div className="flex justify-between text-[10px] font-bold text-text-muted border-b border-border-color-light tracking-tight">
          <button
            className={`pb-1 px-0.5 relative transition-colors duration-150 ${activeTab === 'all' ? 'text-accent-blue font-bold border-b-2 border-accent-blue' : 'hover:text-text-secondary'}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`pb-1 px-0.5 relative transition-colors duration-150 ${activeTab === 'proposed' ? 'text-accent-blue font-bold border-b-2 border-accent-blue' : 'hover:text-text-secondary'}`}
            onClick={() => setActiveTab('proposed')}
          >
            Proposed (86)
          </button>
          <button
            className={`pb-1 px-0.5 relative transition-colors duration-150 ${activeTab === 'existing' ? 'text-accent-blue font-bold border-b-2 border-accent-blue' : 'hover:text-text-secondary'}`}
            onClick={() => setActiveTab('existing')}
          >
            Existing (22)
          </button>
          <button
            className={`pb-1 px-0.5 relative transition-colors duration-150 ${activeTab === 'remove' ? 'text-accent-blue font-bold border-b-2 border-accent-blue' : 'hover:text-text-secondary'}`}
            onClick={() => setActiveTab('remove')}
          >
            Remove (16)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        <div className="relative shrink-0">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full h-8 bg-bg-app border border-border-color rounded-md pl-8 pr-8 text-xs text-text-secondary cursor-pointer hover:border-text-muted transition-colors duration-150"
          />
          <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
            <Icon name="filter" size={12} />
          </button>
        </div>

        <div className="border border-border-color rounded-lg overflow-hidden text-[10.5px]">
          <div className="grid grid-cols-12 bg-bg-app font-bold border-b border-border-color p-2 text-text-secondary text-center">
            <div className="col-span-1">#</div>
            <div className="col-span-5 text-left pl-1">Description</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2">Unit</div>
            <div className="col-span-2">Status</div>
          </div>
          <div className="flex flex-col text-text-secondary text-center">
            {boqItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 border-b border-border-color p-2 items-center bg-bg-panel last:border-b-0 hover:bg-bg-app">
                <div className="col-span-1 font-semibold">{index + 1}</div>
                <div className="col-span-5 text-left pl-1 text-text-primary font-medium truncate">{item.desc}</div>
                <div className="col-span-2 font-bold text-text-primary">{item.qty}</div>
                <div className="col-span-2">{item.unit}</div>
                <div className="col-span-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-12 p-1.5 text-center font-bold text-text-muted bg-bg-panel">
              <div className="col-span-12">...</div>
            </div>
          </div>
        </div>

        <div className="bg-bg-app border border-border-color rounded-lg p-3 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center text-xs font-semibold text-text-secondary">
            <span>Matched with Price List</span>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded font-bold">112 Matched</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
            </div>
            <span className="text-xs font-bold text-text-primary">90%</span>
          </div>
          <div className="flex justify-between items-center text-[10.5px] mt-1">
            <span className="font-semibold text-brand-tropical">Unmatched Items (12)</span>
            <button className="font-bold text-brand-tropical hover:underline flex items-center gap-0.5">
              <span>Review required</span>
              <Icon name="chevron-down" size={10} />
            </button>
          </div>
        </div>

        <button className="bg-accent-blue hover:bg-accent-blue-hover text-white py-2.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-2 shadow-[0_2px_4px_rgba(37,99,235,0.2)] shrink-0 w-full">
          <span>Review & Generate BOQ</span>
          <Icon name="chevron-right" size={12} className="text-white" />
        </button>
      </div>
    </aside>
  );
};
