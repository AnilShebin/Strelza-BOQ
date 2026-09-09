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
  SearchIcon,
  RotateCcwIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  SparklesIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  Loader2Icon,
  PlusIcon,
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
  equipment_type?: string;
  action_type?: string;
  location_type?: string;
  calc_rule?: string;
  aggregation_rule?: string;
  pricing_group?: string;
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
      const isConfigured = Boolean(item.mapping_rule && item.mapping_rule.trim());
      if (statusFilter === 'configured' && !isConfigured) return false;
      if (statusFilter === 'unconfigured' && isConfigured) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inCode = item.code.toLowerCase().includes(q);
        const inName = item.name.toLowerCase().includes(q);
        const inRule = (item.mapping_rule || '').toLowerCase().includes(q);
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
      const payload = {
        mapping_rule: ruleInput.trim(),
        equipment_type: '',
        action_type: '',
        location_type: '',
        calc_rule: '',
        aggregation_rule: 'SUM',
        pricing_group: '',
      };

      const res = await fetch(`${API_BASE_URL}/${activeItem.row_idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.row_idx === activeItem.row_idx
            ? {
                ...i,
                mapping_rule: ruleInput.trim(),
                equipment_type: '',
                action_type: '',
                location_type: '',
                calc_rule: '',
                aggregation_rule: 'SUM',
                pricing_group: '',
              }
            : i
        )
      );

      toast.success(`Updated prompt rule for ${activeItem.code || activeItem.name}`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving rule:', err);
      toast.error('Failed to update prompt rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearRule = async (item: PromptRuleItem) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${item.row_idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping_rule: '',
          equipment_type: '',
          action_type: '',
          location_type: '',
          calc_rule: '',
          aggregation_rule: 'SUM',
          pricing_group: '',
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.row_idx === item.row_idx
            ? {
                ...i,
                mapping_rule: '',
                equipment_type: '',
                action_type: '',
                location_type: '',
                calc_rule: '',
                aggregation_rule: 'SUM',
                pricing_group: '',
              }
            : i
        )
      );

      toast.success(`Cleared prompt rule for ${item.code || item.name}`);
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
        link.download = `Price_List_Rules_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Downloaded price list rules spreadsheet');
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to export price list spreadsheet');
      });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Header Banner */}
      <div className="border-b border-border/80 px-6 py-4 shrink-0 bg-card/60 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <SparklesIcon className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  SOR Engineering Prompt Rules
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Pure RAG Standard
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Natural language 3-line engineering prompts guiding semantic RAG vector retrieval & AI takeoff mapping.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportRules}
              className="text-xs h-8 gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheetIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Export Rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRules}
              disabled={isLoading}
              className="text-xs h-8 gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcwIcon className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-4 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 max-w-md relative">
            <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, item description, or prompt rule..."
              className="h-8 pl-8 text-xs bg-background shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
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
                Needs Prompt ({unconfiguredCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto min-h-0 relative border border-border/80 rounded-xl bg-card shadow-2xs">
          {isLoading ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/80">
                <tr className="text-[11px] font-semibold text-muted-foreground">
                  <th className="h-9 px-3 w-12 text-center select-none">#</th>
                  <th className="h-9 px-3 w-28 text-center select-none">SOR Code</th>
                  <th className="h-9 px-4 min-w-[260px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-24 text-right select-none">Rate</th>
                  <th className="h-9 px-4 min-w-[420px] select-none">Engineering Prompt Rule (3-Line Standard)</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Array.from({ length: 16 }).map((_, idx) => (
                  <tr key={`rules-skel-${idx}`} className="h-12">
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
                Try adjusting your search query or switching status filters.
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-1 h-7 text-xs cursor-pointer"
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
                  <th className="h-9 px-4 min-w-[260px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-24 text-right select-none">Rate</th>
                  <th className="h-9 px-4 min-w-[420px] select-none">Engineering Prompt Rule (3-Line Standard)</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const hasPromptRule = Boolean(item.mapping_rule && item.mapping_rule.trim());
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        hasPromptRule ? 'bg-background' : 'bg-muted/10'
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Code */}
                      <td className="py-3 px-3 text-center font-mono">
                        {item.code ? (
                          <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-primary/10 text-primary border border-primary/20 inline-block">
                            {item.code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Item Name */}
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="font-semibold text-xs leading-snug">{item.name}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {item.unit && (
                            <span className="px-1.5 py-0.5 rounded bg-muted/80 border border-border/60 font-mono">
                              Unit: {item.unit}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                        ${item.rate.toFixed(2)}
                      </td>

                      {/* Prompt Rule */}
                      <td className="py-2.5 px-4">
                        {hasPromptRule ? (
                          <div
                            onClick={() => handleOpenEdit(item)}
                            className="group relative cursor-pointer p-3 rounded-lg border border-border/80 bg-muted/20 hover:bg-muted/40 transition-all text-foreground text-xs leading-relaxed"
                            title="Click to edit 3-line prompt rule"
                          >
                            <div className="flex items-start gap-2">
                              <SparklesIcon className="size-3.5 text-primary shrink-0 mt-0.5" />
                              <div className="flex-1 select-text text-xs whitespace-pre-line text-foreground/90 font-normal leading-relaxed">
                                {item.mapping_rule}
                              </div>
                              <PencilIcon className="size-3.5 opacity-0 group-hover:opacity-70 text-muted-foreground shrink-0 mt-0.5 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="w-full text-left py-2 px-3 rounded-lg border border-dashed border-border/80 hover:border-primary/50 bg-muted/10 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-xs flex items-center gap-2 group cursor-pointer"
                          >
                            <PlusIcon className="size-3.5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            <span>Add 3-line engineering prompt rule for AI takeoff...</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(item)}
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Edit Prompt Rule"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          {hasPromptRule && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleClearRule(item)}
                              className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Clear Prompt Rule"
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          )}
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

      {/* Edit 3-Line Prompt Rule Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <SparklesIcon className="size-4" />
              </div>
              <DialogTitle className="text-base font-bold">
                Edit 3-Line Engineering Prompt Rule
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Define concise natural-language matching and quantity criteria. This is directly used by Gemini and RAG vector retrieval.
            </DialogDescription>
          </DialogHeader>

          {activeItem && (
            <div className="space-y-4 py-2">
              {/* Item Info Box */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20 text-xs">
                    {activeItem.code || 'NO CODE'}
                  </span>
                  <span className="text-muted-foreground font-mono font-medium">
                    Rate: ${activeItem.rate.toFixed(2)} / {activeItem.unit}
                  </span>
                </div>
                <div className="font-semibold text-foreground text-sm">{activeItem.name}</div>
              </div>

              {/* 3-Line Prompt Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rule-prompt" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <SparklesIcon className="size-3.5 text-primary" />
                    3-Line Prompt Standard
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {ruleInput.trim().split('\n').filter(Boolean).length} / 3 lines
                  </span>
                </div>

                <textarea
                  id="rule-prompt"
                  rows={5}
                  value={ruleInput}
                  onChange={(e) => setRuleInput(e.target.value)}
                  placeholder={"Line 1: Match standard panel antenna installation scope\nLine 2: Covers antenna mount, tilt brackets, and feeder jumper connection\nLine 3: Quantity: 1 unit per antenna specified in drawing schedule"}
                  className="w-full text-xs p-3 font-mono leading-relaxed rounded-lg border border-border/80 bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary resize-y shadow-2xs"
                />

                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 text-[11px] space-y-1 text-muted-foreground">
                  <p className="font-semibold text-foreground/90">Standard Format Guidelines:</p>
                  <p>• <strong>Line 1 (Trigger Scope):</strong> What equipment and actions in the drawing trigger this SOR item.</p>
                  <p>• <strong>Line 2 (Inclusions/Exclusions):</strong> Brackets, cables, or scope boundaries included in the rate.</p>
                  <p>• <strong>Line 3 (Quantity Rule):</strong> How to count units (e.g. 1 per site, 1 per sector, extra-over).</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs h-8.5 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveRule}
              disabled={isSaving}
              className="text-xs h-8.5 gap-1.5 cursor-pointer shadow-2xs"
            >
              {isSaving ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
              Save Prompt Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
