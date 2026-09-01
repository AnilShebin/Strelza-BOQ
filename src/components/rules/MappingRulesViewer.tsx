import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@/components/ui/select';
import {
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  RotateCcwIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  FilterIcon,
  SparklesIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export interface MappingRuleItem {
  id: number;
  rule_name: string;
  category: string;
  equipment_type: string;
  match_keywords: string;
  exclude_keywords: string;
  condition_expr: string;
  action_filter: string;
  target_sor_code: string;
  target_sor_name?: string;
  qty_formula: string;
  comment_template: string;
  priority: number;
  enabled: number;
  internal_id?: string;
  conditions_json?: string;
  actions_json?: string;
  logic_explanation?: string;
  regex_pattern?: string;
  primary_source?: string;
  preferred_source_type?: string;
  ignore_pages?: string;
  duplicate_prone_pages?: string;
  matching_conditions?: string;
  notes?: string;
}

const DEFAULT_MAPPING_RULES: MappingRuleItem[] = [
  {
    id: 1,
    internal_id: 'R001',
    rule_name: 'Install Panel Antenna <= 2.0m on existing mount',
    category: 'Antennas & RRUs',
    equipment_type: 'PANEL_ANTENNA',
    match_keywords: 'PANEL, ANTENNA, NNHH, RVVPX, COMMSCOPE',
    exclude_keywords: 'TMA, RRU, FEEDER',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '1010-01',
    qty_formula: '1',
    comment_template: 'Extracted from Antenna Layout',
    priority: 10,
    enabled: 1,
    matching_conditions: 'Proposed panel antenna on existing tower mount',
    notes: 'Standard antenna install rate',
  },
  {
    id: 2,
    internal_id: 'R002',
    rule_name: 'Install Remote Radio Unit (RRU) on tower mount',
    category: 'Antennas & RRUs',
    equipment_type: 'RRU',
    match_keywords: 'RRU, RADIO, 4415, AIRSCALE, NOKIA, ERICSSON',
    exclude_keywords: 'PANEL, FEEDER',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '1010-02',
    qty_formula: '1',
    comment_template: 'Extracted from Equipment Schedule',
    priority: 9,
    enabled: 1,
    matching_conditions: 'Remote Radio Unit tower mounting',
    notes: 'Radio unit installation',
  },
  {
    id: 3,
    internal_id: 'R003',
    rule_name: 'Recover existing legacy antenna & mount hardware',
    category: 'Antennas & RRUs',
    equipment_type: 'PANEL_ANTENNA',
    match_keywords: 'REMOVE, DECOMMISSION, RECOVER, RETIRE, OLD',
    exclude_keywords: 'PROPOSED, NEW',
    condition_expr: 'ACTION == REMOVE',
    action_filter: 'REMOVE',
    target_sor_code: '1020-05',
    qty_formula: '1',
    comment_template: 'Decommissioned legacy antenna',
    priority: 8,
    enabled: 1,
    matching_conditions: 'Decommissioning of legacy equipment',
    notes: 'Recovery SOR item',
  },
  {
    id: 4,
    internal_id: 'R004',
    rule_name: 'Install 1/2" Coaxial Feeder Cable per metre run',
    category: 'Power & Feeder',
    equipment_type: 'FEEDER',
    match_keywords: 'FEEDER, COAX, LDF4, HELIAX, 1/2"',
    exclude_keywords: 'HYBRID, POWER',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '2010-01',
    qty_formula: 'LENGTH_METRES',
    comment_template: 'Feeder run from gantry to antenna',
    priority: 7,
    enabled: 1,
    matching_conditions: 'Coaxial feeder cabling',
    notes: 'Per meter rate',
  },
  {
    id: 5,
    internal_id: 'R005',
    rule_name: 'Install DC Over-Voltage Surge Protection Box (OVP)',
    category: 'Power & Feeder',
    equipment_type: 'OVP',
    match_keywords: 'DC6, SURGE, OVP, RAYCAP, ARRESTOR',
    exclude_keywords: 'FEEDER',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '2020-03',
    qty_formula: '1',
    comment_template: 'DC surge suppressor junction box',
    priority: 6,
    enabled: 1,
    matching_conditions: 'DC power surge suppressor installation',
    notes: 'Tower top distribution box',
  },
  {
    id: 6,
    internal_id: 'R006',
    rule_name: 'Heavy-Duty Triangular Tower Headframe Mount Assembly',
    category: 'Civil & Rigging',
    equipment_type: 'MOUNT',
    match_keywords: 'HEADFRAME, MOUNT, STEELWORK, TRIANGULAR',
    exclude_keywords: 'ANTENNA',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '3010-04',
    qty_formula: '1',
    comment_template: 'Structural headframe steelwork',
    priority: 5,
    enabled: 1,
    matching_conditions: 'Tower headframe mounting assembly',
    notes: 'Headframe rigging works',
  },
  {
    id: 7,
    internal_id: 'R007',
    rule_name: 'Climbing Ladder Safety Cable Fall-Arrest System',
    category: 'Civil & Rigging',
    equipment_type: 'SAFETY',
    match_keywords: 'LADDER, FALL-ARREST, CABLOC, LATCHWAYS',
    exclude_keywords: 'ANTENNA',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '3020-02',
    qty_formula: 'LENGTH_METRES',
    comment_template: 'Tower safety climbing cable',
    priority: 5,
    enabled: 1,
    matching_conditions: 'Tower safety climbing system installation',
    notes: 'Rigging safety installation',
  },
  {
    id: 8,
    internal_id: 'R008',
    rule_name: 'Site Commissioning, Sweep Testing & PIM Certification',
    category: 'Testing & Integration',
    equipment_type: 'TESTING',
    match_keywords: 'COMMISSIONING, SWEEP, PIM, TESTING, VSWR',
    exclude_keywords: 'CRANE',
    condition_expr: 'ACTION == INSTALL',
    action_filter: 'INSTALL',
    target_sor_code: '5010-02',
    qty_formula: '1',
    comment_template: 'Carrier integration & site QA handover',
    priority: 4,
    enabled: 1,
    matching_conditions: 'RF testing, line sweeps and PIM tests',
    notes: 'Mandatory handover certification',
  },
];

interface CustomDropdownProps {
  items: any[];
  selectedValue: { code?: string; name?: string } | null;
  onChange: (item: any) => void;
  placeholder?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  items,
  selectedValue,
  onChange,
  placeholder = 'Search SOR Item...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        (item.code || '').toLowerCase().includes(term) ||
        (item.name || '').toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const selectedItem = useMemo(() => {
    if (!selectedValue) return null;
    return items.find((item) => item.code === selectedValue.code && item.name === selectedValue.name);
  }, [items, selectedValue]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className="w-full h-8 px-2.5 bg-background border border-border/80 rounded-md text-xs outline-none focus:border-primary font-medium text-foreground text-left flex items-center justify-between shadow-2xs cursor-pointer"
      >
        <span className="truncate pr-4">
          {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : '-- Choose from Price List --'}
        </span>
        <ChevronDownIcon className={`size-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-50 bg-popover border border-border/80 rounded-lg shadow-xl max-h-[260px] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="p-2 border-b border-border/80 bg-muted/40 flex items-center gap-1.5 shrink-0">
            <SearchIcon className="size-3 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-7 bg-background border border-border/80 rounded px-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">No matching items found</div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = item.code === selectedValue?.code && item.name === selectedValue?.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(item);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex flex-col gap-0.5 hover:bg-muted/60 cursor-pointer transition-colors border-b border-border/40 last:border-b-0 ${
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-[10px] text-primary shrink-0">{item.code}</span>
                      {item.category && (
                        <span className="text-[9px] px-1 bg-muted rounded text-muted-foreground uppercase max-w-[180px] truncate">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <span className="text-left leading-snug whitespace-normal break-words text-[11px]">{item.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const getActionBadgeStyle = (action: string) => {
  const a = (action || '').toUpperCase();
  if (a === 'INSTALL') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (a === 'REMOVE') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
  if (a === 'RELOCATE') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
};

interface MappingRulesViewerProps {
  embedded?: boolean;
}

export const MappingRulesViewer: React.FC<MappingRulesViewerProps> = ({ embedded = false }) => {
  const [rules, setRules] = useState<MappingRuleItem[]>(DEFAULT_MAPPING_RULES);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<Partial<MappingRuleItem> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ isOpen: boolean; ruleId?: number; ruleName?: string } | null>(null);

  // Background non-blocking fetch with 1.2s timeout
  const fetchRules = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    try {
      const res = await fetch('http://localhost:8000/api/mapping-rules', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRules(data);
        }
      }
    } catch {
      // Keep static defaults smoothly without any lag
    }
  }, []);

  const fetchPriceList = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    try {
      const res = await fetch('http://localhost:8000/api/price-list', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPriceListItems(data);
      }
    } catch {
      // Ignore fallback
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchPriceList();
  }, [fetchRules, fetchPriceList]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [rules]);

  const [sortKey, setSortKey] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const processedRules = useMemo(() => {
    const list = rules.filter((r) => {
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false;
      if (selectedAction !== 'ALL' && r.action_filter !== selectedAction) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.rule_name || '').toLowerCase().includes(q);
        const matchSor = (r.target_sor_code || '').toLowerCase().includes(q);
        const matchKeywords = (r.match_keywords || '').toLowerCase().includes(q);
        const matchType = (r.equipment_type || '').toLowerCase().includes(q);
        const matchId = (r.internal_id || '').toLowerCase().includes(q);
        if (!matchName && !matchSor && !matchKeywords && !matchType && !matchId) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      let aVal: any = (a as any)[sortKey] ?? '';
      let bVal: any = (b as any)[sortKey] ?? '';
      if (typeof aVal === 'string') {
        const comp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comp : -comp;
      }
      return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [rules, selectedCategory, selectedAction, searchQuery, sortKey, sortDirection]);

  const handleSelectRow = (id: number) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (processedRules.length === 0) return;
    const allSelected = processedRules.every((r) => selectedRuleIds.has(r.id));
    if (allSelected) {
      setSelectedRuleIds(new Set());
    } else {
      setSelectedRuleIds(new Set(processedRules.map((r) => r.id)));
    }
  };

  const handleToggleRule = (rule: MappingRuleItem) => {
    const nextStatus = rule.enabled === 1 ? 0 : 1;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextStatus } : r)));
    toast.success(`Rule "${rule.rule_name}" ${nextStatus === 1 ? 'enabled' : 'disabled'}`);
  };

  const handleOpenAddModal = () => {
    setEditingRule({
      rule_name: '',
      category: 'Antennas & RRUs',
      equipment_type: 'PANEL_ANTENNA',
      match_keywords: '',
      exclude_keywords: '',
      condition_expr: '',
      action_filter: 'INSTALL',
      target_sor_code: '',
      qty_formula: '1',
      comment_template: '',
      priority: 5,
      enabled: 1,
      matching_conditions: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: MappingRuleItem) => {
    setEditingRule({ ...rule });
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule?.rule_name || !editingRule?.target_sor_code) {
      toast.error('Rule name and SOR code are required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingRule.id) {
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? ({ ...r, ...editingRule } as MappingRuleItem) : r)));
        toast.success(`Updated rule "${editingRule.rule_name}"`);
      } else {
        const newRule: MappingRuleItem = {
          ...(editingRule as MappingRuleItem),
          id: Date.now(),
          internal_id: `R${(rules.length + 1).toString().padStart(3, '0')}`,
        };
        setRules((prev) => [newRule, ...prev]);
        toast.success(`Created rule "${editingRule.rule_name}"`);
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = (rule: MappingRuleItem) => {
    setDeleteConfirmState({ isOpen: true, ruleId: rule.id, ruleName: rule.rule_name });
  };

  const confirmDelete = () => {
    if (!deleteConfirmState?.ruleId) return;
    const id = deleteConfirmState.ruleId;
    setRules((prev) => prev.filter((r) => r.id !== id));
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('Mapping rule removed.');
    setDeleteConfirmState(null);
  };

  const handleDeleteSelected = () => {
    setRules((prev) => prev.filter((r) => !selectedRuleIds.has(r.id)));
    toast.success(`Removed ${selectedRuleIds.size} mapping rules.`);
    setSelectedRuleIds(new Set());
  };

  const handleResetDefaults = () => {
    setRules(DEFAULT_MAPPING_RULES);
    toast.success('Restored default Telstra wireless extraction ruleset.');
  };

  return (
    <div className={`flex-1 flex flex-col ${embedded ? 'p-0' : 'p-4 md:p-6'} bg-background select-none min-h-0 text-foreground animate-fadeIn gap-4 overflow-hidden font-sans`}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-normal tracking-tight text-foreground">
            Extraction & Mapping Rules
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            Configure automated BOM extraction rules, action filters, and SOR item mappings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <RotateCcwIcon className="size-3.5 text-muted-foreground" />
            <span>Reset Defaults</span>
          </Button>

          {selectedRuleIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg font-medium"
            >
              <Trash2Icon className="size-3.5" />
              <span>Delete Selected ({selectedRuleIds.size})</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 font-medium rounded-lg"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Mapping Rule</span>
          </Button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 w-full border border-border/80 rounded-xl bg-card flex flex-col min-h-0 overflow-hidden shadow-xs">
        {/* Top Control Toolbar */}
        <div className="p-3.5 px-4.5 border-b border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative w-80 sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules, keywords, SOR codes..."
              className="h-8.5 pl-8.5 pr-8 text-xs bg-background/90 focus-visible:bg-background border-border/70 rounded-lg shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs">
                  <FilterIcon className="size-3.5 text-muted-foreground" />
                  <span>Category: {selectedCategory}</span>
                  <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal px-2 py-1">
                  Filter by Category
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>{c}</span>
                    {selectedCategory === c && <CheckIcon className="size-3.5 ml-2 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Action Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs">
                  <span>Action: {selectedAction}</span>
                  <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 text-xs">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal px-2 py-1">
                  Filter by Action
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['ALL', 'INSTALL', 'REMOVE', 'RELOCATE'].map((act) => (
                  <DropdownMenuItem
                    key={act}
                    onClick={() => setSelectedAction(act)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>{act}</span>
                    {selectedAction === act && <CheckIcon className="size-3.5 ml-2 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-md border-b border-border/80 shadow-xs">
              <tr className="hover:bg-transparent border-b border-border/80 bg-muted/95">
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-12 first:w-12 first:px-0 first:text-center">
                  <div className="w-12 flex items-center justify-center">
                    <Checkbox
                      checked={processedRules.length > 0 && processedRules.every((r) => selectedRuleIds.has(r.id))}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className="size-4 rounded border-border/80"
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('internal_id')}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-24 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Rule ID</span>
                    {sortKey === 'internal_id' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rule_name')}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Rule Name & Target Mapping</span>
                    {sortKey === 'rule_name' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('action_filter')}
                  className="h-10 px-3 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-28 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Action</span>
                    {sortKey === 'action_filter' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-36 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    {sortKey === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none min-w-[220px]">
                  Match Keywords
                </th>
                <th
                  onClick={() => handleSort('target_sor_code')}
                  className="h-10 px-3 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-28 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>SOR Code</span>
                    {sortKey === 'target_sor_code' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('enabled')}
                  className="h-10 px-3 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-24 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {sortKey === 'enabled' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="h-10 px-3 text-right align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-24 pr-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Only show skeleton if genuinely loading without any loaded rules */}
              {loading && rules.length === 0 ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-border/70">
                    <td className="py-3 px-3 text-center"><Skeleton className="size-4 mx-auto rounded" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-12 rounded" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-56 rounded" /></td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-24 rounded" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-40 rounded" /></td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-14 mx-auto rounded" /></td>
                    <td className="py-3 px-3 text-center"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
                    <td className="py-3 px-3 text-right pr-4"><Skeleton className="h-6 w-12 ml-auto rounded" /></td>
                  </tr>
                ))
              ) : processedRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="h-32 text-center text-muted-foreground text-xs font-medium">
                    No mapping rules found matching criteria.
                  </td>
                </tr>
              ) : (
                processedRules.map((rule) => {
                  const isSelected = selectedRuleIds.has(rule.id);
                  return (
                    <tr
                      key={rule.id}
                      className={`relative z-0 hover:bg-muted/30 transition-colors border-b border-border/70 group ${
                        isSelected ? 'bg-muted/50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center align-middle w-12 first:w-12 first:px-0 first:text-center">
                        <div className="w-12 flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectRow(rule.id)}
                            aria-label="Select row"
                            className="size-4 rounded border-border/80"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <span className="font-mono text-[10.5px] font-semibold text-muted-foreground px-2 py-0.5 rounded bg-muted/80 border border-border/60 select-none">
                          {rule.internal_id || `R${rule.id.toString().padStart(3, '0')}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="font-semibold text-foreground text-xs leading-snug group-hover:text-primary transition-colors cursor-pointer">
                          {rule.rule_name}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5 transition-colors">
                          <span className="text-foreground/80 group-hover:text-foreground">{rule.equipment_type || 'GENERAL'}</span>
                          <span>•</span>
                          <span>Priority {rule.priority}</span>
                          {rule.notes && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[240px]">{rule.notes}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center align-middle">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-semibold tracking-wider rounded-full border uppercase ${getActionBadgeStyle(
                            rule.action_filter
                          )}`}
                        >
                          {rule.action_filter || 'INSTALL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-middle text-xs text-muted-foreground font-medium">
                        {rule.category || 'General'}
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-wrap gap-1 items-center max-w-[320px]">
                          {(rule.match_keywords || '')
                            .split(',')
                            .map((k) => k.trim())
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((kw, kIdx) => (
                              <span
                                key={kIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/80 text-foreground border border-border/60"
                              >
                                {kw}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center align-middle">
                        <span className="font-mono text-xs font-semibold text-emerald-400">
                          {rule.target_sor_code || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center align-middle">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className="cursor-pointer inline-flex items-center gap-1.5"
                          title="Click to toggle rule"
                        >
                          {rule.enabled === 1 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full">
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground bg-muted border border-border/60 rounded-full">
                              Off
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right align-middle pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(rule)}
                            title="Edit Rule"
                            className="size-7 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule)}
                            title="Delete Rule"
                            className="size-7 text-muted-foreground hover:text-destructive rounded-md cursor-pointer"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Summary Bar */}
        <div className="p-3 px-4.5 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between text-xs select-none shrink-0 gap-2">
          <div className="flex items-center gap-3 text-muted-foreground font-medium">
            <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50 text-[11px]">
              {selectedRuleIds.size} of {processedRules.length} selected
            </span>
            <span className="hidden sm:inline">
              Rules Active: <strong className="text-foreground font-semibold">{rules.filter((r) => r.enabled === 1).length}</strong> of {rules.length}
            </span>
          </div>

          <div className="flex items-center gap-3 font-medium">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <SparklesIcon className="size-3 text-emerald-400" />
              <span className="text-[11px] text-emerald-400/80 font-normal">Extraction Rules:</span>
              <strong className="text-sm font-bold text-emerald-400 tracking-tight">
                {rules.length} Loaded
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Mapping Rule Shadcn Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingRule?.id ? 'Edit Commercial Mapping Rule' : 'Add New Mapping Rule'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure extraction matching conditions, action filter, and SOR item association.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <form onSubmit={handleSaveRule} className="flex flex-col gap-3.5 py-1">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Select Price List SOR Item *</Label>
                <CustomDropdown
                  items={priceListItems}
                  selectedValue={{ code: editingRule.target_sor_code, name: editingRule.rule_name }}
                  onChange={(item) => {
                    setEditingRule({
                      ...editingRule,
                      rule_name: item.name,
                      target_sor_code: item.code,
                      category: item.category || 'General',
                    });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Rule ID (Auto-generated)</Label>
                  <Input
                    disabled
                    value={editingRule.internal_id || 'AUTO'}
                    className="h-8 text-xs font-mono opacity-70 cursor-not-allowed"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Action Filter</Label>
                  <Select
                    value={editingRule.action_filter || 'INSTALL'}
                    onValueChange={(val) => setEditingRule({ ...editingRule, action_filter: val })}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectGroup>
                        {['INSTALL', 'REMOVE', 'RELOCATE', 'REPLACE'].map((act) => (
                          <SelectItem key={act} value={act} className="text-xs">
                            {act}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Equipment Type</Label>
                  <Input
                    placeholder="e.g. PANEL_ANTENNA, RRU"
                    value={editingRule.equipment_type || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, equipment_type: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Category</Label>
                  <Input
                    placeholder="e.g. Antennas & RRUs"
                    value={editingRule.category || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Match Keywords (Comma-separated) *</Label>
                <Input
                  placeholder="e.g. KAELUS, RVVPX, ARGUS, PANEL"
                  value={editingRule.match_keywords || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, match_keywords: e.target.value })}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Exclude Keywords</Label>
                <Input
                  placeholder="e.g. FILTER, COMBINER, TMA, RRU"
                  value={editingRule.exclude_keywords || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, exclude_keywords: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Target SOR Code</Label>
                  <Input
                    disabled
                    value={editingRule.target_sor_code || ''}
                    className="h-8 text-xs font-mono text-emerald-400 font-semibold opacity-80 cursor-not-allowed"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-foreground">Notes</Label>
                  <Input
                    placeholder="e.g. Install 4G panel"
                    value={editingRule.notes || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="text-xs cursor-pointer bg-primary text-primary-foreground font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save Mapping Rule'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirmState?.isOpen)} onOpenChange={(open) => { if (!open) setDeleteConfirmState(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-destructive">Delete Mapping Rule</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Are you sure you want to delete rule <strong>{deleteConfirmState?.ruleName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmState(null)}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              className="text-xs cursor-pointer"
            >
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
