import React, { useState, useMemo } from 'react';
import { Icon } from '../common/Icon';
import { toast } from '../common/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDownIcon,
  CheckIcon,
  LayersIcon,
  BuildingIcon,
  PlusIcon,
  SearchIcon,
} from 'lucide-react';

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
    attributes: '{}',
  });
  const [tagInput, setTagInput] = useState<string>('');

  const handleSeedDefaults = () => {
    setEquipmentList(DEFAULT_EQUIPMENT);
    toast.success('Equipment catalog reset to standard industry defaults!');
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      canonical_id: `EQ-AUTO-${Date.now().toString().slice(-4)}`,
      manufacturer: '',
      model_name: '',
      equipment_class: 'RRU',
      category: 'Antennas, RRUs, TMDs',
      aliases: [],
      default_action: 'INSTALL',
      attributes: '{}',
    });
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
      attributes: JSON.stringify(item.attributes, null, 2),
    });
    setIsAddModalOpen(true);
  };

  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.canonical_id || !formData.model_name) {
      toast.error('Please enter Canonical ID and Model Name');
      return;
    }

    let parsedAttributes = {};
    try {
      parsedAttributes = JSON.parse(formData.attributes || '{}');
    } catch {
      toast.error('Attributes must be valid JSON');
      return;
    }

    if (editingItem) {
      setEquipmentList((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...formData,
                attributes: parsedAttributes,
              }
            : item
        )
      );
      toast.success('Equipment updated successfully!');
    } else {
      const newItem: EquipmentItem = {
        id: Date.now(),
        ...formData,
        attributes: parsedAttributes,
        is_active: true,
      };
      setEquipmentList((prev) => [newItem, ...prev]);
      toast.success('Equipment added to catalog!');
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteEquipment = (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    setEquipmentList((prev) => prev.filter((item) => item.id !== id));
    toast.success('Equipment record removed');
  };

  const handleAddAliasQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasModalItem || !newAliasInput.trim()) return;
    const alias = newAliasInput.trim();
    setEquipmentList((prev) =>
      prev.map((item) =>
        item.id === aliasModalItem.id && !item.aliases.includes(alias)
          ? { ...item, aliases: [...item.aliases, alias] }
          : item
      )
    );
    toast.success(`Alias '${alias}' added`);
    setNewAliasInput('');
    setAliasModalItem(null);
  };

  const handleAddTag = () => {
    const val = tagInput.trim();
    if (val && !formData.aliases.includes(val)) {
      setFormData((prev) => ({ ...prev, aliases: [...prev.aliases, val] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (alias: string) => {
    setFormData((prev) => ({ ...prev, aliases: prev.aliases.filter((a) => a !== alias) }));
  };

  // Filtered list
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      if (selectedClass !== 'ALL' && item.equipment_class !== selectedClass) return false;
      if (selectedManufacturer !== 'ALL' && item.manufacturer !== selectedManufacturer) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inModel = item.model_name.toLowerCase().includes(q);
        const inId = item.canonical_id.toLowerCase().includes(q);
        const inMfr = item.manufacturer.toLowerCase().includes(q);
        const inAliases = item.aliases.some((a) => a.toLowerCase().includes(q));
        if (!inModel && !inId && !inMfr && !inAliases) return false;
      }
      return true;
    });
  }, [equipmentList, selectedClass, selectedManufacturer, searchQuery]);

  const classes = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.equipment_class).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [equipmentList]);

  const manufacturers = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.manufacturer).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [equipmentList]);

  const totalAliases = useMemo(() => {
    return equipmentList.reduce((acc, item) => acc + (item.aliases ? item.aliases.length : 0), 0);
  }, [equipmentList]);

  return (
    <div className="h-full flex flex-col bg-background p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Equipment Master Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Canonical physical equipment catalog & drawing aliases for zero-duplicate entity resolution.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaults}
            className="h-9 gap-1.5 cursor-pointer shadow-xs"
          >
            <Icon name="refresh" size={14} />
            <span>Reset Standards</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="h-9 gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Icon name="plus" size={14} />
            <span>Add Equipment</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card shadow-xs border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Models</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {equipmentList.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Canonical specifications loaded
          </CardContent>
        </Card>
        <Card className="bg-card shadow-xs border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Equipment Classes</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {classes.length - 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            RRU, Antenna, AAU, Feeder & Auxiliaries
          </CardContent>
        </Card>
        <Card className="bg-card shadow-xs border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Drawing Aliases</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {totalAliases}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Regex tokens matched across layouts
          </CardContent>
        </Card>
      </div>

      {/* Filter & Table Container Card */}
      <Card className="bg-card shadow-xs border-border overflow-hidden">
        <CardHeader className="p-3.5 border-b border-border/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-muted/10">
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <div className="relative w-full">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search model, canonical ID, or aliases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Class Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 cursor-pointer">
                  <LayersIcon className="size-3.5 text-muted-foreground" />
                  <span>Class: {selectedClass}</span>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground ml-0.5" />
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
                    {selectedClass === c && <CheckIcon className="size-3.5 ml-2" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Manufacturer Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 cursor-pointer">
                  <BuildingIcon className="size-3.5 text-muted-foreground" />
                  <span>Manufacturer: {selectedManufacturer}</span>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground ml-0.5" />
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
                    {selectedManufacturer === m && <CheckIcon className="size-3.5 ml-2" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Equipment */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenAddModal}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>Add Equipment</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                <TableHead className="text-xs font-semibold">Canonical Model & Manufacturer</TableHead>
                <TableHead className="w-28 text-xs font-semibold">Class</TableHead>
                <TableHead className="min-w-[240px] text-xs font-semibold">Drawing Aliases</TableHead>
                <TableHead className="min-w-[180px] text-xs font-semibold">Attributes & Specs</TableHead>
                <TableHead className="w-28 text-center text-xs font-semibold">Action</TableHead>
                <TableHead className="w-24 text-right text-xs font-semibold pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                    No equipment matching criteria found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEquipment.map((item, idx) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center text-xs font-mono text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground text-xs">{item.model_name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-foreground/80">{item.manufacturer}</span>
                        <span>•</span>
                        <span>{item.canonical_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {item.equipment_class}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {item.aliases.map((alias, aIdx) => (
                          <span
                            key={aIdx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted text-foreground border border-border/80"
                          >
                            {alias}
                          </span>
                        ))}
                        <button
                          onClick={() => setAliasModalItem(item)}
                          className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded border border-dashed border-border transition-colors cursor-pointer"
                          title="Add drawing alias"
                        >
                          + Add
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                        {Object.entries(item.attributes).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="text-foreground/70 capitalize">{k}:</span> {String(v)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.default_action === 'INSTALL' ? 'default' : 'secondary'}
                        className="text-[10px] font-semibold tracking-wide"
                      >
                        {item.default_action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit Equipment"
                        >
                          <Icon name="pencil" size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteEquipment(item.id, item.model_name)}
                          title="Delete Equipment"
                          className="hover:text-destructive"
                        >
                          <Icon name="close" size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-xl bg-card border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                {editingItem ? 'Edit Equipment Master' : 'Add Canonical Equipment'}
              </CardTitle>
              <CardDescription className="text-xs">
                Configure standard manufacturer model, class, and drawing matching tokens.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveEquipment}>
              <CardContent className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Manufacturer
                    </label>
                    <Input
                      placeholder="e.g. Ericsson, CommScope"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      required
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">Class</label>
                    <Input
                      placeholder="e.g. RRU, Antenna, AAU"
                      value={formData.equipment_class}
                      onChange={(e) => setFormData({ ...formData, equipment_class: e.target.value })}
                      required
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Model Name
                  </label>
                  <Input
                    placeholder="e.g. Radio 4415 B1/B3"
                    value={formData.model_name}
                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                    required
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Canonical ID
                  </label>
                  <Input
                    placeholder="e.g. EQ-ERIC-4415"
                    value={formData.canonical_id}
                    onChange={(e) => setFormData({ ...formData, canonical_id: e.target.value })}
                    required
                    className="h-8 text-xs bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Drawing Aliases
                  </label>
                  <div className="flex gap-2 mb-2">
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
                      className="h-8 text-xs bg-background font-mono"
                    />
                    <Button type="button" size="sm" onClick={handleAddTag} className="h-8">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.aliases.map((alias, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted border border-border"
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(alias)}
                          className="hover:text-destructive cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 p-3.5 border-t border-border bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Equipment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Quick Add Alias Modal */}
      {aliasModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-xl bg-card border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Add Drawing Alias
              </CardTitle>
              <CardDescription className="text-xs">
                Associate drawing text with <strong>{aliasModalItem.model_name}</strong>
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAddAliasQuick}>
              <CardContent className="p-4 space-y-2">
                <label className="text-xs font-semibold text-foreground block">
                  New Alias Token
                </label>
                <Input
                  placeholder="e.g. 4415 B13, ERIC-4415"
                  value={newAliasInput}
                  onChange={(e) => setNewAliasInput(e.target.value)}
                  autoFocus
                  required
                  className="h-8 text-xs bg-background font-mono"
                />
              </CardContent>
              <div className="flex items-center justify-end gap-2 p-3 border-t border-border bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAliasModalItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Add Alias
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
