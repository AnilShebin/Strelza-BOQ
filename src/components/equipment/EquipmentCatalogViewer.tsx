import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  LayersIcon,
  BuildingIcon,
  PlusIcon,
  SearchIcon,
  RotateCcwIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  TagIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export interface EquipmentItem {
  id: number;
  canonical_id: string;
  manufacturer: string;
  model_name: string;
  equipment_class: string;
  category: string;
  aliases: string[];
  attributes: Record<string, any>;
  default_action: string;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_EQUIPMENT: EquipmentItem[] = [
  {
    id: 1,
    canonical_id: 'EQ-ERIC-4415',
    manufacturer: 'Ericsson',
    model_name: 'Radio 4415 B1/B3',
    equipment_class: 'RRU',
    category: 'Antennas, RRUs, TMDs',
    aliases: ['4415 B1/B3', 'Radio 4415', 'KRC 161 633/1', 'ERIC-4415-B13'],
    attributes: { power: '4x40W', weight: '13.4kg', frequency: '1800/2100MHz' },
    default_action: 'INSTALL',
    is_active: true,
  },
  {
    id: 2,
    canonical_id: 'EQ-COMM-NNHH-65B',
    manufacturer: 'CommScope',
    model_name: 'NNHH-65B-R4 Panel Antenna',
    equipment_class: 'Antenna',
    category: 'Antennas, RRUs, TMDs',
    aliases: ['NNHH-65B-R4', 'NNHH65BR4', 'CommScope 8-Port', '65B-R4'],
    attributes: { ports: '8-port', beamwidth: '65 deg', length: '1.8m' },
    default_action: 'INSTALL',
    is_active: true,
  },
  {
    id: 3,
    canonical_id: 'EQ-NOK-AS-TRI',
    manufacturer: 'Nokia',
    model_name: 'AirScale Tri-Band RRU 4T4R',
    equipment_class: 'RRU',
    category: 'Antennas, RRUs, TMDs',
    aliases: ['AirScale RRH', 'AHEA', '4T4R Triband', 'Nokia 4T4R'],
    attributes: { bands: '700/850/900MHz', output: '4x60W', ip_rating: 'IP65' },
    default_action: 'INSTALL',
    is_active: true,
  },
  {
    id: 4,
    canonical_id: 'EQ-RAY-DC6-48',
    manufacturer: 'Raycap',
    model_name: 'DC6-48-60-18-8F Surge Suppressor',
    equipment_class: 'Ancillary',
    category: 'Power, Feeder & Auxiliaries',
    aliases: ['DC6 Surge Box', 'Raycap OVP', 'DC6-48', 'Surge Arrestor Box'],
    attributes: { capacity: '6-circuit DC', surge: '20kA', enclosure: 'Outdoor' },
    default_action: 'INSTALL',
    is_active: true,
  },
  {
    id: 5,
    canonical_id: 'EQ-HUA-AAU5613',
    manufacturer: 'Huawei',
    model_name: 'AAU5613 64T64R Massive MIMO',
    equipment_class: 'AAU',
    category: 'Antennas, RRUs, TMDs',
    aliases: ['AAU 5613', 'Massive MIMO 64T', 'AAU-5613-3.5G'],
    attributes: { channels: '64T64R', frequency: '3.5GHz', weight: '25kg' },
    default_action: 'INSTALL',
    is_active: true,
  },
  {
    id: 6,
    canonical_id: 'EQ-ANDR-LDF4',
    manufacturer: 'Andrew',
    model_name: 'HELIAX LDF4-50A 1/2" Feeder Cable',
    equipment_class: 'Feeder',
    category: 'Power, Feeder & Auxiliaries',
    aliases: ['LDF4-50A', '1/2" Heliax', 'LDF4', 'Coax Feeder 1/2'],
    attributes: { impedance: '50 Ohm', size: '1/2 inch', loss: '0.07dB/m' },
    default_action: 'INSTALL',
    is_active: true,
  },
];

const getClassBadgeStyle = (cls: string) => {
  const c = (cls || '').toLowerCase();
  if (c.includes('rru')) return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
  if (c.includes('antenna')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (c.includes('aau')) return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
  if (c.includes('feeder')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
  if (c.includes('ancillary')) return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  return 'bg-muted/70 text-muted-foreground border-border/60';
};

export const EquipmentCatalogViewer: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENT);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('ALL');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [aliasModalItem, setAliasModalItem] = useState<EquipmentItem | null>(null);
  const [newAliasInput, setNewAliasInput] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState({
    canonical_id: '',
    manufacturer: '',
    model_name: '',
    equipment_class: 'RRU',
    category: 'Antennas, RRUs, TMDs',
    aliases: [] as string[],
    default_action: 'INSTALL',
  });
  const [tagInput, setTagInput] = useState('');

  // Extract distinct classes & manufacturers
  const classes = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.equipment_class));
    return ['ALL', ...Array.from(set).sort()];
  }, [equipmentList]);

  const manufacturers = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.manufacturer));
    return ['ALL', ...Array.from(set).sort()];
  }, [equipmentList]);

  const [sortKey, setSortKey] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filtered and Sorted Equipment List
  const filteredEquipment = useMemo(() => {
    const list = equipmentList.filter((item) => {
      if (selectedClass !== 'ALL' && item.equipment_class !== selectedClass) return false;
      if (selectedManufacturer !== 'ALL' && item.manufacturer !== selectedManufacturer) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchModel = item.model_name.toLowerCase().includes(q);
        const matchMfg = item.manufacturer.toLowerCase().includes(q);
        const matchCanonical = item.canonical_id.toLowerCase().includes(q);
        const matchAlias = item.aliases.some((a) => a.toLowerCase().includes(q));
        if (!matchModel && !matchMfg && !matchCanonical && !matchAlias) return false;
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
  }, [equipmentList, selectedClass, selectedManufacturer, searchQuery, sortKey, sortDirection]);

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<number>>(new Set());

  const handleSelectRow = (id: number) => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredEquipment.length === 0) return;
    const allSelected = filteredEquipment.every((e) => selectedEquipmentIds.has(e.id));
    if (allSelected) {
      setSelectedEquipmentIds(new Set());
    } else {
      setSelectedEquipmentIds(new Set(filteredEquipment.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = () => {
    setEquipmentList((prev) => prev.filter((e) => !selectedEquipmentIds.has(e.id)));
    toast.success(`Removed ${selectedEquipmentIds.size} equipment items.`);
    setSelectedEquipmentIds(new Set());
  };

  const totalAliases = useMemo(() => {
    return equipmentList.reduce((acc, curr) => acc + curr.aliases.length, 0);
  }, [equipmentList]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      canonical_id: '',
      manufacturer: '',
      model_name: '',
      equipment_class: 'RRU',
      category: 'Antennas, RRUs, TMDs',
      aliases: [],
      default_action: 'INSTALL',
    });
    setTagInput('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: EquipmentItem) => {
    setEditingItem(item);
    setFormData({
      canonical_id: item.canonical_id,
      manufacturer: item.manufacturer,
      model_name: item.model_name,
      equipment_class: item.equipment_class,
      category: item.category,
      aliases: [...item.aliases],
      default_action: item.default_action,
    });
    setTagInput('');
    setIsAddModalOpen(true);
  };

  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.model_name.trim() || !formData.manufacturer.trim()) {
      toast.error('Manufacturer and Model Name are required.');
      return;
    }

    if (editingItem) {
      setEquipmentList((prev) =>
        prev.map((e) =>
          e.id === editingItem.id
            ? {
                ...e,
                ...formData,
                aliases: tagInput.trim()
                  ? Array.from(new Set([...formData.aliases, tagInput.trim()]))
                  : formData.aliases,
              }
            : e
        )
      );
      toast.success(`Updated ${formData.model_name}`);
    } else {
      const newItem: EquipmentItem = {
        id: Date.now(),
        ...formData,
        aliases: tagInput.trim()
          ? Array.from(new Set([...formData.aliases, tagInput.trim()]))
          : formData.aliases,
        attributes: {},
        is_active: true,
      };
      setEquipmentList((prev) => [newItem, ...prev]);
      toast.success(`Added ${formData.model_name} to catalog`);
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteEquipment = (id: number, name: string) => {
    setEquipmentList((prev) => prev.filter((e) => e.id !== id));
    toast.success(`Removed ${name} from catalog`);
  };

  const handleAddAliasQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasModalItem || !newAliasInput.trim()) return;
    const cleanAlias = newAliasInput.trim();
    setEquipmentList((prev) =>
      prev.map((e) =>
        e.id === aliasModalItem.id
          ? {
              ...e,
              aliases: e.aliases.includes(cleanAlias) ? e.aliases : [...e.aliases, cleanAlias],
            }
          : e
      )
    );
    toast.success(`Added alias "${cleanAlias}" to ${aliasModalItem.model_name}`);
    setAliasModalItem(null);
    setNewAliasInput('');
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!formData.aliases.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        aliases: [...formData.aliases, tagInput.trim()],
      });
    }
    setTagInput('');
  };

  const handleRemoveTag = (aliasToRemove: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter((a) => a !== aliasToRemove),
    });
  };

  const handleSeedDefaults = () => {
    setEquipmentList(DEFAULT_EQUIPMENT);
    toast.success('Equipment catalog reset to standard defaults');
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-background select-none min-h-0 text-foreground animate-fadeIn gap-4 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-normal tracking-tight text-foreground">
            Equipment Master Catalog
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            Canonical physical equipment catalog & drawing aliases for zero-duplicate entity resolution.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaults}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <RotateCcwIcon className="size-3.5 text-muted-foreground" />
            <span>Reset Standards</span>
          </Button>

          {selectedEquipmentIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg font-medium"
            >
              <Trash2Icon className="size-3.5" />
              <span>Delete Selected ({selectedEquipmentIds.size})</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 font-medium rounded-lg"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Equipment</span>
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
              placeholder="Search model, canonical ID, or aliases..."
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
            {/* Class Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs">
                  <LayersIcon className="size-3.5 text-muted-foreground" />
                  <span>Class: {selectedClass}</span>
                  <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal px-2 py-1">
                  Filter by Class
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {classes.map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>{c}</span>
                    {selectedClass === c && <CheckIcon className="size-3.5 ml-2 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Manufacturer Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs">
                  <BuildingIcon className="size-3.5 text-muted-foreground" />
                  <span>Manufacturer: {selectedManufacturer}</span>
                  <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal px-2 py-1">
                  Filter by Manufacturer
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {manufacturers.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setSelectedManufacturer(m)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>{m}</span>
                    {selectedManufacturer === m && <CheckIcon className="size-3.5 ml-2 text-primary" />}
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
                      checked={filteredEquipment.length > 0 && filteredEquipment.every((e) => selectedEquipmentIds.has(e.id))}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className="size-4 rounded border-border/80"
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('model_name')}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Canonical Model & Manufacturer</span>
                    {sortKey === 'model_name' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('equipment_class')}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-32 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Class</span>
                    {sortKey === 'equipment_class' ? (
                      sortDirection === 'asc' ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none min-w-[240px]">
                  Drawing Aliases
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none min-w-[180px]">
                  Attributes & Specs
                </th>
                <th
                  onClick={() => handleSort('default_action')}
                  className="h-10 px-3 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none w-28 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Action</span>
                    {sortKey === 'default_action' ? (
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
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-32 text-center text-muted-foreground text-xs font-medium">
                    No equipment matching criteria found.
                  </td>
                </tr>
              ) : (
                filteredEquipment.map((item) => {
                  const isSelected = selectedEquipmentIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`relative z-0 hover:bg-muted/30 transition-colors border-b border-border/70 group ${
                        isSelected ? 'bg-muted/50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center align-middle w-12 first:w-12 first:px-0 first:text-center">
                        <div className="w-12 flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectRow(item.id)}
                            aria-label="Select row"
                            className="size-4 rounded border-border/80"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="font-semibold text-foreground text-xs leading-snug group-hover:text-primary transition-colors cursor-pointer">
                          {item.model_name}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5 transition-colors">
                          <span className="font-medium text-foreground/85 group-hover:text-foreground">{item.manufacturer}</span>
                          <span>•</span>
                          <span>{item.canonical_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border truncate inline-block text-center ${getClassBadgeStyle(
                            item.equipment_class
                          )}`}
                        >
                          {item.equipment_class}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {item.aliases.map((alias, aIdx) => (
                            <span
                              key={aIdx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted/80 text-foreground border border-border/60"
                            >
                              {alias}
                            </span>
                          ))}
                          <button
                            onClick={() => setAliasModalItem(item)}
                            className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded border border-dashed border-border/80 transition-colors cursor-pointer"
                            title="Add drawing alias"
                          >
                            + Add
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                          {Object.entries(item.attributes).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-foreground/70 capitalize">{k}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center align-middle">
                        <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-semibold tracking-wider rounded-full bg-primary/10 text-primary border border-primary/20">
                          {item.default_action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right align-middle pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Equipment"
                            className="size-7 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEquipment(item.id, item.model_name)}
                            title="Delete Equipment"
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
              {selectedEquipmentIds.size} of {filteredEquipment.length} selected
            </span>
            <span className="hidden sm:inline">
              Classes: <strong className="text-foreground font-semibold">{classes.length - 1}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 font-medium">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <TagIcon className="size-3 text-sky-400" />
              <span className="text-[11px] text-sky-400/80 font-normal">Drawing Aliases:</span>
              <strong className="text-sm font-bold text-sky-400 tracking-tight">
                {totalAliases}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Equipment Shadcn Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingItem ? 'Edit Equipment Master' : 'Add Canonical Equipment'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure standard manufacturer model, class, and drawing matching tokens.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEquipment} className="flex flex-col gap-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Manufacturer *</Label>
                <Input
                  placeholder="e.g. Ericsson, CommScope"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Class *</Label>
                <Input
                  placeholder="e.g. RRU, Antenna, AAU"
                  value={formData.equipment_class}
                  onChange={(e) => setFormData({ ...formData, equipment_class: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">Model Name *</Label>
              <Input
                placeholder="e.g. Radio 4415 B1/B3"
                value={formData.model_name}
                onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">Canonical ID *</Label>
              <Input
                placeholder="e.g. EQ-ERIC-4415"
                value={formData.canonical_id}
                onChange={(e) => setFormData({ ...formData, canonical_id: e.target.value })}
                required
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">Drawing Aliases</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type alias and press Add"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="h-8 text-xs font-mono"
                />
                <Button type="button" size="sm" onClick={handleAddTag} className="h-8 px-3 text-xs">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                {formData.aliases.map((alias, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-muted border border-border/80 font-mono"
                  >
                    {alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(alias)}
                      className="hover:text-destructive cursor-pointer ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs cursor-pointer bg-primary text-primary-foreground font-medium"
              >
                Save Equipment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Alias Shadcn Dialog */}
      <Dialog open={Boolean(aliasModalItem)} onOpenChange={(open) => { if (!open) setAliasModalItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add Drawing Alias</DialogTitle>
            <DialogDescription className="text-xs">
              Associate drawing token with <strong>{aliasModalItem?.model_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAliasQuick} className="flex flex-col gap-3.5 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">New Alias Token *</Label>
              <Input
                placeholder="e.g. 4415 B13, ERIC-4415"
                value={newAliasInput}
                onChange={(e) => setNewAliasInput(e.target.value)}
                autoFocus
                required
                className="h-8 text-xs font-mono"
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAliasModalItem(null)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs cursor-pointer bg-primary text-primary-foreground font-medium"
              >
                Add Alias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
