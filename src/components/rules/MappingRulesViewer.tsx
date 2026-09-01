import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../common/Icon';
import { toast, confirmModal } from '../common/Toast';

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

interface CustomDropdownProps {
  items: any[];
  selectedValue: { code?: string; name?: string } | null;
  onChange: (item: any) => void;
  placeholder?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ items, selectedValue, onChange, placeholder = 'Search Price List Item...' }) => {
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
    return items.filter(item => 
      (item.code || '').toLowerCase().includes(term) ||
      (item.name || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const selectedItem = useMemo(() => {
    if (!selectedValue) return null;
    return items.find(item => item.code === selectedValue.code && item.name === selectedValue.name);
  }, [items, selectedValue]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className="w-full h-8 px-2.5 bg-bg-app border border-border-color rounded text-xs outline-none focus:border-accent-blue font-semibold text-text-primary text-left flex items-center justify-between shadow-sm cursor-pointer"
      >
        <span className="truncate pr-4">
          {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : '-- Choose an item from the Price List --'}
        </span>
        <Icon name="chevron_down" size={14} className={`text-text-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-50 bg-bg-panel border border-border-color rounded shadow-xl max-h-[300px] flex flex-col overflow-hidden animate-fadeIn">
          <div className="p-2 border-b border-border-color bg-bg-app flex items-center gap-1.5 shrink-0">
            <Icon name="search" size={12} className="text-text-muted" />
            <input
              type="text"
              autoFocus
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-7 bg-bg-panel border border-border-color rounded px-2 text-xs text-text-primary outline-none focus:border-accent-blue"
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-panel py-1">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted italic text-center">No items found</div>
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
                    className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-accent-blue/10 hover:text-accent-blue cursor-pointer transition-colors border-b border-border-color/10 last:border-b-0 ${
                      isSelected ? 'bg-accent-blue/5 text-accent-blue font-bold border-l-2 border-accent-blue' : 'text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[10px] text-accent-blue shrink-0">{item.code}</span>
                      {item.category && (
                        <span className="text-[9px] px-1 bg-bg-app border border-border-color rounded text-text-muted uppercase max-w-[200px] truncate">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <span className="text-left leading-relaxed whitespace-normal break-words">{item.name}</span>
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


interface MappingRulesViewerProps {
  embedded?: boolean;
}

export const MappingRulesViewer: React.FC<MappingRulesViewerProps> = ({ embedded = false }) => {
  const [rules, setRules] = useState<MappingRuleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<Partial<MappingRuleItem> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [testRegexInput, setTestRegexInput] = useState<string>('');
  const [testRegexResult, setTestRegexResult] = useState<{ isMatch: boolean; matches: string[]; error?: string } | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchPriceList = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/price-list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = (data.items || []).filter((item: any) => item.row_type === 'data_item');
      setPriceListItems(items);
      
      const cats = Array.from(new Set(items.map((item: any) => item.category).filter(Boolean))) as string[];
      setCategories(cats.sort());
    } catch (err) {
      console.error('[MappingRules] Failed to fetch price list:', err);
    }
  };

  const sorCodeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rules) {
      if (r.target_sor_code && r.target_sor_code !== 'UNQUOTED') {
        counts[r.target_sor_code] = (counts[r.target_sor_code] || 0) + 1;
      }
    }
    return counts;
  }, [rules]);

  const activeSorCodes = useMemo(() => {
    return new Set(priceListItems.map(item => item.code).filter(Boolean));
  }, [priceListItems]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = processedRules.map(r => r.id);
      setSelectedRuleIds(new Set(allIds));
    } else {
      setSelectedRuleIds(new Set());
    }
  };

  const handleSelectRow = (ruleId: number) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedRuleIds.size === 0) return;
    
    confirmModal({
      title: 'Delete Selected Rules',
      message: `Are you sure you want to delete the ${selectedRuleIds.size} selected mapping rules? This action cannot be undone.`,
      confirmText: `Delete ${selectedRuleIds.size} Rules`,
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          const idsArray = Array.from(selectedRuleIds);
          for (const ruleId of idsArray) {
            await fetch(`http://localhost:8000/api/mapping-rules/${ruleId}`, {
              method: 'DELETE',
            });
          }
          toast.success(`${selectedRuleIds.size} rules deleted.`);
          setSelectedRuleIds(new Set());
          await fetchRules();
        } catch (err) {
          console.error('[MappingRules] Bulk delete error:', err);
          toast.error('Failed to delete some mapping rules.');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const testLiveRegex = (pattern: string, input: string) => {
    if (!pattern.trim() || !input.trim()) {
      setTestRegexResult(null);
      return;
    }
    try {
      const reg = new RegExp(pattern, 'i');
      const match = input.match(reg);
      if (match) {
        setTestRegexResult({
          isMatch: true,
          matches: Array.from(match),
        });
      } else {
        setTestRegexResult({
          isMatch: false,
          matches: [],
        });
      }
    } catch (e: any) {
      setTestRegexResult({
        isMatch: false,
        matches: [],
        error: e.message || 'Invalid regular expression',
      });
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/mapping-rules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRules(data);
      } else {
        setRules([]);
      }
    } catch (err) {
      console.error('[MappingRules] Failed to load rules, using standard defaults:', err);
      setRules([
        {
          id: 1,
          internal_id: 'R001',
          rule_name: 'Install Panel Antenna <= 2.0m',
          category: 'Antennas, RRUs, TMDs',
          equipment_type: 'Antenna',
          action_filter: 'INSTALL',
          match_keywords: 'NNHH, CommScope, Panel, 8-Port',
          exclude_keywords: 'Omni',
          condition_expr: 'length <= 2.0',
          target_sor_code: '1010-01',
          target_sor_name: 'Install Panel Antenna <= 2.0m on existing mount',
          qty_formula: 'COUNT(matched_items)',
          comment_template: 'Matched via drawing antenna schedule',
          priority: 10,
          enabled: 1,
          matching_conditions: 'Model = CommScope NNHH-65B-R4, Action = INSTALL',
          notes: 'Standard sector panel antenna replacement',
          primary_source: 'Layout Drawing',
          preferred_source_type: 'Schedule Table'
        },
        {
          id: 2,
          internal_id: 'R002',
          rule_name: 'Install Remote Radio Unit (RRU)',
          category: 'Antennas, RRUs, TMDs',
          equipment_type: 'RRU',
          action_filter: 'INSTALL',
          match_keywords: '4415, Radio 4415, KRC 161',
          exclude_keywords: '',
          condition_expr: 'model contains 4415',
          target_sor_code: '1010-02',
          target_sor_name: 'Install Remote Radio Unit (RRU) on tower mount',
          qty_formula: 'COUNT(matched_items)',
          comment_template: 'Matched via layout equipment table',
          priority: 20,
          enabled: 1,
          matching_conditions: 'Model contains 4415 or 2219, Action = INSTALL',
          notes: 'Ericsson 4415 dual band radio',
          primary_source: 'Elevation Layout',
          preferred_source_type: 'Equipment Box'
        },
        {
          id: 3,
          internal_id: 'R003',
          rule_name: 'Legacy Antenna Decommissioning',
          category: 'Antennas, RRUs, TMDs',
          equipment_type: 'Antenna',
          action_filter: 'REMOVE',
          match_keywords: 'Recover, Remove, Existing to be removed',
          exclude_keywords: '',
          condition_expr: 'action == "REMOVE"',
          target_sor_code: '1020-05',
          target_sor_name: 'Recover existing legacy antenna & mount hardware',
          qty_formula: 'COUNT(matched_items)',
          comment_template: 'Drawing redline removal instruction',
          priority: 30,
          enabled: 1,
          matching_conditions: 'Action = REMOVE or Status = Decommission',
          notes: '3G antenna decommissioning requirement',
          primary_source: 'Redline Notes',
          preferred_source_type: 'Annotation'
        },
        {
          id: 4,
          internal_id: 'R004',
          rule_name: 'DC Surge Suppression Unit (Raycap)',
          category: 'Power, Feeder & Auxiliaries',
          equipment_type: 'Ancillary',
          action_filter: 'INSTALL',
          match_keywords: 'Raycap, DC6, OVP, Surge',
          exclude_keywords: '',
          condition_expr: '',
          target_sor_code: '2020-03',
          target_sor_name: 'Install DC Over-Voltage Surge Protection Box (OVP)',
          qty_formula: 'COUNT(matched_items)',
          comment_template: 'Power layout distribution requirement',
          priority: 40,
          enabled: 1,
          matching_conditions: 'Equipment = Raycap DC6-48-60-18-8F',
          notes: 'Main tower junction OVP surge enclosure',
          primary_source: 'Schematic',
          preferred_source_type: 'Single Line Diagram'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchPriceList();
  }, []);

  const processedRules = useMemo(() => {
    let list = rules;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        return (
          r.rule_name.toLowerCase().includes(q) ||
          r.equipment_type.toLowerCase().includes(q) ||
          (r.internal_id || '').toLowerCase().includes(q) ||
          (r.matching_conditions || '').toLowerCase().includes(q) ||
          (r.target_sor_code || '').toLowerCase().includes(q) ||
          (r.target_sor_name || '').toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => {
      const codeA = a.internal_id || `R${a.id.toString().padStart(3, '0')}`;
      const codeB = b.internal_id || `R${b.id.toString().padStart(3, '0')}`;
      return codeA.localeCompare(codeB);
    });
  }, [rules, searchQuery]);



  const handleToggle = async (ruleId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/mapping-rules/toggle/${ruleId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: data.enabled } : r))
      );
      toast.success(`Rule ${data.enabled === 1 ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      console.error('[MappingRules] Toggle error:', err);
      toast.error('Failed to toggle rule state.');
    }
  };

  const handleOpenAddModal = () => {
    const maxNum = rules.reduce((max, r) => {
      const match = (r.internal_id || '').match(/^R(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const nextInternalId = `R${(maxNum + 1).toString().padStart(3, '0')}`;

    setEditingRule({
      internal_id: nextInternalId,
      rule_name: '',
      category: 'General',
      equipment_type: 'PANEL ANTENNA',
      match_keywords: '',
      exclude_keywords: '',
      condition_expr: '',
      action_filter: 'INSTALL',
      target_sor_code: '',
      qty_formula: 'table_qty',
      comment_template: '',
      priority: 100,
      enabled: 1,
      primary_source: '',
      preferred_source_type: 'TABLE',
      ignore_pages: '',
      duplicate_prone_pages: '',
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
    if (!editingRule || !editingRule.rule_name || (!editingRule.match_keywords && !editingRule.matching_conditions)) {
      toast.error('Please fill in Rule Name and either Match Keywords or Matching Conditions.', 'Validation');
      return;
    }

    setIsSaving(true);
    try {
      if (editingRule.id) {
        // Update
        const res = await fetch(`http://localhost:8000/api/mapping-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingRule),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success('Mapping rule updated successfully.');
      } else {
        // Create
        const res = await fetch('http://localhost:8000/api/mapping-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingRule),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success('New mapping rule created.');
      }
      setIsModalOpen(false);
      setEditingRule(null);
      await fetchRules();
    } catch (err) {
      console.error('[MappingRules] Save error:', err);
      toast.error('Failed to save mapping rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = (rule: MappingRuleItem) => {
    confirmModal({
      title: 'Delete Mapping Rule',
      message: `Are you sure you want to delete "${rule.rule_name}"? This action cannot be undone.`,
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/mapping-rules/${rule.id}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Rule deleted.');
          await fetchRules();
        } catch (err) {
          console.error('[MappingRules] Delete error:', err);
          toast.error('Failed to delete mapping rule.');
        }
      },
    });
  };

  const handleResetDefaults = () => {
    confirmModal({
      title: 'Reset Default Rules',
      message: 'Reset all mapping rules to the standard default ruleset? Any custom additions will be overwritten.',
      confirmText: 'Reset Defaults',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch('http://localhost:8000/api/mapping-rules/reset-defaults', {
            method: 'POST',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Restored default mapping rules.');
          await fetchRules();
        } catch (err) {
          console.error('[MappingRules] Reset error:', err);
          toast.error('Failed to reset mapping rules.');
        }
      },
    });
  };

  const handleExportExcel = () => {
    window.location.href = 'http://localhost:8000/api/mapping-rules/export-excel';
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('http://localhost:8000/api/mapping-rules/upload-excel', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(data.message || 'Mapping rules imported from Excel successfully.');
      await fetchRules();
    } catch (err) {
      console.error('[MappingRules] Upload error:', err);
      toast.error('Failed to upload and import Excel rules.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-bg-app text-text-primary ${embedded ? 'p-0' : 'p-6'}`}>
      {/* Header Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Icon name="tag" size={18} className="text-accent-blue" />
          <h1 className="text-base font-bold text-text-primary">Rules</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-bold">
            {rules.length} Rules Active
          </span>
        </div>

        {/* Action Buttons & Search */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules, keywords, SOR, regex..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-bg-panel border border-border-color rounded outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 text-text-primary shadow-sm"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <Icon name="search" size={13} />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadExcel}
            accept=".xlsx, .xls"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 text-xs font-semibold bg-bg-panel border border-border-color hover:bg-bg-app text-text-secondary hover:text-text-primary rounded transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="Import rules from Excel"
          >
            <Icon name="upload" size={14} />
            <span>{isUploading ? 'Importing...' : 'Upload Excel'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-xs font-semibold bg-bg-panel border border-border-color hover:bg-bg-app text-text-secondary hover:text-text-primary rounded transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Download rules as Excel (.xlsx)"
          >
            <Icon name="download" size={14} />
            <span>Download Excel</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-semibold border border-border-color hover:bg-rose-500/10 text-text-secondary hover:text-rose-500 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset rules to default Telstra wireless ruleset"
          >
            <Icon name="refresh" size={14} />
            <span>Reset Defaults</span>
          </button>

          {selectedRuleIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1.5 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Icon name="trash" size={14} />
              <span>Delete Selected ({selectedRuleIds.size})</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="px-3.5 py-1.5 text-xs font-bold bg-accent-blue hover:bg-accent-blue/90 text-white rounded transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Add Mapping Rule</span>
          </button>
        </div>
      </div>

      {/* Rules Table Container */}
      <div className="flex-1 bg-bg-panel border border-border-color rounded overflow-hidden shadow-sm flex flex-col min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-[11px] border-collapse table-fixed">
            <thead className="select-none">
              <tr className="bg-bg-app border-b border-border-color">
                <th className="py-3 px-1 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[3.5%]">
                  <input
                    type="checkbox"
                    checked={processedRules.length > 0 && processedRules.every(r => selectedRuleIds.has(r.id))}
                    ref={input => {
                      if (input) {
                        const anySelected = processedRules.some(r => selectedRuleIds.has(r.id));
                        const allSelected = processedRules.length > 0 && processedRules.every(r => selectedRuleIds.has(r.id));
                        input.indeterminate = anySelected && !allSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-border-color bg-bg-app text-accent-blue focus:ring-accent-blue cursor-pointer"
                  />
                </th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[5.5%]">Rule ID</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[14.5%]">Rule Name (Price list desc)</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[6.5%]">Action</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[8.5%]">Item Type</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[10.5%]">Category</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[6.5%]">Pref Source</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[8.5%]">Ignore Pages</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[8.5%]">Duplicate Pages</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[12%]">Matching Conditions</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[7.5%]">SOR Code</th>
                <th className="py-3 px-1.5 sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[11.5%]">Notes</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[4.8%]">Status</th>
                <th className="py-3 px-1.5 text-center sticky top-0 z-30 bg-bg-app text-text-muted font-bold text-[9.5px] uppercase tracking-wider w-[4.8%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color-light">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    {Array.from({ length: 14 }).map((_, cIdx) => (
                      <td key={cIdx} className="py-3 px-1.5"><div className="h-4 bg-border-color/30 rounded w-10 mx-auto"></div></td>
                    ))}
                  </tr>
                ))
              ) : processedRules.length > 0 ? (
                processedRules.map((rule, idx) => {
                  const isEnabled = rule.enabled === 1;
                  const isEven = idx % 2 === 0;
                  const isSelected = selectedRuleIds.has(rule.id);
                  return (
                    <tr
                      key={rule.id}
                      className={`transition-colors align-top border-b border-border-color-light ${
                        isSelected
                          ? 'bg-accent-blue/10 hover:bg-accent-blue/15'
                          : isEnabled
                          ? isEven
                            ? 'bg-zinc-100/90 dark:bg-zinc-800/30 hover:bg-accent-blue/5'
                            : 'bg-white dark:bg-zinc-950/20 hover:bg-accent-blue/5'
                          : 'opacity-50 bg-zinc-500/5 hover:bg-bg-app/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-1 text-center font-mono font-bold text-text-muted select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rule.id)}
                          className="w-3.5 h-3.5 rounded border-border-color bg-bg-app text-accent-blue focus:ring-accent-blue cursor-pointer"
                        />
                      </td>

                      {/* Rule ID */}
                      <td className="py-3 px-1.5 text-center font-mono font-bold text-text-muted">
                        <span className="px-1.5 py-0.5 rounded bg-bg-app border border-border-color text-[10px] break-all block">
                          {rule.internal_id || `R${rule.id.toString().padStart(3, '0')}`}
                        </span>
                      </td>

                      {/* Rule Name */}
                      <td className="py-3 px-1.5 font-semibold text-text-primary whitespace-normal break-words leading-relaxed text-[11px]">
                        {rule.rule_name}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wider block text-center ${
                          rule.action_filter === 'REMOVE'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : rule.action_filter === 'RELOCATE'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : rule.action_filter === 'INSTALL'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                        }`}>
                          {rule.action_filter}
                        </span>
                      </td>

                      {/* Item Type */}
                      <td className="py-3 px-1.5 text-center font-mono text-[10px] text-text-secondary whitespace-normal break-words leading-normal">
                        {rule.equipment_type}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-1.5 text-text-secondary whitespace-normal break-words leading-relaxed font-medium">
                        {rule.category || 'General'}
                      </td>

                      {/* Preferred Source Type */}
                      <td className="py-3 px-1.5 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-bg-app border border-border-color text-[9.5px] font-semibold text-text-muted block text-center">
                          {rule.preferred_source_type || 'TABLE'}
                        </span>
                      </td>

                      {/* Ignore Pages */}
                      <td className="py-3 px-1.5 text-text-muted whitespace-normal break-words leading-relaxed">
                        {rule.ignore_pages || '—'}
                      </td>

                      {/* Duplicate-Prone Pages */}
                      <td className="py-3 px-1.5 text-text-muted whitespace-normal break-words leading-relaxed">
                        {rule.duplicate_prone_pages || '—'}
                      </td>

                      {/* Matching Conditions */}
                      <td className="py-3 px-1.5 whitespace-normal break-words leading-relaxed text-[11px]">
                        <div className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
                          {rule.matching_conditions || '—'}
                        </div>
                        {rule.match_keywords && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-normal font-medium bg-emerald-500/5 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15 mb-1 max-w-full">
                            <span className="font-bold uppercase text-[7.5px] tracking-wider text-emerald-700 dark:text-emerald-300 mr-1 bg-emerald-500/15 px-1 py-0.2 rounded">Inc</span>
                            {rule.match_keywords}
                          </div>
                        )}
                        {rule.exclude_keywords && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 leading-normal font-medium bg-rose-500/5 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/15 max-w-full">
                            <span className="font-bold uppercase text-[7.5px] tracking-wider text-rose-700 dark:text-rose-300 mr-1 bg-rose-500/15 px-1 py-0.2 rounded">Exc</span>
                            {rule.exclude_keywords}
                          </div>
                        )}
                      </td>

                      {/* SOR Code */}
                      <td className="py-3 px-1.5 text-center">
                        {(() => {
                          const code = rule.target_sor_code;
                          const isUnquoted = !code || code === 'UNQUOTED';
                          const isDuplicate = !isUnquoted && (sorCodeCounts[code] > 1);
                          const isMissing = !isUnquoted && priceListItems.length > 0 && !activeSorCodes.has(code);

                          let badgeClasses = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
                          let title = '';

                          if (isUnquoted) {
                            badgeClasses = 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30';
                            title = 'Unquoted Item';
                          } else if (isMissing) {
                            badgeClasses = 'bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse';
                            title = '⚠️ Missing: SOR Code is not in the active Price List!';
                          } else if (isDuplicate) {
                            badgeClasses = 'bg-amber-500/20 text-amber-600 border-amber-500/50';
                            title = '⚠️ Duplicate: SOR Code is mapped to multiple rules!';
                          }

                          return (
                            <span 
                              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border block text-center break-all cursor-help ${badgeClasses}`}
                              title={title}
                            >
                              {code || '—'}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-1.5 text-text-muted whitespace-normal break-words leading-relaxed">
                        {rule.notes || '—'}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-1.5 text-center">
                        <button
                          onClick={() => handleToggle(rule.id)}
                          className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer inline-block ${
                            isEnabled ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
                          }`}
                          title={isEnabled ? 'Click to disable' : 'Click to enable'}
                        >
                          <div className={`w-3 h-3 bg-white rounded-full transition-transform absolute top-0.5 left-0.5 ${
                            isEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-1.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1 text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 rounded transition-colors cursor-pointer"
                            title="Edit rule"
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule)}
                            className="p-1 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="search" size={24} className="opacity-40" />
                      <p className="text-xs font-semibold">No mapping rules found matching your filters.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                        }}
                        className="text-xs text-accent-blue hover:underline cursor-pointer font-bold mt-1"
                      >
                        Clear search
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-panel border border-border-color rounded w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
              <div className="flex items-center gap-2">
                <Icon name="tag" size={18} className="text-accent-blue" />
                <h3 className="font-display font-bold text-sm text-text-primary">
                  {!editingRule.id ? 'Add New Commercial Mapping Rule' : `Edit Rule: ${editingRule.rule_name}`}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-app transition-colors cursor-pointer"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRule} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Select Price List SOR Item <span className="text-rose-500">*</span>
                  </label>
                  <CustomDropdown
                    items={priceListItems}
                    selectedValue={{ code: editingRule.target_sor_code, name: editingRule.rule_name }}
                    onChange={(item) => {
                      setEditingRule({
                        ...editingRule,
                        rule_name: item.name,
                        target_sor_code: item.code,
                        category: item.category || 'General'
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Rule ID / Code (Auto-generated)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingRule.internal_id || ''}
                    className="w-full h-8 px-2.5 text-xs bg-bg-panel border border-border-color rounded outline-none font-mono font-bold text-accent-blue opacity-70 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Action
                  </label>
                  <select
                    value={editingRule.action_filter || 'INSTALL'}
                    onChange={(e) => setEditingRule({ ...editingRule, action_filter: e.target.value })}
                    className="w-full h-8 px-2 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                  >
                    <option value="INSTALL">INSTALL</option>
                    <option value="REMOVE">REMOVE</option>
                    <option value="RELOCATE">RELOCATE</option>
                    <option value="REPLACE">REPLACE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Item Type
                  </label>
                  <input
                    type="text"
                    value={editingRule.equipment_type || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, equipment_type: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                    placeholder="e.g. PANEL_ANTENNA, 5G_AAU, GPS, TMA_FILTER, RRU"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Category (Price List Section)
                  </label>
                  <select
                    value={editingRule.category || 'General'}
                    onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
                    className="w-full h-8 px-2 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                  >
                    <option value="General">General</option>
                    {categories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Preferred Source Type
                  </label>
                  <select
                    value={editingRule.preferred_source_type || 'TABLE'}
                    onChange={(e) => setEditingRule({ ...editingRule, preferred_source_type: e.target.value })}
                    className="w-full h-8 px-2 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                  >
                    <option value="TABLE">TABLE</option>
                    <option value="NOTE">NOTE</option>
                    <option value="ALL">ALL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Ignore Pages
                  </label>
                  <input
                    type="text"
                    value={editingRule.ignore_pages || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, ignore_pages: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue text-text-primary"
                    placeholder="e.g. Drawing Index; Document Control"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Duplicate-Prone Pages
                  </label>
                  <input
                    type="text"
                    value={editingRule.duplicate_prone_pages || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, duplicate_prone_pages: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue text-text-primary"
                    placeholder="e.g. Site Layout; Antenna Layout; Elevation"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Matching Conditions <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    value={editingRule.matching_conditions || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, matching_conditions: e.target.value })}
                    className="w-full min-h-[60px] p-2 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-medium resize-none text-text-primary"
                    placeholder="e.g. New/proposed panel antenna"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Match Keywords <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRule.match_keywords || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, match_keywords: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                    placeholder="Comma-separated keywords (OR logic) e.g. KAELUS, RVVPX, ARGUS, PANEL"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Exclude Keywords
                  </label>
                  <input
                    type="text"
                    value={editingRule.exclude_keywords || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, exclude_keywords: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue font-semibold text-text-primary"
                    placeholder="Comma-separated exclude words (OR logic) e.g. FILTER, COMBINER, TMA, RRU, AIR"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    SOR Code (Auto-populated)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingRule.target_sor_code || ''}
                    className="w-full h-8 px-2.5 text-xs bg-bg-panel border border-border-color rounded outline-none font-mono font-bold text-emerald-500 opacity-70 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={editingRule.notes || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-bg-app border border-border-color rounded outline-none focus:border-accent-blue text-text-muted"
                    placeholder="e.g. Install 4G antenna"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingRule.enabled === 1}
                      onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked ? 1 : 0 })}
                      className="rounded border-border-color text-accent-blue focus:ring-accent-blue/20 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-text-primary">Enable Rule Immediately</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold border border-border-color hover:bg-bg-app text-text-secondary rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold bg-accent-blue hover:bg-accent-blue/90 text-white rounded cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Mapping Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
