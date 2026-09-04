import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  RotateCcwIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TagIcon,
  PackageIcon,
  Loader2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

export interface EquipmentItem {
  id: number;
  sl_no: number;
  product_name: string;
  product_category: string;
  created_at?: string;
}

const API_BASE_URL = 'http://localhost:8000/api/equipment-catalog';

export const EquipmentCatalogViewer: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State - only Product Name and Product Category
  const [formData, setFormData] = useState({
    product_name: '',
    product_category: '',
  });

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Sorting State
  const [sortKey, setSortKey] = useState<'sl_no' | 'product_name' | 'product_category'>('sl_no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load equipment from SQLite DB via API
  const fetchEquipment = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_BASE_URL);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data: EquipmentItem[] = await res.json();
      setEquipmentList(data);
    } catch (err: any) {
      console.error('Failed to load equipment catalog:', err);
      toast.error('Failed to connect to equipment database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Extract distinct categories from database records
  const categories = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.product_category).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [equipmentList]);

  const handleSort = (key: 'sl_no' | 'product_name' | 'product_category') => {
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
      if (selectedCategory !== 'ALL' && item.product_category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (item.product_name || '').toLowerCase().includes(q);
        const matchCat = (item.product_category || '').toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'string') {
        const comp = aVal.localeCompare(bVal as string);
        return sortDirection === 'asc' ? comp : -comp;
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [equipmentList, selectedCategory, searchQuery, sortKey, sortDirection]);

  // Selection handlers
  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredEquipment.length === 0) return;
    const allSelected = filteredEquipment.every((e) => selectedIds.has(e.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEquipment.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' })
        )
      );
      toast.success(`Deleted ${count} equipment items`);
      setSelectedIds(new Set());
      fetchEquipment();
    } catch (err: any) {
      toast.error('Failed to delete selected equipment');
    }
  };

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      product_name: '',
      product_category: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: EquipmentItem) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name,
      product_category: item.product_category,
    });
    setIsModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_name.trim()) {
      toast.error('Product name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // Update existing
        const res = await fetch(`${API_BASE_URL}/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_name: formData.product_name.trim(),
            product_category: formData.product_category.trim(),
          }),
        });
        if (!res.ok) throw new Error('Update failed');
        toast.success(`Updated "${formData.product_name}"`);
      } else {
        // Create new
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_name: formData.product_name.trim(),
            product_category: formData.product_category.trim(),
          }),
        });
        if (!res.ok) throw new Error('Create failed');
        toast.success(`Added "${formData.product_name}"`);
      }

      setIsModalOpen(false);
      fetchEquipment();
    } catch (err: any) {
      console.error('Save equipment error:', err);
      toast.error('Failed to save equipment item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEquipment = async (id: number, name: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(`Deleted "${name}"`);
      fetchEquipment();
    } catch (err: any) {
      toast.error('Failed to delete equipment item');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-background select-none min-h-0 text-foreground animate-fadeIn gap-4 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <PackageIcon className="size-6 text-primary" />
            Equipment Details
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            Database-connected storage for equipment details (Sl.No, Product Name, and Product Category).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEquipment}
            disabled={isLoading}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <RotateCcwIcon className={`size-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg font-medium"
            >
              <Trash2Icon className="size-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
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
              placeholder="Search product name or category..."
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
            {/* Category Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs"
                >
                  <TagIcon className="size-3.5 text-muted-foreground" />
                  <span>Category: {selectedCategory}</span>
                  <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="cursor-pointer text-xs"
                  >
                    {cat}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Total Count Badge */}
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md border border-border/60">
              Total: <span className="font-semibold text-foreground">{equipmentList.length}</span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
              <Loader2Icon className="size-6 animate-spin text-primary" />
              <span className="text-xs">Loading equipment catalog...</span>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/80">
                <tr>
                  <th className="h-10 px-3 text-center align-middle w-12 select-none">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          filteredEquipment.length > 0 &&
                          filteredEquipment.every((e) => selectedIds.has(e.id))
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        className="size-4 rounded border-border/80"
                      />
                    </div>
                  </th>

                  {/* Sl. No */}
                  <th
                    onClick={() => handleSort('sl_no')}
                    className="h-10 px-4 text-center align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 select-none w-20 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Sl. No</span>
                      {sortKey === 'sl_no' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUpIcon className="size-3 text-primary" />
                        ) : (
                          <ArrowDownIcon className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Product Name */}
                  <th
                    onClick={() => handleSort('product_name')}
                    className="h-10 px-4 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 select-none cursor-pointer group/th hover:bg-muted/90 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Product Name</span>
                      {sortKey === 'product_name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUpIcon className="size-3 text-primary" />
                        ) : (
                          <ArrowDownIcon className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Product Category */}
                  <th
                    onClick={() => handleSort('product_category')}
                    className="h-10 px-4 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 select-none w-64 cursor-pointer group/th hover:bg-muted/90 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Product Category</span>
                      {sortKey === 'product_category' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUpIcon className="size-3 text-primary" />
                        ) : (
                          <ArrowDownIcon className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-30 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="h-10 px-4 text-right align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 select-none w-28 pr-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-48 text-center text-muted-foreground text-xs font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <PackageIcon className="size-8 text-muted-foreground/50" />
                        <span>No equipment records found.</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenAddModal}
                          className="mt-1 h-7 text-xs gap-1 cursor-pointer"
                        >
                          <PlusIcon className="size-3" />
                          <span>Add First Equipment</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? 'bg-muted/50' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center align-middle w-12">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectRow(item.id)}
                              aria-label={`Select item ${item.id}`}
                              className="size-4 rounded border-border/80"
                            />
                          </div>
                        </td>

                        {/* Sl. No */}
                        <td className="py-3 px-4 text-center align-middle font-mono text-muted-foreground text-xs font-medium w-20">
                          {item.sl_no || index + 1}
                        </td>

                        {/* Product Name */}
                        <td className="py-3 px-4 align-middle">
                          <div className="font-medium text-foreground text-xs leading-snug">
                            {item.product_name}
                          </div>
                        </td>

                        {/* Product Category */}
                        <td className="py-3 px-4 align-middle w-64">
                          {item.product_category ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                              {item.product_category}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">Uncategorized</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right align-middle pr-4">
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
                              onClick={() => handleDeleteEquipment(item.id, item.product_name)}
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
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="p-2.5 px-4 border-t border-border/80 bg-muted/10 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>
            Showing <strong className="text-foreground">{filteredEquipment.length}</strong> of{' '}
            <strong className="text-foreground">{equipmentList.length}</strong> items
          </span>
          {selectedIds.size > 0 && (
            <span className="font-medium text-primary">
              {selectedIds.size} row(s) selected
            </span>
          )}
        </div>
      </div>

      {/* Add / Edit Equipment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
            <DialogDescription>
              Store equipment details with Product Name and Product Category.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEquipment} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="product_name" className="text-xs font-semibold">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product_name"
                placeholder="e.g. Ericsson Radio 4485 B1/B3 or CommScope NNHH-65B-R4"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                className="text-xs h-9"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product_category" className="text-xs font-semibold">
                Product Category
              </Label>
              <Input
                id="product_category"
                placeholder="e.g. Antennas, RRU, Cables, Power, Mounts"
                value={formData.product_category}
                onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 text-xs cursor-pointer bg-primary text-primary-foreground font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : editingItem ? (
                  'Save Changes'
                ) : (
                  'Add Equipment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
