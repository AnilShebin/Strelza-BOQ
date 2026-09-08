import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDownIcon,
  SearchIcon,
  RotateCcwIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  SparklesIcon,
  TagIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  Loader2Icon,
  HelpCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PromptRuleItem {
  id: number;
  row_idx: number;
  code: string;
  name: string;
  unit: string;
  rate: number;
  mapping_rule: string;
}

const API_BASE_URL = 'http://localhost:8000/api/rules';

export const PromptRulesViewer: React.FC = () => {
  const [items, setItems] = useState<PromptRuleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');

  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<PromptRuleItem | null>(null);
  const [ruleInput, setRuleInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch rules from API
  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_BASE_URL);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      console.error('Failed to load rules:', err);
      toast.error('Failed to load price book prompt rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Metrics counts
  const configuredCount = useMemo(() => {
    return items.filter((i) => Boolean(i.mapping_rule && i.mapping_rule.trim())).length;
  }, [items]);

  const unconfiguredCount = items.length - configuredCount;

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const hasRule = Boolean(item.mapping_rule && item.mapping_rule.trim());
      if (statusFilter === 'configured' && !hasRule) return false;
      if (statusFilter === 'unconfigured' && hasRule) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inCode = item.code.toLowerCase().includes(q);
        const inName = item.name.toLowerCase().includes(q);
        const inRule = item.mapping_rule.toLowerCase().includes(q);
        if (!inCode && !inName && !inRule) return false;
      }

      return true;
    });
  }, [items, statusFilter, searchQuery]);

  const handleOpenEdit = (item: PromptRuleItem) => {
    setActiveItem(item);
    setRuleInput(item.mapping_rule || '');
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!activeItem) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${activeItem.row_idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping_rule: ruleInput }),
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      // Optimistically update local state
      setItems((prev) =>
        prev.map((i) =>
          i.row_idx === activeItem.row_idx ? { ...i, mapping_rule: ruleInput.trim() } : i
        )
      );

      toast.success(`Updated rule for ${activeItem.code || activeItem.name}`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving rule:', err);
      toast.error('Failed to update prompt rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearRule = async (item: PromptRuleItem) => {
    if (!item.mapping_rule) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${item.row_idx}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.row_idx === item.row_idx ? { ...i, mapping_rule: '' } : i
        )
      );

      toast.success(`Cleared rule for ${item.code || item.name}`);
    } catch (err: any) {
      console.error('Error clearing rule:', err);
      toast.error('Failed to clear rule');
    }
  };

  const handleExportRules = () => {
    fetch('http://localhost:8000/api/price-list/export?include_rules=true')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to export rules.');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Master_Price_List_With_Rules.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Prompt rules exported successfully.');
      })
      .catch((err) => {
        console.error(err);
        toast.error('Error exporting prompt rules.');
      });
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-background select-none min-h-0 text-foreground animate-fadeIn gap-4 overflow-hidden font-sans">
      {/* Header Bar - compact matching Master Prices & Equipment pages */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-normal tracking-tight text-foreground flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary" />
            <span>Prompt Rules</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            Define plain-English mapping instructions per price book item for AI takeoff.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRules}
            disabled={isLoading}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <RotateCcwIcon className={`size-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportRules}
            disabled={isLoading}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs font-medium rounded-lg"
          >
            <FileSpreadsheetIcon className="size-3.5" />
            <span>Export Rules</span>
          </Button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 w-full border border-border/80 rounded-xl bg-card flex flex-col min-h-0 overflow-hidden shadow-xs">
        {/* Top Control Toolbar inside table container */}
        <div className="p-3 px-4 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative w-72 sm:w-80">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, item name, category, or rule text..."
              className="h-8 pl-8 pr-8 text-xs bg-background/90 focus-visible:bg-background border-border/70 rounded-lg shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Segmented Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-background rounded-lg border border-border/70 shadow-2xs text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-muted text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('configured')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'configured'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckCircle2Icon className="size-3 text-emerald-500" />
                Configured ({configuredCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unconfigured')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'unconfigured'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <AlertCircleIcon className="size-3 text-amber-500" />
                Pending ({unconfiguredCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          {isLoading ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/80">
                <tr className="text-[11px] font-semibold text-muted-foreground">
                  <th className="h-9 px-3 w-12 text-center select-none">#</th>
                  <th className="h-9 px-3 w-28 text-center select-none">SOR Code</th>
                  <th className="h-9 px-4 min-w-[280px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-28 text-right select-none">Unit Rate</th>
                  <th className="h-9 px-4 min-w-[380px] select-none">Plain-English Prompt Rule</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Array.from({ length: 22 }).map((_, idx) => (
                  <tr key={`rules-skel-${idx}`} className="h-10">
                    <td className="px-3 text-center"><Skeleton className="size-3.5 mx-auto rounded" /></td>
                    <td className="px-3 text-center"><Skeleton className="h-4.5 w-18 mx-auto rounded bg-primary/10 border border-primary/20" /></td>
                    <td className="px-4"><Skeleton className="h-4 w-4/5 rounded" /></td>
                    <td className="px-3 text-right"><Skeleton className="h-4 w-14 ml-auto rounded" /></td>
                    <td className="px-4"><Skeleton className="h-4 w-11/12 rounded" /></td>
                    <td className="px-3 text-center"><Skeleton className="size-6 mx-auto rounded" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : filteredItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 gap-2 text-muted-foreground">
              <BookOpenIcon className="size-8 opacity-30" />
              <p className="text-xs font-semibold">No matching items found</p>
              <p className="text-[11px] text-muted-foreground/80 max-w-xs">
                Try adjusting your search query or switching filters.
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-1 h-7 text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/80">
                <tr className="text-[11px] font-semibold text-muted-foreground">
                  <th className="h-9 px-3 w-12 text-center select-none">#</th>
                  <th className="h-9 px-3 w-28 text-center select-none">SOR Code</th>
                  <th className="h-9 px-4 min-w-[280px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-28 text-right select-none">Unit Rate</th>
                  <th className="h-9 px-4 min-w-[380px] select-none">Plain-English Prompt Rule</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const hasRule = Boolean(item.mapping_rule && item.mapping_rule.trim());
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        hasRule ? 'bg-background' : 'bg-muted/10'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        {item.code ? (
                          <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-primary/10 text-primary border border-primary/20 inline-block">
                            {item.code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Item Name */}
                      <td className="py-2.5 px-4 font-medium text-foreground">
                        <div className="font-medium text-xs leading-snug">{item.name}</div>
                        {item.unit && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">
                            Unit: {item.unit}
                          </span>
                        )}
                      </td>

                      {/* Rate */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                        ${item.rate.toFixed(2)}
                      </td>

                      {/* Plain-English Rule Cell */}
                      <td className="py-2 px-4">
                        {hasRule ? (
                          <div
                            onClick={() => handleOpenEdit(item)}
                            className="group relative cursor-pointer p-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-foreground text-xs leading-relaxed"
                            title="Click to edit rule"
                          >
                            <div className="flex items-start gap-1.5">
                              <SparklesIcon className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="flex-1 select-text text-[11.5px]">{item.mapping_rule}</span>
                              <PencilIcon className="size-3 opacity-0 group-hover:opacity-60 text-muted-foreground shrink-0 mt-0.5 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="w-full text-left py-1.5 px-2.5 rounded-lg border border-dashed border-border/70 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-[11.5px] flex items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="text-sm font-bold text-muted-foreground/60 group-hover:text-primary">+</span>
                            <span className="italic opacity-80">Click to add plain-English mapping rule...</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Rule"
                            className="size-7 text-muted-foreground hover:text-primary rounded-md cursor-pointer"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!hasRule}
                            onClick={() => handleClearRule(item)}
                            title={hasRule ? 'Clear Rule' : 'No rule defined'}
                            className={`size-7 rounded-md cursor-pointer ${
                              hasRule
                                ? 'text-muted-foreground hover:text-destructive'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[580px] p-5">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              <DialogTitle className="text-base font-semibold">
                Edit Mapping Prompt Rule
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Define plain-English instructions telling Gemini when to select this SOR item.
            </DialogDescription>
          </DialogHeader>

          {activeItem && (
            <div className="space-y-3.5 py-1">
              {/* Item Info Box */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/70 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-primary px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20 text-[11px]">
                    {activeItem.code || 'NO CODE'}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Rate: ${activeItem.rate.toFixed(2)}
                  </span>
                </div>
                <div className="font-semibold text-foreground text-xs">{activeItem.name}</div>
                <div className="text-muted-foreground text-[11px]">
                  Unit: {activeItem.unit} | Rate: ${activeItem.rate.toFixed(2)}
                </div>
              </div>

              {/* Textarea for Plain-English Rule */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-prompt" className="text-xs font-semibold text-foreground">
                  Plain-English Rule Instruction
                </Label>
                <textarea
                  id="rule-prompt"
                  rows={4}
                  value={ruleInput}
                  onChange={(e) => setRuleInput(e.target.value)}
                  placeholder="e.g., Apply to 4G panel antennas >1.5m in height (such as Kaelus, Argus) when installed as the 1st antenna on a sector."
                  className="w-full text-xs p-2.5 rounded-lg border border-border/80 bg-background focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-y"
                  autoFocus
                />
                <div className="flex justify-between items-center text-[10.5px] text-muted-foreground">
                  <span>Plain English only. No code or regex required.</span>
                  <span>{ruleInput.trim().length} chars</span>
                </div>
              </div>

              {/* Tips for Writing Good Prompt Rules */}
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <HelpCircleIcon className="size-3.5" />
                  <span>Tips for High Accuracy:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 leading-relaxed text-[10.5px]">
                  <li><strong>Equipment models:</strong> Specify brand or model names (e.g. <em>Kaelus, AIR6488, RP6672</em>).</li>
                  <li><strong>Dimensions / Specs:</strong> Note size limits (e.g. <em>length &gt; 1.5m</em> or <em>active beamforming</em>).</li>
                  <li><strong>Actions:</strong> Explicitly mention if this code covers <em>INSTALL</em>, <em>REMOVE</em>, or <em>RECOVER</em>.</li>
                  <li><strong>Positions:</strong> Mention locations if relevant (e.g. <em>headframe/tower</em> vs <em>internal shelter</em>).</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveRule}
              disabled={isSaving}
              className="text-xs h-8 gap-1.5"
            >
              {isSaving ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
