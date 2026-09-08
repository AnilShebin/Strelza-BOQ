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
  LayersIcon,
  CalculatorIcon,
  ActivityIcon,
  MapPinIcon,
  FilterIcon,
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

const CALC_RULES = [
  { value: '', label: 'None / Prompt Only' },
  { value: 'FIRST', label: 'FIRST (1st Unit Base Scope)' },
  { value: 'EXTRA', label: 'EXTRA (Extra-Over Quantity: Total - 1)' },
  { value: 'ALL', label: 'ALL (100% of Units Mapped)' },
  { value: 'PER_SECTOR', label: 'PER_SECTOR (4G + 5G Proposed Sectors)' },
  { value: 'EXTRA_CARRIER', label: 'EXTRA_CARRIER (Extra Carriers per Sector)' },
  { value: 'REUSED_CABLES', label: 'REUSED_CABLES (Reused Coaxial + Hybrid Runs)' },
  { value: 'SUM_TYPES', label: 'SUM_TYPES (Composite Multi-Equipment Sum)' },
  { value: 'COMPOSITE_ONE', label: 'COMPOSITE_ONE (Kit Bundle = 1 Unit)' },
];

const EQUIPMENT_TYPES = [
  { value: '', label: 'Not Specified' },
  { value: 'PANEL_ANTENNA', label: 'PANEL_ANTENNA (4G/LTE Panel Antennas)' },
  { value: '5G_AAU', label: '5G_AAU (Massive MIMO / AIR Antennas)' },
  { value: 'RRU', label: 'RRU (Remote Radio Units / Radios)' },
  { value: 'TMD', label: 'TMD (TMAs, Diplexers, Filters)' },
  { value: 'BASEBAND_RACK', label: 'BASEBAND_RACK (BB6630, DUW, R503, Trays)' },
  { value: 'ROUTER_TRAY', label: 'ROUTER_TRAY (Cell Site Routers & Trays)' },
  { value: 'RP6672', label: 'RP6672 (Radio Processor)' },
  { value: 'FEEDER_CABLE', label: 'FEEDER_CABLE (Coaxial Feeders & Hybrid Trunk)' },
  { value: 'GPS', label: 'GPS (GPS Receiver, Antenna & Splitter)' },
  { value: 'ANTENNA_TMD_RRU', label: 'ANTENNA_TMD_RRU (Tower Top Assets)' },
  { value: 'BLACKBIRD_TEST', label: 'BLACKBIRD_TEST (Blackbird Call/Data Testing)' },
  { value: 'OTHER', label: 'OTHER (General Hardware)' },
];

const ACTIONS = [
  { value: '', label: 'Not Specified' },
  { value: 'INSTALL', label: 'INSTALL (New Installation)' },
  { value: 'REMOVE', label: 'REMOVE (Decommission & Recovery)' },
  { value: 'RELOCATE', label: 'RELOCATE (Height / Rack Modification)' },
  { value: 'REUSE_TEST', label: 'REUSE_TEST (Test Retained Equipment)' },
  { value: 'TEST', label: 'TEST (Blackbird / Commissioning Test)' },
];

const LOCATIONS = [
  { value: '', label: 'Any / Not Specified' },
  { value: 'TOWER', label: 'TOWER (Outdoor Headframe / Mount)' },
  { value: 'SHELTER', label: 'SHELTER (Indoor Equipment Rack)' },
  { value: 'SITE', label: 'SITE (Site-Wide Scope)' },
];

export const PromptRulesViewer: React.FC = () => {
  const [items, setItems] = useState<PromptRuleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [calcFilter, setCalcFilter] = useState<string>('all');
  const [eqTypeFilter, setEqTypeFilter] = useState<string>('all');

  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<PromptRuleItem | null>(null);
  const [ruleInput, setRuleInput] = useState<string>('');
  const [eqTypeInput, setEqTypeInput] = useState<string>('');
  const [actTypeInput, setActTypeInput] = useState<string>('');
  const [locTypeInput, setLocTypeInput] = useState<string>('');
  const [calcRuleInput, setCalcRuleInput] = useState<string>('');
  const [aggRuleInput, setAggRuleInput] = useState<string>('SUM');
  const [pricingGroupInput, setPricingGroupInput] = useState<string>('');
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
    return items.filter((i) => Boolean((i.mapping_rule && i.mapping_rule.trim()) || i.calc_rule)).length;
  }, [items]);

  const unconfiguredCount = items.length - configuredCount;

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isConfigured = Boolean((item.mapping_rule && item.mapping_rule.trim()) || item.calc_rule);
      if (statusFilter === 'configured' && !isConfigured) return false;
      if (statusFilter === 'unconfigured' && isConfigured) return false;

      if (calcFilter !== 'all' && (item.calc_rule || '') !== calcFilter) return false;
      if (eqTypeFilter !== 'all' && (item.equipment_type || '') !== eqTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inCode = item.code.toLowerCase().includes(q);
        const inName = item.name.toLowerCase().includes(q);
        const inRule = (item.mapping_rule || '').toLowerCase().includes(q);
        const inCalc = (item.calc_rule || '').toLowerCase().includes(q);
        const inEq = (item.equipment_type || '').toLowerCase().includes(q);
        if (!inCode && !inName && !inRule && !inCalc && !inEq) return false;
      }

      return true;
    });
  }, [items, statusFilter, calcFilter, eqTypeFilter, searchQuery]);

  const handleOpenEdit = (item: PromptRuleItem) => {
    setActiveItem(item);
    setRuleInput(item.mapping_rule || '');
    setEqTypeInput(item.equipment_type || '');
    setActTypeInput(item.action_type || '');
    setLocTypeInput(item.location_type || '');
    setCalcRuleInput(item.calc_rule || '');
    setAggRuleInput(item.aggregation_rule || 'SUM');
    setPricingGroupInput(item.pricing_group || '');
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!activeItem) return;
    setIsSaving(true);
    try {
      const payload = {
        mapping_rule: ruleInput.trim(),
        equipment_type: eqTypeInput,
        action_type: actTypeInput,
        location_type: locTypeInput,
        calc_rule: calcRuleInput,
        aggregation_rule: aggRuleInput,
        pricing_group: pricingGroupInput.trim(),
      };

      const res = await fetch(`${API_BASE_URL}/${activeItem.row_idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      // Optimistically update local state
      setItems((prev) =>
        prev.map((i) =>
          i.row_idx === activeItem.row_idx
            ? {
                ...i,
                mapping_rule: ruleInput.trim(),
                equipment_type: eqTypeInput,
                action_type: actTypeInput,
                location_type: locTypeInput,
                calc_rule: calcRuleInput,
                aggregation_rule: aggRuleInput,
                pricing_group: pricingGroupInput.trim(),
              }
            : i
        )
      );

      toast.success(`Updated configuration for ${activeItem.code || activeItem.name}`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving rule:', err);
      toast.error('Failed to update rule configuration');
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

      toast.success(`Reset configuration for ${item.code || item.name}`);
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

  // Helper colors for calculation rules
  const getCalcRuleBadgeClass = (rule?: string) => {
    switch (rule) {
      case 'FIRST':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'EXTRA':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ALL':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'PER_SECTOR':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      case 'EXTRA_CARRIER':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'REUSED_CABLES':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'SUM_TYPES':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'COMPOSITE_ONE':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border/60';
    }
  };

  const getActionBadgeClass = (action?: string) => {
    switch (action) {
      case 'INSTALL':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'REMOVE':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'RELOCATE':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'REUSE_TEST':
        return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      case 'TEST':
        return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border/50';
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Header Banner */}
      <div className="border-b border-border/80 px-6 py-4 shrink-0 bg-card/60 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <CalculatorIcon className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  SOR Rules & Calculation Engine
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Two-Stage Hybrid Engine v2
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure deterministic calculation rules and telecom classification attributes for master price items.
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
              placeholder="Search by code, description, type, or rule..."
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
            {/* Calc Rule Filter */}
            <select
              value={calcFilter}
              onChange={(e) => setCalcFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-lg border border-border/80 bg-background text-foreground shadow-2xs focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Calculation Rules</option>
              {CALC_RULES.filter((r) => r.value).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value}
                </option>
              ))}
            </select>

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
                Unconfigured ({unconfiguredCount})
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
                  <th className="h-9 px-4 min-w-[240px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-24 text-right select-none">Rate</th>
                  <th className="h-9 px-3 w-32 text-center select-none">Calculation Rule</th>
                  <th className="h-9 px-3 w-36 text-center select-none">Equipment / Action</th>
                  <th className="h-9 px-4 min-w-[280px] select-none">Rule Notes / Scope</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Array.from({ length: 18 }).map((_, idx) => (
                  <tr key={`rules-skel-${idx}`} className="h-10">
                    <td className="px-3 text-center"><Skeleton className="size-3.5 mx-auto rounded" /></td>
                    <td className="px-3 text-center"><Skeleton className="h-4.5 w-18 mx-auto rounded bg-primary/10 border border-primary/20" /></td>
                    <td className="px-4"><Skeleton className="h-4 w-4/5 rounded" /></td>
                    <td className="px-3 text-right"><Skeleton className="h-4 w-14 ml-auto rounded" /></td>
                    <td className="px-3 text-center"><Skeleton className="h-4 w-20 mx-auto rounded" /></td>
                    <td className="px-3 text-center"><Skeleton className="h-4 w-24 mx-auto rounded" /></td>
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
                Try adjusting your search query or switching calculation filters.
              </p>
              {(searchQuery || statusFilter !== 'all' || calcFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setCalcFilter('all');
                    setEqTypeFilter('all');
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
                  <th className="h-9 px-4 min-w-[240px] select-none">Price Book Item Name</th>
                  <th className="h-9 px-3 w-24 text-right select-none">Rate</th>
                  <th className="h-9 px-3 w-32 text-center select-none">Calculation Rule</th>
                  <th className="h-9 px-3 w-36 text-center select-none">Equipment & Action</th>
                  <th className="h-9 px-4 min-w-[280px] select-none">Rule Notes / Scope</th>
                  <th className="h-9 px-3 w-20 text-center select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const hasCalcRule = Boolean(item.calc_rule && item.calc_rule.trim());
                  const hasPromptRule = Boolean(item.mapping_rule && item.mapping_rule.trim());
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        hasCalcRule || hasPromptRule ? 'bg-background' : 'bg-muted/10'
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
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {item.unit && <span>Unit: {item.unit}</span>}
                          {item.aggregation_rule && (
                            <span className="px-1.5 py-0.2 rounded font-mono bg-muted border border-border/60 text-[9.5px]">
                              Agg: {item.aggregation_rule}
                            </span>
                          )}
                          {item.pricing_group && (
                            <span className="text-muted-foreground/75 truncate max-w-[140px]">
                              Grp: {item.pricing_group}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                        ${item.rate.toFixed(2)}
                      </td>

                      {/* Calculation Rule Badge */}
                      <td className="py-2.5 px-3 text-center">
                        {hasCalcRule ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-semibold text-[10.5px] border ${getCalcRuleBadgeClass(
                              item.calc_rule
                            )}`}
                          >
                            <CalculatorIcon className="size-3 shrink-0" />
                            {item.calc_rule}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60 italic font-mono">-</span>
                        )}
                      </td>

                      {/* Equipment & Action */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {item.equipment_type ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted border border-border/70 text-foreground">
                              {item.equipment_type}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-1">
                            {item.action_type ? (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-semibold font-mono border ${getActionBadgeClass(
                                  item.action_type
                                )}`}
                              >
                                {item.action_type}
                              </span>
                            ) : null}
                            {item.location_type ? (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-background border border-border/70 text-muted-foreground">
                                {item.location_type}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Rule Notes / Prompt */}
                      <td className="py-2 px-4">
                        {hasPromptRule ? (
                          <div
                            onClick={() => handleOpenEdit(item)}
                            className="group relative cursor-pointer p-2 rounded-lg border border-border/80 bg-muted/20 hover:bg-muted/40 transition-all text-foreground text-xs leading-relaxed"
                            title="Click to edit configuration"
                          >
                            <div className="flex items-start gap-1.5">
                              <SparklesIcon className="size-3 text-primary shrink-0 mt-0.5" />
                              <span className="flex-1 select-text text-[11px] line-clamp-2">{item.mapping_rule}</span>
                              <PencilIcon className="size-3 opacity-0 group-hover:opacity-60 text-muted-foreground shrink-0 mt-0.5 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="w-full text-left py-1.5 px-2.5 rounded-lg border border-dashed border-border/70 hover:border-primary/50 bg-muted/10 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-[11px] flex items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="text-xs font-bold text-muted-foreground/60 group-hover:text-primary">+</span>
                            <span className="italic opacity-80">Configure calculation rule...</span>
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
                            title="Edit Rule Configuration"
                            className="size-7 text-muted-foreground hover:text-primary rounded-md cursor-pointer"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!hasCalcRule && !hasPromptRule}
                            onClick={() => handleClearRule(item)}
                            title={hasCalcRule || hasPromptRule ? 'Clear Configuration' : 'No rule defined'}
                            className={`size-7 rounded-md cursor-pointer ${
                              hasCalcRule || hasPromptRule
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
        <DialogContent className="sm:max-w-[620px] p-5">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="size-4 text-primary" />
              <DialogTitle className="text-base font-semibold">
                Configure SOR Calculation & Attributes
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Define deterministic calculation rules and equipment taxonomy for high-accuracy takeoff.
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

              {/* Structured Controls Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Calculation Rule */}
                <div className="space-y-1">
                  <Label htmlFor="calc-rule" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <CalculatorIcon className="size-3 text-primary" />
                    Calculation Handler
                  </Label>
                  <select
                    id="calc-rule"
                    value={calcRuleInput}
                    onChange={(e) => setCalcRuleInput(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border/80 bg-background text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {CALC_RULES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aggregation Rule */}
                <div className="space-y-1">
                  <Label htmlFor="agg-rule" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <LayersIcon className="size-3 text-primary" />
                    Site Aggregation
                  </Label>
                  <select
                    id="agg-rule"
                    value={aggRuleInput}
                    onChange={(e) => setAggRuleInput(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border/80 bg-background text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="MAX">MAX (Consolidated Whole-Site Scope)</option>
                    <option value="SUM">SUM (Incremental Unit Summation)</option>
                  </select>
                </div>

                {/* Equipment Type */}
                <div className="space-y-1">
                  <Label htmlFor="eq-type" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <TagIcon className="size-3 text-primary" />
                    Equipment Type
                  </Label>
                  <select
                    id="eq-type"
                    value={eqTypeInput}
                    onChange={(e) => setEqTypeInput(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border/80 bg-background text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Type */}
                <div className="space-y-1">
                  <Label htmlFor="act-type" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <ActivityIcon className="size-3 text-primary" />
                    Action Required
                  </Label>
                  <select
                    id="act-type"
                    value={actTypeInput}
                    onChange={(e) => setActTypeInput(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border/80 bg-background text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <Label htmlFor="loc-type" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <MapPinIcon className="size-3 text-primary" />
                    Physical Location
                  </Label>
                  <select
                    id="loc-type"
                    value={locTypeInput}
                    onChange={(e) => setLocTypeInput(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border/80 bg-background text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pricing Group */}
                <div className="space-y-1">
                  <Label htmlFor="pricing-group" className="text-xs font-semibold text-foreground">
                    Pricing Group / Family
                  </Label>
                  <Input
                    id="pricing-group"
                    value={pricingGroupInput}
                    onChange={(e) => setPricingGroupInput(e.target.value)}
                    placeholder="e.g. PANEL_ANTENNA_INSTALL"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Optional Plain-English Notes */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="rule-prompt" className="text-xs font-semibold text-foreground">
                  Optional Prompt Notes / Special Instructions
                </Label>
                <textarea
                  id="rule-prompt"
                  rows={3}
                  value={ruleInput}
                  onChange={(e) => setRuleInput(e.target.value)}
                  placeholder="Optional explanatory notes or specific table citation instructions."
                  className="w-full text-xs p-2.5 rounded-lg border border-border/80 bg-background focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-y"
                />
                <div className="flex justify-between items-center text-[10.5px] text-muted-foreground">
                  <span>Deterministic calculation runs automatically via the selected Calculation Handler.</span>
                  <span>{ruleInput.trim().length} chars</span>
                </div>
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
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
