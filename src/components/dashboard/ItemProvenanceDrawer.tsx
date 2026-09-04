import React, { useMemo, useState } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  CopyIcon,
  ExternalLinkIcon,
  XIcon,
  InfoIcon,
  FilterIcon,
} from 'lucide-react';
import type { BOQTableItem } from './BOQDataTable';

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
  is_duplicate?: boolean;
}

interface ItemProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: BOQTableItem | null;
  onNavigateToPage?: (page: number) => void;
}

export const ItemProvenanceDrawer: React.FC<ItemProvenanceDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onNavigateToPage,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'mapped' | 'duplicates'>('all');

  // Parse evidence json
  const evidenceData = useMemo(() => {
    if (!item?.evidence_json) return { summary: null, sources: [] };
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
  }, [item?.evidence_json]);

  const rawSources: SourceEvidenceItem[] = (evidenceData.sources || []).filter(Boolean);

  // Helper to extract page number safely
  const getPageNum = (src: SourceEvidenceItem): number | null => {
    if (src.page && typeof src.page === 'number') return src.page;
    if (src.source_sheet) {
      const m = src.source_sheet.match(/\b(?:Page|Sheet|Pg)\s*([0-9]+)/i);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  };

  const isDuplicateSource = (src: SourceEvidenceItem): boolean => {
    return Boolean(
      src.is_duplicate ||
      src.matched_rule === 'Duplicated Omitted Note Match' ||
      src.validation_status === 'DUPLICATE_OMITTED' ||
      src.source_table === 'Drawing Callout Note'
    );
  };

  // Build unique sources
  const allSources = useMemo(() => {
    if (rawSources.length > 0) return rawSources;
    if (!item) return [];
    return [{
      source_sheet: item.source_sheet || 'Drawing Sheet',
      source_table: 'Drawing Callouts / Equipment Notes',
      ant_id: '-',
      model: item.name || item.header,
      action: item.action || 'INSTALL',
      quantity: item.quantity || 1,
      entity_class: item.category || item.type,
      sector: '-',
      matched_rule: 'AI Semantic Context Match',
      validation_status: item.comments?.includes('Data not matching') ? 'DISCREPANCY_DETECTED' : 'VERIFIED_IN_LAYOUT',
      confidence_score: item.confidence_score || 95,
      confidence_level: item.confidence_level || 'HIGH',
      raw_text: item.comments && !item.comments.startsWith('Item boq_') && !item.comments.includes("as sor_code") ? item.comments : ''
    }];
  }, [rawSources, item]);

  const mappedSources = useMemo(() => allSources.filter(s => !isDuplicateSource(s)), [allSources]);
  const duplicateSources = useMemo(() => allSources.filter(s => isDuplicateSource(s)), [allSources]);

  const displayedSources = useMemo(() => {
    if (filterMode === 'mapped') return mappedSources;
    if (filterMode === 'duplicates') return duplicateSources;
    return allSources;
  }, [filterMode, allSources, mappedSources, duplicateSources]);

  if (!item) return null;

  const totalQty = item.quantity !== undefined && item.quantity > 0
    ? item.quantity
    : mappedSources.reduce((sum, s) => sum + (Number(s.quantity) || 1), 0);

  const unitRate = item.rate || 0;
  const totalCost = totalQty * unitRate;
  const confScore = item.confidence_score !== undefined ? Math.round(item.confidence_score) : 100;
  const confLevel = item.confidence_level || (confScore >= 90 ? 'HIGH' : confScore >= 70 ? 'MEDIUM' : 'NEEDS_REVIEW');

  // Primary source page reference for duplicate omission text
  const primarySrc = mappedSources[0];

  const scopeText = ((item.name || item.header || '') + ' ' + (item.category || '')).toUpperCase();
  const isAntennaScope = scopeText.includes('ANTENNA') || scopeText.includes('AAU');
  const primaryPage = primarySrc ? getPageNum(primarySrc) : null;

  const formatSector = (rawSec?: string): string => {
    if (!rawSec || rawSec === '-' || rawSec.trim() === '') return '-';
    const lines = rawSec.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return '-';
    const secCodes = Array.from(new Set(lines.map((l) => {
      const m = l.match(/^(S[0-9]{1,2})/i);
      return m ? m[1].toUpperCase() : l;
    })));
    return secCodes.slice(0, 3).join(', ');
  };

  const handleCopyDetailedJson = () => {
    try {
      const detailedData = {
        item_name: item.name || item.header,
        sor_code: item.code || 'UNQUOTED',
        category: item.category || item.type,
        total_quantity: totalQty,
        unit_rate: unitRate,
        total_amount: totalCost,
        scope_action: item.action || 'INSTALL',
        decision_confidence: `${confScore}% (${confLevel})`,
        mapped_sources_count: mappedSources.length,
        duplicate_sources_count: duplicateSources.length,
        sources: allSources.map((src, idx) => ({
          index: idx + 1,
          is_duplicate: isDuplicateSource(src),
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
          validation_status: isDuplicateSource(src) ? 'Duplicate (Omitted)' : (src.validation_status === 'DISCREPANCY_DETECTED' ? 'Review Required' : 'Verified')
        }))
      };

      navigator.clipboard.writeText(JSON.stringify(detailedData, null, 2));
      toast.success('Successfully copied constituent facts & duplicates to clipboard.', {
        description: 'JSON format copied with full traceability.'
      });
    } catch (err) {
      console.error('Failed to copy detailed JSON:', err);
      toast.error('Could not copy JSON to clipboard.');
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} direction="right">
      <DrawerContent
        style={{ width: 'min(88vw, 1320px)', maxWidth: 'min(88vw, 1320px)' }}
        className="w-[88vw] max-w-[1320px] !w-[88vw] !max-w-[1320px] data-[vaul-drawer-direction=right]:!w-[88vw] data-[vaul-drawer-direction=right]:!max-w-[1320px] data-[vaul-drawer-direction=right]:sm:!max-w-[88vw] data-[vaul-drawer-direction=right]:lg:!max-w-[1320px] max-h-screen h-full flex flex-col p-0 bg-background border-l border-border shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <DrawerHeader className="p-5 pb-4 border-b border-border/80 shrink-0 bg-card/60 backdrop-blur-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <DrawerTitle className="text-lg font-bold text-foreground tracking-tight truncate max-w-2xl">
                  {item.name || item.header}
                </DrawerTitle>
                {item.code && item.code.trim() !== '' && item.code !== 'UNQUOTED' ? (
                  <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30">
                    {item.code}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                    UNQUOTED
                  </Badge>
                )}
              </div>
              <DrawerDescription className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Category: <strong className="text-foreground font-medium">{item.category || item.type || 'General'}</strong></span>
                {item.row_idx !== undefined && (
                  <span className="text-muted-foreground/70">• Database Row #{item.row_idx}</span>
                )}
              </DrawerDescription>
            </div>

            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer -mt-1">
                <XIcon className="size-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {/* Overview Key Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 border-b border-border/70 bg-muted/20 text-xs shrink-0">
          <div className="flex flex-col">
            <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-semibold">Total BOQ Quantity</span>
            <span className="text-sm font-bold text-primary mt-0.5">
              {totalQty} {item.unit || 'each'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-semibold">Unit Rate & Total</span>
            <span className="text-sm font-bold text-emerald-500 dark:text-emerald-400 mt-0.5">
              ${unitRate.toFixed(2)}{' '}
              <span className="text-muted-foreground font-normal text-xs">(${totalCost.toFixed(2)})</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-semibold">Scope Action</span>
            <span className={`inline-flex items-center gap-1.5 font-bold text-xs mt-1 ${
              (item.action || '').toUpperCase().includes('REMOVE')
                ? 'text-rose-500 dark:text-rose-400'
                : (item.action || '').toUpperCase().includes('REPLACE')
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-emerald-500 dark:text-emerald-400'
            }`}>
              <span className="size-1.5 rounded-full bg-current" />
              {item.action || 'INSTALL'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-semibold">Decision Confidence</span>
            <div className="mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                confLevel === 'HIGH'
                  ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                  : confLevel === 'MEDIUM'
                  ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/30'
                  : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30'
              }`}>
                {confLevel === 'HIGH' ? '✓ ' : '⚠️ '}{confScore}% ({confLevel.replace('_', ' ')})
              </span>
            </div>
          </div>
        </div>

        {/* Warning / Discrepancy Banner if applicable */}
        {item.comments && item.comments.includes('Data not matching') && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-300 shrink-0">
            <AlertTriangleIcon className="size-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <span className="font-bold">Drawing Layout Cross-Check Warning:</span>
              <p className="mt-0.5 leading-relaxed">{item.comments}</p>
            </div>
          </div>
        )}

        {/* Filter Tabs & Action Bar */}
        <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between gap-3 shrink-0 border-b border-border/60 bg-background">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-0.5 bg-muted/60 rounded-lg border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>All Sources</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-4 text-center">
                {allSources.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('mapped')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                filterMode === 'mapped'
                  ? 'bg-background text-emerald-500 dark:text-emerald-400 shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2Icon className="size-3 text-emerald-500" />
              <span>Mapped Items</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-4 text-center">
                {mappedSources.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('duplicates')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                filterMode === 'duplicates'
                  ? 'bg-background text-amber-500 dark:text-amber-400 shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <InfoIcon className="size-3 text-amber-500" />
              <span>Duplicated / Omitted</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-4 text-center">
                {duplicateSources.length}
              </Badge>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyDetailedJson}
            className="text-xs h-7.5 px-2.5 gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border/80"
            title="Copy detailed constituent facts in JSON format"
          >
            <CopyIcon className="size-3" />
            <span>Copy JSON</span>
          </Button>
        </div>

        {/* Sources & Facts Table */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {displayedSources.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-2">
              <FilterIcon className="size-8 opacity-40" />
              <p className="text-xs font-semibold">No records found for this filter.</p>
              <p className="text-[11px] text-muted-foreground/80">Switch to All Sources to see all extraction references.</p>
            </div>
          ) : (
            <div className="border border-border/80 rounded-lg overflow-x-auto shadow-2xs bg-card">
              <table className="min-w-full w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-xs border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-24 text-center">{isAntennaScope ? 'Antenna ID' : 'Drawing Tag'}</th>
                    <th className="py-2.5 px-3 w-24 text-center">Sector</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Drawing Model & Specifications</th>
                    <th className="py-2.5 px-3 w-24 text-center">Action</th>
                    <th className="py-2.5 px-3 w-14 text-center">Qty</th>
                    <th className="py-2.5 px-3 min-w-[190px]">Drawing Location & Sheet</th>
                    <th className="py-2.5 px-3 min-w-[230px]">Applied Decision Rule</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    {onNavigateToPage && <th className="py-2.5 px-3 w-20 text-center">Inspect</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {displayedSources.map((src, idx) => {
                    const pageNum = getPageNum(src);
                    const rowAction = src.action || item.action || 'INSTALL';
                    const displayModel = src.model && src.model !== '-' ? src.model : (item.name || item.header);
                    const displayAntId = src.ant_id && src.ant_id !== '-' ? src.ant_id : '-';
                    const displayQty = src.quantity !== undefined ? src.quantity : 1;
                    const isDup = isDuplicateSource(src);

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-muted/40 ${
                          isDup ? 'bg-amber-500/5 text-muted-foreground' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {displayAntId !== '-' ? (
                            <span className="bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.5 rounded text-[11px]">
                              {displayAntId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-foreground font-medium">
                          {src.sector && src.sector !== '-' ? (
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/70 text-[11px] font-mono inline-block whitespace-nowrap">
                              {formatSector(src.sector)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className={`font-semibold text-xs ${isDup ? 'text-foreground/80 line-through decoration-amber-500/50' : 'text-foreground'}`}>
                            {displayModel}
                          </div>
                          {src.raw_text && src.raw_text !== displayModel && !src.raw_text.startsWith('Item boq_') && !src.raw_text.includes('as sor_code') && (
                            <div className="text-[10.5px] text-muted-foreground mt-0.5 line-clamp-2" title={src.raw_text}>
                              {src.raw_text}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                            rowAction.toUpperCase().includes('REMOVE')
                              ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20'
                              : rowAction.toUpperCase().includes('REPLACE')
                              ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {rowAction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground text-[11.5px]">
                          {displayQty}
                        </td>
                        <td className="py-2.5 px-3 text-foreground">
                          <div className="flex items-center gap-1.5 font-medium text-[11px]">
                            {pageNum ? (
                              <span className="bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.2 rounded font-bold text-[10px]">
                                Page {pageNum}
                              </span>
                            ) : null}
                            <span className="font-semibold truncate max-w-[140px]" title={src.source_sheet || 'Drawing Sheet'}>
                              {src.source_sheet || 'Drawing Sheet'}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {src.source_table || 'Drawing Table'} {src.source_row !== undefined ? `(Row ${src.source_row + 1})` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-foreground">
                          <div className="font-semibold text-foreground text-[11px] mb-0.5">
                            {isDup ? 'Duplicate Reference (Omitted)' : (src.matched_rule || 'Deterministic Commercial Rule')}
                          </div>
                          {(isDup || src.rule_logic) && (
                            <div 
                              className={`font-mono text-[9.5px] p-1.5 rounded border mt-0.5 leading-relaxed break-words ${
                                isDup
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25'
                                  : 'bg-muted/60 text-muted-foreground border-border/70'
                              }`}
                              title={isDup 
                                ? (src.rule_logic || `This note on Page ${pageNum || 'this sheet'} is omitted to prevent double-counting of ${displayAntId !== '-' ? `Antenna ${displayAntId}` : 'this equipment'}, which is already accounted for on Page ${primaryPage || 'another sheet'}.`)
                                : src.rule_logic
                              }
                            >
                              {isDup
                                ? (src.rule_logic || `Omitted note reference to prevent double-counting of ${displayAntId !== '-' ? `Antenna ${displayAntId}` : 'this equipment'}, already accounted for on Page ${primaryPage || 'another sheet'}.`)
                                : src.rule_logic}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isDup ? (
                            <Badge variant="outline" className="text-[9.5px] font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30">
                              Omitted (Dup)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[9.5px] font-semibold ${
                              src.validation_status === 'DISCREPANCY_DETECTED'
                                ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                            }`}>
                              {src.validation_status === 'DISCREPANCY_DETECTED' ? '⚠️ Review' : '✓ Verified'}
                            </Badge>
                          )}
                        </td>
                        {onNavigateToPage && (
                          <td className="py-2.5 px-3 text-center">
                            {pageNum ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  onNavigateToPage(pageNum);
                                  onClose();
                                }}
                                className="h-6 px-2 text-[10.5px] font-bold text-primary hover:bg-primary/10 gap-1 rounded cursor-pointer"
                                title={`Jump to Page ${pageNum} in PDF Drawing`}
                              >
                                <span>Pg {pageNum}</span>
                                <ExternalLinkIcon className="size-2.5" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <DrawerFooter className="p-4 border-t border-border/80 flex flex-row items-center justify-between shrink-0 bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Engineering Intelligence Traceability & Layout Validation</span>
            <span className="sm:hidden">Traceability</span>
          </div>

          <DrawerClose asChild>
            <Button type="button" variant="outline" size="sm" className="text-xs h-8 px-4 cursor-pointer">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
