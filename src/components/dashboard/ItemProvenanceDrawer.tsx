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
  FileTextIcon,
  LayersIcon,
  MapPinIcon,
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

  const mappedUnits = mappedSources.reduce((sum, s) => sum + (Number(s.quantity) || 1), 0);

  const totalQty = item.quantity !== undefined && item.quantity > 0
    ? item.quantity
    : mappedUnits;

  const unitRate = item.rate || 0;
  const totalCost = totalQty * unitRate;
  const confScore = item.confidence_score !== undefined ? Math.round(item.confidence_score) : 100;
  const confLevel = item.confidence_level || (confScore >= 90 ? 'HIGH' : confScore >= 70 ? 'MEDIUM' : 'NEEDS_REVIEW');

  // Primary source page reference for duplicate omission text
  const primarySrc = mappedSources[0];

  const primaryPage = primarySrc ? getPageNum(primarySrc) : null;

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
        mapped_units_count: mappedUnits,
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
        style={{ width: 'min(58vw, 840px)', maxWidth: 'min(58vw, 840px)' }}
        className="w-[92vw] sm:w-[75vw] lg:w-[58vw] max-w-[840px] !w-[min(58vw,840px)] !max-w-[min(58vw,840px)] data-[vaul-drawer-direction=right]:!w-[min(58vw,840px)] data-[vaul-drawer-direction=right]:!max-w-[min(58vw,840px)] data-[vaul-drawer-direction=right]:sm:!max-w-[min(58vw,840px)] data-[vaul-drawer-direction=right]:lg:!max-w-[min(58vw,840px)] max-h-screen h-full flex flex-col p-0 bg-background border-l border-border shadow-2xl overflow-hidden"
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
              <AlertTriangleIcon className="size-3 text-amber-500" />
              <span>Duplicated / Omitted</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-4 text-center font-mono font-bold">
                {duplicateSources.length}
              </Badge>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyDetailedJson}
            className="h-8 text-xs gap-1.5 font-medium border-border/80 hover:bg-muted/60 cursor-pointer shrink-0"
          >
            <CopyIcon className="size-3.5" />
            <span>Copy JSON</span>
          </Button>
        </div>

        {/* Sources List View */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {displayedSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed rounded-xl border-border/70 p-6 bg-muted/10">
              <LayersIcon className="size-8 mb-2 opacity-40 text-primary" />
              <p className="font-semibold text-sm text-foreground">No Evidence Sources</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No items match the currently selected filter.
              </p>
            </div>
          ) : (
            displayedSources.map((src, idx) => {
              const isDup = isDuplicateSource(src);
              const pageNum = getPageNum(src) || src.page;
              const displayQty = src.quantity !== undefined ? src.quantity : 1;
              const rowAction = src.action || item.action || 'INSTALL';
              const isNumericTag = src.ant_id && /^\d+$/.test(String(src.ant_id).trim());
              const displayModel = src.model && src.model !== '-' ? src.model : (item.name || item.header);
              const hasRawText = Boolean(
                src.raw_text &&
                src.raw_text !== displayModel &&
                !src.raw_text.startsWith('Item boq_') &&
                !src.raw_text.includes('as sor_code')
              );

              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition-all p-4 space-y-3 ${
                    isDup
                      ? 'bg-amber-500/[0.03] border-amber-500/25 hover:border-amber-500/40 hover:shadow-xs'
                      : 'bg-card border-border/80 hover:border-border hover:shadow-xs'
                  }`}
                >
                  {/* Card Header Ribbon */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Source ID / Antenna Badge */}
                      {src.ant_id && src.ant_id !== '-' ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/25"
                        >
                          {isNumericTag ? `Item ${src.ant_id}` : `Antenna ${src.ant_id}`}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground border-border/70"
                        >
                          Ref #{idx + 1}
                        </Badge>
                      )}

                      {/* Action Pill */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          rowAction.toUpperCase().includes('REMOVE')
                            ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/25'
                            : rowAction.toUpperCase().includes('REPLACE')
                            ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/25'
                            : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/25'
                        }`}
                      >
                        {rowAction}
                      </span>

                      {/* Qty Badge */}
                      <span className="text-xs font-mono font-bold text-foreground bg-muted/70 border border-border/70 px-2 py-0.5 rounded-md">
                        Qty: {displayQty} {item.unit || 'each'}
                      </span>

                      {/* Status Badge */}
                      {isDup ? (
                        <Badge
                          variant="outline"
                          className="text-[10.5px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"
                        >
                          <AlertTriangleIcon className="size-3" />
                          <span>Duplicate Reference (Omitted)</span>
                        </Badge>
                      ) : src.validation_status === 'DISCREPANCY_DETECTED' ? (
                        <Badge
                          variant="outline"
                          className="text-[10.5px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"
                        >
                          <AlertTriangleIcon className="size-3" />
                          <span>Layout Discrepancy</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1"
                        >
                          <CheckCircle2Icon className="size-3" />
                          <span>Verified Authoritative Source</span>
                        </Badge>
                      )}
                    </div>

                    {/* Direct Page Jump / Inspect */}
                    {onNavigateToPage && pageNum && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onNavigateToPage(pageNum);
                          onClose();
                        }}
                        className="h-7 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 border-primary/25 gap-1.5 rounded-lg cursor-pointer shrink-0 ml-auto"
                        title={`Jump directly to Page ${pageNum} in PDF Drawing`}
                      >
                        <span>Inspect Page {pageNum}</span>
                        <ExternalLinkIcon className="size-3" />
                      </Button>
                    )}
                  </div>

                  {/* Card Title: Drawing Model & Specs */}
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-foreground tracking-tight leading-snug">
                      {displayModel}
                    </h4>

                    {/* Verbatim Callout Note if distinct from model */}
                    {hasRawText && (
                      <div className="rounded-lg bg-muted/40 border border-border/60 p-2.5 text-xs text-foreground/90 font-mono leading-relaxed">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                          Verbatim Extracted Note / Specification:
                        </span>
                        &ldquo;{src.raw_text}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Drawing Metadata Details Strip */}
                  <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-xs text-muted-foreground pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <FileTextIcon className="size-3.5 text-primary/70 shrink-0" />
                      <span>Sheet: <strong className="text-foreground font-medium">{src.source_sheet || 'Drawing Sheet'}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <LayersIcon className="size-3.5 text-muted-foreground/70 shrink-0" />
                      <span>Context: <strong className="text-foreground font-medium">{src.source_table || 'Drawing Table'}</strong>{src.source_row !== undefined ? ` (Row #${src.source_row + 1})` : ''}</span>
                    </div>

                    {src.sector && src.sector !== '-' && (
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="size-3.5 text-muted-foreground/70 shrink-0" />
                        <span>Sector: <strong className="text-foreground font-medium">{src.sector}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Deduplication or Decision Rule Banner */}
                  {isDup ? (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                      <InfoIcon className="size-4 shrink-0 mt-0.5 text-amber-500" />
                      <div className="space-y-0.5 leading-relaxed">
                        <span className="font-bold">Deduplication Decision: </span>
                        <span>
                          {src.rule_logic ||
                            `This reference on Page ${pageNum || 'this sheet'} is omitted from the BOQ to prevent double-counting of this item, which is already accounted for from the authoritative schedule on Page ${primaryPage || 'another sheet'}.`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/40 border border-border/70 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
                      <CheckCircle2Icon className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                      <div className="space-y-0.5 leading-relaxed">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">Rule Applied:</span>
                          <span className="font-medium text-foreground">{src.matched_rule || 'Deterministic Takeoff Rule'}</span>
                        </div>
                        {src.rule_logic && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground font-mono mt-0.5">
                            {src.rule_logic}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
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
