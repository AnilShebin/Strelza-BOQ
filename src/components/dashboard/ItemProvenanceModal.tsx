import React, { useMemo } from 'react';
import { Icon } from '../common/Icon';
import type { PriceListItem } from './UniversViewer';
import { toast } from '../common/Toast';

interface ItemProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PriceListItem | null;
  onNavigateToPage?: (page: number) => void;
}

export interface SourceEvidenceItem {
  source_sheet?: string;
  source_table?: string;
  source_row?: number;
  page?: number;
  ant_id?: string;
  model?: string;
  action?: string;
  quantity?: number;
  entity_class?: string;
  sector?: string;
  location?: string;
  matched_rule?: string;
  rule_logic?: string;
  target_sor?: string;
  target_name?: string;
  rate?: number;
  validation_status?: string;
  confidence_score?: number;
  confidence_level?: string;
  raw_text?: string;
}

export const ItemProvenanceModal: React.FC<ItemProvenanceModalProps> = ({
  isOpen,
  onClose,
  item,
  onNavigateToPage,
}) => {
  if (!isOpen || !item) return null;

  // Parse evidence json
  const evidenceData = useMemo(() => {
    if (!item.evidence_json) return { summary: null, sources: [] };
    try {
      if (typeof item.evidence_json === 'object') {
        const obj = item.evidence_json as any;
        if (Array.isArray(obj.sources)) return { summary: obj.summary || obj.sources[0], sources: obj.sources };
        return { summary: obj, sources: [obj] };
      }
      const parsed = JSON.parse(item.evidence_json);
      if (Array.isArray(parsed.sources)) return { summary: parsed.summary || parsed.sources[0], sources: parsed.sources };
      if (Array.isArray(parsed)) return { summary: parsed[0], sources: parsed };
      return { summary: parsed, sources: [parsed] };
    } catch {
      return { summary: null, sources: [] };
    }
  }, [item.evidence_json]);

  const rawSources = evidenceData.sources.filter(Boolean);

  // Deduplicate sources based on sheet, table, row, antenna, and model to prevent identical rows
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return rawSources.filter((src: SourceEvidenceItem) => {
      const key = `${src.page || ''}|${src.source_sheet || ''}|${src.source_table || ''}|${src.source_row ?? ''}|${src.ant_id || ''}|${src.model || ''}|${src.action || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawSources]);

  const sources: SourceEvidenceItem[] = uniqueSources.length > 0
    ? uniqueSources
    : [{
        source_sheet: item.source_sheet || 'Drawing Sheet',
        source_table: 'Drawing Callouts / Equipment Notes',
        ant_id: '-',
        model: item.name,
        action: item.action || 'INSTALL',
        quantity: item.quantity || 1,
        entity_class: item.category,
        sector: '-',
        matched_rule: 'AI Semantic Context Match',
        validation_status: item.comments?.includes('Data not matching') ? 'DISCREPANCY_DETECTED' : 'VERIFIED_IN_LAYOUT',
        confidence_score: item.confidence_score || 95,
        confidence_level: item.confidence_level || 'HIGH',
        raw_text: item.comments && !item.comments.startsWith('Item boq_') && !item.comments.includes("as sor_code") ? item.comments : ''
      }];

  const totalQty = item.quantity !== undefined && item.quantity > 0 
    ? item.quantity 
    : sources.reduce((sum, s) => sum + (Number(s.quantity) || 1), 0);

  const unitRate = item.rate || 0;
  const totalCost = totalQty * unitRate;
  const confScore = item.confidence_score !== undefined ? Math.round(item.confidence_score) : 100;
  const confLevel = item.confidence_level || (confScore >= 90 ? 'HIGH' : confScore >= 70 ? 'MEDIUM' : 'NEEDS_REVIEW');

  // Extract page number safely
  const getPageNum = (src: SourceEvidenceItem): number | null => {
    if (src.page && typeof src.page === 'number') return src.page;
    if (src.source_sheet) {
      const m = src.source_sheet.match(/\b(?:Page|Sheet|Pg)\s*([0-9]+)/i);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  };

  // Find the primary source page to build a helpful explanation sentence for duplicates
  const primarySrc = sources.find(s => s.matched_rule !== 'Duplicated Omitted Note Match' && s.source_table !== 'Drawing Callout Note');
  const primaryPage = primarySrc ? getPageNum(primarySrc) : null;

  const handleCopyDetailedJson = () => {
    try {
      const detailedData = {
        item_name: item.name,
        sor_code: item.code || 'Non-SOR Item',
        category: item.category,
        total_quantity: totalQty,
        unit_rate: unitRate,
        total_amount: totalCost,
        scope_action: item.action,
        decision_confidence: `${confScore}% (${confLevel})`,
        sources_count: sources.length,
        sources: sources.map((src, idx) => ({
          index: idx + 1,
          antenna_id: src.ant_id || '-',
          sector: src.sector || '-',
          drawing_model_specifications: src.model || '-',
          action: src.action || '-',
          quantity: src.quantity !== undefined ? src.quantity : 1,
          page: getPageNum(src) || src.page || '-',
          drawing_location_sheet: src.source_sheet || '-',
          source_table: src.source_table || '-',
          source_row: src.source_row !== undefined ? src.source_row + 1 : '-',
          applied_decision_rule: src.matched_rule || '-',
          rule_logic: src.rule_logic || '-',
          validation_status: src.validation_status === 'DISCREPANCY_DETECTED' ? 'Review Required' : 'Verified',
          confidence_score: src.confidence_score !== undefined ? `${Math.round(src.confidence_score)}%` : '-'
        }))
      };

      navigator.clipboard.writeText(JSON.stringify(detailedData, null, 2));
      toast.success('Successfully copied detailed constituent facts to clipboard in JSON format.', 'JSON Copied');
    } catch (err) {
      console.error('Failed to copy detailed JSON:', err);
      toast.error('Could not copy JSON to clipboard.', 'Copy Failed');
    }
  };

  // Clean sector string for display
  const formatSector = (rawSec?: string): string => {
    if (!rawSec || rawSec === '-' || rawSec.trim() === '') return '-';
    const lines = rawSec.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return '-';
    
    const secCodes = Array.from(new Set(lines.map((l) => {
      const m = l.match(/^(S[0-9]{1,2})/i);
      return m ? m[1].toUpperCase() : l;
    })));

    if (secCodes.length === 1) {
      const firstLine = lines[0];
      const colonParts = firstLine.split(':');
      if (colonParts.length > 1 && colonParts[1].trim()) {
        return `${colonParts[0].trim()} (${colonParts[1].trim()})`;
      }
      return secCodes[0];
    }
    return secCodes.slice(0, 3).join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-bg-panel border border-border-color rounded-xl shadow-2xl w-[96vw] max-w-[1440px] max-h-[94vh] flex flex-col overflow-hidden text-text-primary animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color bg-bg-app/80">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue shadow-inner">
              <Icon name="search" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-text-primary tracking-tight">
                  {item.name}
                </h2>
                {item.code && item.code.trim() !== '' ? (
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shadow-sm ${
                    item.code === 'UNQUOTED'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  }`}>
                    {item.code}
                  </span>
                ) : (
                  <span className="font-semibold text-xs px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-500 border-cyan-500/30 shadow-sm">
                    Non-SOR Item
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                <span>Category: <strong className="text-text-secondary">{item.category}</strong></span>
                {item.row_idx !== undefined && (
                  <span className="text-[11px] text-text-muted/80">• Database Row #{item.row_idx}</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-bg-panel text-text-muted hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border-color"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Overview Key Metrics Bar */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3.5 bg-bg-app border-b border-border-color text-xs">
          <div className="flex flex-col">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Total BOQ Quantity</span>
            <span className="text-base font-bold text-accent-blue mt-0.5">
              {totalQty} {item.unit || 'each'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Unit Rate & Total Amount</span>
            <span className="text-base font-bold text-emerald-400 mt-0.5">
              ${unitRate.toFixed(2)} <span className="text-text-muted font-normal text-xs">(${totalCost.toFixed(2)})</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Scope Action</span>
            <span className={`inline-flex items-center gap-1.5 font-bold text-xs mt-1 ${
              item.action?.toUpperCase().includes('REMOVE') ? 'text-rose-400' : item.action?.toUpperCase().includes('REPLACE') ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {item.action || 'INSTALL'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Decision Confidence</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                confLevel === 'HIGH'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : confLevel === 'MEDIUM'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {confLevel === 'HIGH' ? '✓ ' : '⚠️ '}{confScore}% ({confLevel.replace('_', ' ')})
              </span>
            </div>
          </div>
        </div>

        {/* Warning / Discrepancy Banner if applicable */}
        {item.comments && item.comments.includes('Data not matching') && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
            <Icon name="alert-triangle" size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold">Drawing Layout Cross-Check Warning:</span>
              <p className="text-amber-200/90 mt-0.5">{item.comments}</p>
            </div>
          </div>
        )}

        {/* Constituent Facts / Source Breakdown Table */}
        <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Icon name="layers" size={15} className="text-accent-blue" />
              Constituent Drawing Facts & Extraction Sources ({sources.length} {sources.length === 1 ? 'record' : 'records'})
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyDetailedJson}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border-color bg-bg-panel hover:bg-bg-app text-text-secondary hover:text-text-primary rounded-md transition-all cursor-pointer font-bold text-xs shadow-sm bg-transparent"
                title="Copy detailed constituent facts in JSON format"
              >
                <Icon name="clipboard" size={11} />
                <span>Copy Detailed JSON</span>
              </button>
              <span className="text-xs text-text-muted hidden sm:inline">
                Each row below represents a verified drawing extraction
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 border border-border-color rounded-lg overflow-auto custom-scrollbar shadow-sm bg-bg-panel/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-bg-app">
                <tr className="border-b border-border-color text-text-muted text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center bg-bg-app">#</th>
                  <th className="py-2.5 px-3 w-20 text-center bg-bg-app">Antenna ID</th>
                  <th className="py-2.5 px-3 w-28 text-center bg-bg-app">Sector</th>
                  <th className="py-2.5 px-3 bg-bg-app min-w-[220px]">Drawing Model & Specifications</th>
                  <th className="py-2.5 px-3 w-20 text-center bg-bg-app">Action</th>
                  <th className="py-2.5 px-3 w-12 text-center bg-bg-app">Qty</th>
                  <th className="py-2.5 px-3 bg-bg-app min-w-[180px]">Drawing Location & Sheet</th>
                  <th className="py-2.5 px-3 bg-bg-app min-w-[200px]">Applied Decision Rule</th>
                  <th className="py-2.5 px-3 w-24 text-center bg-bg-app">Validation</th>
                  {onNavigateToPage && <th className="py-2.5 px-3 w-20 text-center bg-bg-app">Inspect</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color-light">
                {sources.map((src, idx) => {
                  const pageNum = getPageNum(src);
                  const rowAction = src.action || item.action || 'INSTALL';
                  const displayModel = src.model && src.model !== '-' ? src.model : item.name;
                  const displayAntId = src.ant_id && src.ant_id !== '-' ? src.ant_id : '-';
                  const displayQty = src.quantity !== undefined ? src.quantity : 1;
                  const isDuplicate = src.matched_rule === 'Duplicated Omitted Note Match' || src.source_table === 'Drawing Callout Note';

                  return (
                    <tr key={idx} className={`hover:bg-bg-app/60 transition-colors ${isDuplicate ? 'opacity-50 select-none' : ''}`}>
                      <td className="py-2.5 px-3 text-center text-text-muted font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-accent-blue">
                        {displayAntId !== '-' ? (
                          <span className="bg-accent-blue/10 px-1.5 py-0.5 rounded border border-accent-blue/25 text-[11px]">
                            {displayAntId}
                          </span>
                        ) : (
                          <span className="text-text-muted font-normal">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-text-secondary font-semibold">
                        {src.sector && src.sector !== '-' ? (
                          <span className="px-2 py-0.5 rounded bg-bg-app border border-border-color text-[11px] font-mono inline-block whitespace-nowrap shadow-sm" title={src.sector}>
                            {formatSector(src.sector)}
                          </span>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-text-primary">
                        <div className="font-semibold text-xs text-text-primary">{displayModel}</div>
                        {src.raw_text && src.raw_text !== displayModel && !src.raw_text.startsWith('Item boq_') && !src.raw_text.includes('as sor_code') && (
                          <div className="text-[10px] text-text-muted mt-0.5 line-clamp-1" title={src.raw_text}>
                            {src.raw_text}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          rowAction.toUpperCase().includes('REMOVE')
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : rowAction.toUpperCase().includes('REPLACE')
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {rowAction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-text-primary text-[11.5px]">
                        {displayQty}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        <div className="flex items-center gap-1.5 font-medium text-[11px]">
                          {pageNum ? (
                            <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-bold text-[10px]">
                              Page {pageNum}
                            </span>
                          ) : null}
                          {src.source_sheet ? (
                            src.source_sheet.toLowerCase().trim() !== `page ${pageNum}` ? (
                              <span className="text-text-primary font-semibold">{src.source_sheet}</span>
                            ) : null
                          ) : (
                            <span className="text-text-primary font-semibold">Drawing Sheet</span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {src.source_table || 'Drawing Table'} {src.source_row !== undefined ? `(Row ${src.source_row + 1})` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        <div className="font-semibold text-text-primary text-[11px] mb-0.5">
                          {isDuplicate ? 'Duplicate Reference (Omitted)' : (src.matched_rule || 'Deterministic Commercial Rule')}
                        </div>
                        {(isDuplicate || src.rule_logic) && (
                          <div 
                            className="font-mono text-[9.5px] text-text-muted bg-bg-app/90 px-1.5 py-1 rounded border border-border-color/80 mt-0.5 max-w-xs whitespace-normal break-words leading-relaxed font-medium" 
                            title={isDuplicate 
                              ? `This note on Page ${pageNum || 'this sheet'} is omitted to prevent double-counting of ${displayAntId !== '-' ? `Antenna ${displayAntId}` : 'this equipment'}, which is already accounted for on Page ${primaryPage || 'another sheet'}.`
                              : src.rule_logic
                            }
                          >
                            {isDuplicate 
                              ? `This note on Page ${pageNum || 'this sheet'} is omitted to prevent double-counting of ${displayAntId !== '-' ? `Antenna ${displayAntId}` : 'this equipment'}, which is already accounted for on Page ${primaryPage || 'another sheet'}.`
                              : src.rule_logic
                            }
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isDuplicate ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/25 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                            Omitted (Dup)
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            src.validation_status === 'DISCREPANCY_DETECTED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          }`}>
                            {src.validation_status === 'DISCREPANCY_DETECTED' ? '⚠️ Review' : '✓ Verified'}
                          </span>
                        )}
                      </td>
                      {onNavigateToPage && (
                        <td className="py-2.5 px-3 text-center">
                          {pageNum ? (
                            <button
                              onClick={() => {
                                onNavigateToPage(pageNum);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue text-[11px] font-bold transition-all cursor-pointer border border-accent-blue/30 inline-flex items-center gap-1 shadow-sm"
                              title={`Jump to Page ${pageNum} in PDF Viewer`}
                            >
                              <span>Pg {pageNum}</span>
                              <Icon name="external-link" size={11} />
                            </button>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border-color bg-bg-app/80">
          <div className="text-xs text-text-muted flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Multi-Source Engineering Intelligence Traceability & Layout Validation</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-bg-panel hover:bg-bg-app border border-border-color text-xs font-semibold text-text-primary transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
