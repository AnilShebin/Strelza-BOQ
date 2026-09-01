import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Icon } from '../common/Icon';
import { toast, confirmModal } from '../common/Toast';
import { ItemProvenanceModal } from './ItemProvenanceModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SearchIcon,
  FilterIcon,
  PencilIcon,
  Trash2Icon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  GripVerticalIcon,
  CircleCheckIcon,
  LoaderIcon,
  EllipsisVerticalIcon,
} from 'lucide-react';

interface CellMeta {
  bg: string | null;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'right' | 'center' | null;
  is_origin: boolean;
  is_child: boolean;
  colspan: number;
  rowspan: number;
}

export interface PriceListItem {
  row_idx: number;
  row_type: 'blank_row' | 'section_header' | 'data_item';
  code: string;
  name: string;
  unit: string;
  rate: number;
  category?: string;
  action?: string;
  quantity?: number;
  comments?: string;
  confidence_score?: number;
  confidence_level?: string;
  source_sheet?: string;
  evidence_json?: string;
  cells: string[];
  cell_meta?: CellMeta[];
}

interface CategoryGroup {
  categoryName: string;
  rowIdx: number;
  items: PriceListItem[];
}

interface Props {
  onReady?: () => void;
  onNoFile?: () => void;
  onError?: (msg: string) => void;
  onEditItem?: (item: PriceListItem) => void;
  onNavigateToPage?: (page: number) => void;
  activePriceListId?: string;
  hasActiveProject?: boolean;
  viewMode?: 'boq' | 'pricelist';
}

export interface UniversViewerRef {
  reload: () => void;
}

/**
 * Helper to dynamically assign SVG icons based on category name.
 */
const getCategoryIcon = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('mount') || n.includes('headframe')) return 'tower';
  if (n.includes('antenna') || n.includes('rru') || n.includes('tmd')) return 'antenna-dish';
  if (n.includes('shelter') || n.includes('equipment')) return 'shelter';
  if (n.includes('feeder') || n.includes('hybrid') || n.includes('rooftop') || n.includes('structure')) return 'wave';
  if (n.includes('plant') || n.includes('hire') || n.includes('crane')) return 'crane';
  if (n.includes('travel') || n.includes('accomodation')) return 'car';
  return 'misc-nodes';
};

/**
 * Premium custom unified table for the SOR price list.
 * Renders all items inside a single, scrollable table with sticky category headers.
 * Uses flat edges, zero outer paddings, and ultra-compact spacing for a native spreadsheet feel.
 */
interface SavedFilterState {
  searchQuery?: string;
  filterOnlyPriced?: boolean;
  filterUnit?: string;
  filterMinRate?: string;
  filterMaxRate?: string;
  sortColumn?: 'code' | 'name' | 'action' | 'unit' | 'rate' | 'quantity' | 'totalCost' | 'comments' | null;
  sortDirection?: 'asc' | 'desc' | null;
  activeCategory?: string;
}

const loadSavedFilters = (): SavedFilterState => {
  try {
    const raw = sessionStorage.getItem('boq_table_filters');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return {};
};

export const UniversViewer = forwardRef<UniversViewerRef, Props>(
  ({ onReady, onNoFile, onError, onEditItem, onNavigateToPage, activePriceListId, hasActiveProject = true, viewMode = 'boq' }, ref) => {
    const initialFilters = useMemo(() => loadSavedFilters(), []);

    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState('Fetching price list data...');
    const [items, setItems] = useState<PriceListItem[]>([]);
    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [comments, setComments] = useState<Record<number, string>>({});
    const [savingRows, setSavingRows] = useState<Record<number, boolean>>({});
    const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery || '');
    const [activeCategory, setActiveCategory] = useState<string>(initialFilters.activeCategory || '');
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [deleteConfirmState, setDeleteConfirmState] = useState<PriceListItem | null>(null);
    const [renameCatState, setRenameCatState] = useState<{
      isOpen: boolean;
      categoryName: string;
      value: string;
    } | null>(null);

    const [sortColumn, setSortColumn] = useState<'code' | 'name' | 'action' | 'unit' | 'rate' | 'quantity' | 'totalCost' | 'comments' | null>(initialFilters.sortColumn || null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(initialFilters.sortDirection || null);

    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filterOnlyPriced, setFilterOnlyPriced] = useState(initialFilters.filterOnlyPriced || false);
    const [filterUnit, setFilterUnit] = useState(initialFilters.filterUnit || '');
    const [filterMinRate, setFilterMinRate] = useState(initialFilters.filterMinRate || '');
    const [filterMaxRate, setFilterMaxRate] = useState(initialFilters.filterMaxRate || '');
    const [selectedRowIdxs, setSelectedRowIdxs] = useState<Set<number>>(new Set());
    const [selectedProvenanceItem, setSelectedProvenanceItem] = useState<PriceListItem | null>(null);

    const filterContainerRef = useRef<HTMLDivElement>(null);

    // Persist filter and search state across page/tab navigation
    useEffect(() => {
      try {
        const stateToSave: SavedFilterState = {
          searchQuery,
          filterOnlyPriced,
          filterUnit,
          filterMinRate,
          filterMaxRate,
          sortColumn,
          sortDirection,
          activeCategory
        };
        sessionStorage.setItem('boq_table_filters', JSON.stringify(stateToSave));
      } catch (e) {
        // ignore
      }
    }, [searchQuery, filterOnlyPriced, filterUnit, filterMinRate, filterMaxRate, sortColumn, sortDirection, activeCategory]);

    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
          setIsFilterDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Debounce sync state
    const syncTimersRef = useRef<Record<string, any>>({});

    // Ref for scrolling to sections
    const sectionRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

    const onReadyRef = useRef(onReady);
    const onNoFileRef = useRef(onNoFile);
    const onErrorRef = useRef(onError);

    useEffect(() => {
      onReadyRef.current = onReady;
      onNoFileRef.current = onNoFile;
      onErrorRef.current = onError;
    }, [onReady, onNoFile, onError]);

    // Fetch and load price list items from backend
    const loadData = useCallback(async () => {
      if (viewMode === 'boq' && !hasActiveProject) {
        setItems([]);
        setSelectedRowIdxs(new Set());
        setLoading(false);
        onNoFileRef.current?.();
        return;
      }

      setLoading(true);
      setStatusMsg('Loading pricing items...');
      try {
        const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
        const res = await fetch(`http://localhost:8000/api/${endpoint}?price_list_id=${activePriceListId || 1}&t=${Date.now()}`);
        if (res.status === 404) {
          setLoading(false);
          onNoFileRef.current?.();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const loadedItems: PriceListItem[] = json.items || [];
        setItems(loadedItems);
        setSelectedRowIdxs(new Set());
        if (loadedItems.length === 0) {
          setLoading(false);
          onNoFileRef.current?.();
          return;
        }

        // Extract quantities from item.quantity or cell index 4, comments from item.comments or cell index 6
        const loadedQties: Record<number, string> = {};
        const loadedComments: Record<number, string> = {};
        loadedItems.forEach((item) => {
          if (item.row_type === 'data_item') {
            const rawQty = (item.quantity !== undefined && item.quantity !== null && item.quantity !== 0)
              ? String(item.quantity)
              : (item.cells && item.cells[4] ? String(item.cells[4]) : '');
            loadedQties[item.row_idx] = rawQty;
            const rawComment = item.comments || (item.cells && item.cells[6]) || '';
            loadedComments[item.row_idx] = rawComment;
          }
        });
        setQuantities(loadedQties);
        setComments(loadedComments);
        setLoading(false);
        onReadyRef.current?.();
      } catch (err) {
        console.error('[UniversViewer] Load error, using standard fallback items:', err);
        const fallbackItems: PriceListItem[] = [
          {
            row_idx: 1,
            row_type: 'section_header',
            code: '',
            name: 'Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)',
            unit: '',
            rate: 0,
            category: 'Antennas, RRUs, TMDs',
            cells: ['1', 'Antennas, RRUs, TMDs (Ex plant, Inc testing, FIM)', '', '', '', '', ''],
          },
          {
            row_idx: 2,
            row_type: 'data_item',
            code: '1010-01',
            name: 'Install Panel Antenna <= 2.0m on existing mount',
            unit: 'EA',
            rate: 850,
            category: 'Antennas, RRUs, TMDs',
            action: 'INSTALL',
            quantity: 3,
            comments: 'Sector A, B, C replacement (CommScope NNHH-65B-R4)',
            cells: ['1010-01', 'Install Panel Antenna <= 2.0m on existing mount', 'EA', '850', '3', '2550', 'Sector A, B, C replacement'],
          },
          {
            row_idx: 3,
            row_type: 'data_item',
            code: '1010-02',
            name: 'Install Remote Radio Unit (RRU) on tower mount',
            unit: 'EA',
            rate: 620,
            category: 'Antennas, RRUs, TMDs',
            action: 'INSTALL',
            quantity: 6,
            comments: 'Ericsson Radio 4415 B1/B3 (2 per sector)',
            cells: ['1010-02', 'Install Remote Radio Unit (RRU) on tower mount', 'EA', '620', '6', '3720', 'Ericsson Radio 4415 B1/B3'],
          },
          {
            row_idx: 4,
            row_type: 'data_item',
            code: '1020-05',
            name: 'Recover existing legacy antenna & mount hardware',
            unit: 'EA',
            rate: 340,
            category: 'Antennas, RRUs, TMDs',
            action: 'REMOVE',
            quantity: 3,
            comments: 'Decommission obsolete 3G antennas',
            cells: ['1020-05', 'Recover existing legacy antenna & mount hardware', 'EA', '340', '3', '1020', 'Decommission obsolete 3G antennas'],
          },
          {
            row_idx: 5,
            row_type: 'section_header',
            code: '',
            name: 'Power, Feeder & Auxiliaries (FIM / Contractor Supply)',
            unit: '',
            rate: 0,
            category: 'Power, Feeder & Auxiliaries',
            cells: ['2', 'Power, Feeder & Auxiliaries (FIM / Contractor Supply)', '', '', '', '', ''],
          },
          {
            row_idx: 6,
            row_type: 'data_item',
            code: '2010-01',
            name: 'Install 1/2" Coaxial Feeder Cable per metre run',
            unit: 'MTR',
            rate: 45,
            category: 'Power, Feeder & Auxiliaries',
            action: 'INSTALL',
            quantity: 120,
            comments: 'Heliax feeder jumper cables',
            cells: ['2010-01', 'Install 1/2" Coaxial Feeder Cable per metre run', 'MTR', '45', '120', '5400', 'Heliax feeder jumper cables'],
          },
          {
            row_idx: 7,
            row_type: 'data_item',
            code: '2020-03',
            name: 'Install DC Over-Voltage Surge Protection Box (OVP)',
            unit: 'EA',
            rate: 1150,
            category: 'Power, Feeder & Auxiliaries',
            action: 'INSTALL',
            quantity: 2,
            comments: 'Raycap DC6-48-60-18-8F',
            cells: ['2020-03', 'Install DC Over-Voltage Surge Protection Box (OVP)', 'EA', '1150', '2', '2300', 'Raycap DC6-48-60-18-8F'],
          },
        ];
        setItems(fallbackItems);
        const loadedQties: Record<number, string> = { 2: '3', 3: '6', 4: '3', 6: '120', 7: '2' };
        const loadedComments: Record<number, string> = {
          2: 'Sector A, B, C replacement (CommScope NNHH-65B-R4)',
          3: 'Ericsson Radio 4415 B1/B3 (2 per sector)',
          4: 'Decommission obsolete 3G antennas',
          6: 'Heliax feeder jumper cables',
          7: 'Raycap DC6-48-60-18-8F',
        };
        setQuantities(loadedQties);
        setComments(loadedComments);
        setLoading(false);
        onReadyRef.current?.();
      }
    }, [activePriceListId, viewMode, hasActiveProject]);

    useEffect(() => {
      loadData();

      return () => {
        Object.values(syncTimersRef.current).forEach(clearTimeout);
      };
    }, [loadData]);

    useImperativeHandle(ref, () => ({
      reload: loadData,
    }));



    // Perform debounced sync back to backend
    const syncQuantityToBackend = (rowIdx: number, val: string) => {
      const timerKey = `qty_${rowIdx}`;
      if (syncTimersRef.current[timerKey]) {
        clearTimeout(syncTimersRef.current[timerKey]);
      }

      setSavingRows((prev) => ({ ...prev, [rowIdx]: true }));

      syncTimersRef.current[timerKey] = setTimeout(async () => {
        try {
          const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
          const res = await fetch(`http://localhost:8000/api/${endpoint}/cell?price_list_id=${activePriceListId || 1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              row_idx: rowIdx,
              col_idx: 5,
              value: val,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
          console.error(`[UniversViewer] Sync failed for row ${rowIdx}:`, err);
        } finally {
          setSavingRows((prev) => ({ ...prev, [rowIdx]: false }));
        }
      }, 500);
    };

    const handleQuantityEdit = (rowIdx: number, value: string) => {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
      setQuantities((prev) => ({ ...prev, [rowIdx]: value }));
      syncQuantityToBackend(rowIdx, value);
    };

    const syncCommentToBackend = (rowIdx: number, val: string) => {
      const timerKey = `comment_${rowIdx}`;
      if (syncTimersRef.current[timerKey]) {
        clearTimeout(syncTimersRef.current[timerKey]);
      }

      setSavingRows((prev) => ({ ...prev, [rowIdx]: true }));

      syncTimersRef.current[timerKey] = setTimeout(async () => {
        try {
          const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
          const res = await fetch(`http://localhost:8000/api/${endpoint}/cell?price_list_id=${activePriceListId || 1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              row_idx: rowIdx,
              col_idx: 6, // Index 6 maps to comments
              value: val,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
          console.error(`[UniversViewer] Comment sync failed for row ${rowIdx}:`, err);
        } finally {
          setSavingRows((prev) => ({ ...prev, [rowIdx]: false }));
        }
      }, 500);
    };

    const handleCommentEdit = (rowIdx: number, value: string) => {
      setComments((prev) => ({ ...prev, [rowIdx]: value }));
      syncCommentToBackend(rowIdx, value);
    };

    const handleDeleteItem = (item: PriceListItem) => {
      setDeleteConfirmState(item);
    };

    const executeDeleteItem = async (item: PriceListItem) => {
      try {
        const res = await fetch(`http://localhost:8000/api/price-list/${item.row_idx}?price_list_id=${activePriceListId || 1}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadData();
        toast.success('Deleted item from Price Book', 'Item Deleted');
      } catch (err) {
        console.error('[UniversViewer] Delete error:', err);
        toast.error('Failed to delete pricing item. Make sure the backend is running.', 'Delete Failed');
      } finally {
        setDeleteConfirmState(null);
      }
    };

    const handleRenameCategory = async (oldName: string, newName: string) => {
      const cleanNewName = newName.trim();
      if (!cleanNewName || cleanNewName === oldName) return;
      try {
        const res = await fetch(`http://localhost:8000/api/price-list/category/${encodeURIComponent(oldName)}?price_list_id=${activePriceListId || 1}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_name: cleanNewName }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadData();
        toast.success(`Category renamed to "${cleanNewName}"`, 'Category Renamed');
      } catch (err) {
        console.error('[UniversViewer] Category rename error:', err);
        toast.error('Failed to rename category. Make sure the backend is running.', 'Rename Failed');
      }
    };

    const handleToggleSelectRow = (rowIdx: number) => {
      setSelectedRowIdxs((prev) => {
        const next = new Set(prev);
        if (next.has(rowIdx)) {
          next.delete(rowIdx);
        } else {
          next.add(rowIdx);
        }
        return next;
      });
    };

    const handleToggleSelectAll = () => {
      const visibleDataItems = filteredCategories.flatMap((cat) =>
        cat.items.filter((item) => item.row_type === 'data_item')
      );

      const allSelected = visibleDataItems.every((item) => selectedRowIdxs.has(item.row_idx));

      setSelectedRowIdxs((prev) => {
        const next = new Set(prev);
        visibleDataItems.forEach((item) => {
          if (allSelected) {
            next.delete(item.row_idx);
          } else {
            next.add(item.row_idx);
          }
        });
        return next;
      });
    };

    const handleClearSelection = () => {
      setSelectedRowIdxs(new Set());
    };

    const handleBulkResetSelected = () => {
      if (selectedRowIdxs.size === 0) return;
      confirmModal({
        title: 'Reset Quantities & Comments',
        message: `Are you sure you want to reset quantities and comments for the ${selectedRowIdxs.size} selected items?`,
        confirmText: 'Reset',
        type: 'warning',
        onConfirm: async () => {
          const count = selectedRowIdxs.size;
          try {
            setLoading(true);
            const res = await fetch(`http://localhost:8000/api/price-list/clear-quantities-batch?price_list_id=${activePriceListId || 1}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ row_indices: Array.from(selectedRowIdxs) }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await loadData();
            setSelectedRowIdxs(new Set());
            toast.success(`Reset quantities for ${count} items`, 'Reset Complete');
          } catch (err) {
            console.error('[UniversViewer] Bulk clear error:', err);
            toast.error('Failed to clear quantities in batch.', 'Reset Failed');
            setLoading(false);
          }
        },
      });
    };

    const handleBulkDelete = () => {
      if (selectedRowIdxs.size === 0) return;
      confirmModal({
        title: 'Delete Selected Items',
        message: `Are you sure you want to delete the ${selectedRowIdxs.size} selected items from the Price Book? This cannot be undone.`,
        confirmText: 'Delete Items',
        type: 'danger',
        onConfirm: async () => {
          const count = selectedRowIdxs.size;
          try {
            setLoading(true);
            const res = await fetch(`http://localhost:8000/api/price-list/delete-batch?price_list_id=${activePriceListId || 1}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ row_indices: Array.from(selectedRowIdxs) }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await loadData();
            setSelectedRowIdxs(new Set());
            toast.success(`Deleted ${count} items from Price Book`, 'Items Deleted');
          } catch (err) {
            console.error('[UniversViewer] Bulk delete error:', err);
            toast.error('Failed to delete items in batch.', 'Delete Failed');
            setLoading(false);
          }
        },
      });
    };

    const handleAddCategory = () => {
      setNewCatName('');
      setIsCatModalOpen(true);
    };

    const handleSaveCategory = async () => {
      const catName = newCatName.trim();
      if (!catName) return;

      setIsCatModalOpen(false);
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/price-list?price_list_id=${activePriceListId || 1}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "",
            name: "Placeholder item - click edit to customize",
            unit: "each",
            rate: 0.0,
            category: catName
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadData();
        toast.success(`Category "${catName}" added successfully`, 'Category Added');
      } catch (err) {
        console.error("Failed to add category:", err);
        toast.error("Failed to add category. Make sure the backend is running.", 'Add Category Failed');
        setLoading(false);
      }
    };

    const uniqueUnits = useMemo(() => {
      const unitsSet = new Set<string>();
      items.forEach((item) => {
        if (item.row_type === 'data_item' && item.unit) {
          unitsSet.add(item.unit.toLowerCase().trim());
        }
      });
      return Array.from(unitsSet).sort();
    }, [items]);

    const handleSort = (col: typeof sortColumn) => {
      if (sortColumn === col) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else {
          setSortColumn(null);
          setSortDirection(null);
        }
      } else {
        setSortColumn(col);
        setSortDirection('asc');
      }
    };

    const renderSortIcon = (col: 'code' | 'name' | 'action' | 'unit' | 'rate' | 'quantity' | 'totalCost' | 'comments') => {
      if (sortColumn === col) {
        if (sortDirection === 'asc') {
          return <ArrowUpIcon className="size-3 text-foreground ml-1 inline-block shrink-0" />;
        } else {
          return <ArrowDownIcon className="size-3 text-foreground ml-1 inline-block shrink-0" />;
        }
      }
      return <ArrowUpDownIcon className="size-3 text-muted-foreground/40 group-hover/th:text-muted-foreground ml-1 inline-block shrink-0" />;
    };

    // Group items into nested categories
    const categories = useMemo(() => {
      const groups: CategoryGroup[] = [];
      let currentGroup: CategoryGroup | null = null;

      items.forEach((item) => {
        if (item.row_type === 'section_header') {
          currentGroup = {
            categoryName: item.name || item.code || `Section Row ${item.row_idx}`,
            rowIdx: item.row_idx,
            items: [],
          };
          groups.push(currentGroup);
        } else if (item.row_type === 'data_item') {
          if (!currentGroup) {
            currentGroup = {
              categoryName: 'General SOR Pricing Items',
              rowIdx: 0,
              items: [],
            };
            groups.push(currentGroup);
          }
          currentGroup.items.push(item);
        }
      });

      return groups.filter((g) => g.items.length > 0);
    }, [items]);

    // Set initial active category
    useEffect(() => {
      if (categories.length > 0 && !activeCategory) {
        setActiveCategory(categories[0].categoryName);
      }
    }, [categories, activeCategory]);

    // Apply search, filters and sorting
    const filteredCategories = useMemo(() => {
      const query = searchQuery.toLowerCase().trim();
      const minR = filterMinRate ? parseFloat(filterMinRate) : null;
      const maxR = filterMaxRate ? parseFloat(filterMaxRate) : null;

      return categories
        .map((cat) => {
          let matchedItems = cat.items.filter((item) => {
            // 1. Search filter
            if (query) {
              const itemCode = item.code || '';
              const itemName = item.name || '';
              const itemUnit = item.unit || '';
              const codeMatch = itemCode.toLowerCase().includes(query);
              const nameMatch = itemName.toLowerCase().includes(query);
              const unitMatch = itemUnit.toLowerCase().includes(query);
              if (!codeMatch && !nameMatch && !unitMatch) return false;
            }

            // 2. Only show items with Qty > 0
            if (filterOnlyPriced) {
              const qVal = parseFloat(quantities[item.row_idx] || '0') || 0;
              if (qVal <= 0) return false;
            }

            // 3. Filter by Unit
            if (filterUnit) {
              const itemUnit = item.unit || '';
              if (itemUnit.toLowerCase().trim() !== filterUnit.toLowerCase().trim()) return false;
            }

            // 4. Rate range
            if (minR !== null && item.rate < minR) return false;
            if (maxR !== null && item.rate > maxR) return false;

            return true;
          });

          // 5. Apply sorting
          if (sortColumn && sortDirection) {
            matchedItems = [...matchedItems].sort((a, b) => {
              let valA: any = '';
              let valB: any = '';

              if (sortColumn === 'code') {
                valA = a.code || '';
                valB = b.code || '';
              } else if (sortColumn === 'name') {
                valA = a.name || '';
                valB = b.name || '';
              } else if (sortColumn === 'action') {
                valA = a.action || '';
                valB = b.action || '';
              } else if (sortColumn === 'unit') {
                valA = a.unit || '';
                valB = b.unit || '';
              } else if (sortColumn === 'rate') {
                valA = a.rate;
                valB = b.rate;
              } else if (sortColumn === 'quantity') {
                valA = parseFloat(quantities[a.row_idx] || '0') || 0;
                valB = parseFloat(quantities[b.row_idx] || '0') || 0;
              } else if (sortColumn === 'totalCost') {
                valA = a.rate * (parseFloat(quantities[a.row_idx] || '0') || 0);
                valB = b.rate * (parseFloat(quantities[b.row_idx] || '0') || 0);
              } else if (sortColumn === 'comments') {
                valA = comments[a.row_idx] || '';
                valB = comments[b.row_idx] || '';
              }

              if (typeof valA === 'string') {
                return sortDirection === 'asc'
                  ? valA.localeCompare(valB)
                  : valB.localeCompare(valA);
              } else {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
              }
            });
          }

          return { ...cat, items: matchedItems };
        })
        .filter((cat) => cat.items.length > 0);
    }, [categories, searchQuery, filterOnlyPriced, filterUnit, filterMinRate, filterMaxRate, sortColumn, sortDirection, quantities, comments]);

    // KPI stats computed in real-time
    const stats = useMemo(() => {
      let totalCost = 0;
      let activeItemsCount = 0;
      let dataItemsCount = 0;

      items.forEach((item) => {
        if (item.row_type === 'data_item') {
          dataItemsCount++;
          const qtyStr = quantities[item.row_idx] || '';
          const qty = parseFloat(qtyStr) || 0;
          if (qty > 0) {
            totalCost += item.rate * qty;
            activeItemsCount++;
          }
        }
      });

      return {
        totalCost,
        activeItemsCount,
        totalCategories: categories.length,
        totalItems: dataItemsCount
      };
    }, [items, quantities, categories]);

    const containerRef = useRef<HTMLDivElement>(null);

    const handleScrollToSection = (catName: string) => {
      setActiveCategory(catName);
      const row = sectionRefs.current[catName];
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      let currentActive = activeCategory;

      for (const cat of categories) {
        const row = sectionRefs.current[cat.categoryName];
        if (row) {
          const rowRect = row.getBoundingClientRect();
          if (rowRect.top <= containerRect.top + 45) {
            currentActive = cat.categoryName;
          }
        }
      }

      if (currentActive !== activeCategory) {
        setActiveCategory(currentActive);
      }
    };

    if (items.length === 0) {
      return (
        <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-8 bg-bg-app/40 select-none">
          <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue mb-3 shadow-inner">
            <Icon name="price-list" size={26} />
          </div>
          <h3 className="text-sm font-bold text-text-primary font-display tracking-tight">Price Book is Empty</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            Import an Excel price list (.xlsx) or click "+ Create New Book" to populate your Schedule of Rates.
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Main Unified Table Grid Card */}
        <div className="flex-1 w-full border border-border/80 rounded-lg bg-card flex flex-col min-h-0 overflow-hidden shadow-xs">
            {/* Top Toolbar with Search bar */}
            <div className="p-3.5 border-b border-border/80 bg-muted/10 flex justify-between items-center shrink-0">
              {selectedRowIdxs.size > 0 ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                      {selectedRowIdxs.size} selected
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkResetSelected}
                      className="h-8 text-xs gap-1.5 cursor-pointer text-amber-500 hover:bg-amber-500/10"
                    >
                      <RotateCcwIcon className="size-3.5" />
                      <span>Reset Selected</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="h-8 text-xs gap-1.5 cursor-pointer text-destructive hover:bg-destructive/10"
                    >
                      <Trash2Icon className="size-3.5" />
                      <span>Delete Selected</span>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8"
                  >
                    Deselect All
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-sm">
                    <SearchIcon
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                    />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by SOR code or item description..."
                      className="h-8 pl-8 text-xs bg-background"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div ref={filterContainerRef} className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        className={`h-8 text-xs gap-1.5 cursor-pointer ${
                          filterOnlyPriced || filterUnit || filterMinRate || filterMaxRate
                            ? 'border-primary/50 text-foreground bg-primary/5'
                            : ''
                        }`}
                      >
                        <FilterIcon className="size-3.5 text-muted-foreground" />
                        <span>Filters</span>
                        {(filterOnlyPriced || filterUnit || filterMinRate || filterMaxRate) && (
                          <span className="size-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </Button>

                      {/* Custom Filter Popover Card */}
                      {isFilterDropdownOpen && (
                        <div className="absolute right-0 mt-2 z-[40] bg-card border border-border/80 p-4 rounded-lg shadow-xl w-64 flex flex-col gap-3.5 animate-fadeIn">
                          <div className="flex justify-between items-center border-b border-border/60 pb-1.5">
                            <span className="text-xs font-semibold text-foreground">Table Filters</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFilterOnlyPriced(false);
                                setFilterUnit('');
                                setFilterMinRate('');
                                setFilterMaxRate('');
                              }}
                              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground font-medium"
                            >
                              Reset All
                            </Button>
                          </div>

                          {/* 1. Only Show Priced Items (Qty > 0) */}
                          <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none font-medium">
                            <Checkbox
                              checked={filterOnlyPriced}
                              onCheckedChange={(c) => setFilterOnlyPriced(!!c)}
                              className="size-4"
                            />
                            <span>Priced items only (Qty &gt; 0)</span>
                          </label>

                          {/* 2. Filter by Unit */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Filter by Unit</label>
                            <select
                              value={filterUnit}
                              onChange={(e) => setFilterUnit(e.target.value)}
                              className="w-full h-8 bg-background border border-input rounded-md px-2.5 text-xs text-foreground focus:border-primary outline-none"
                            >
                              <option value="">All Units</option>
                              {uniqueUnits.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Rate Range */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-muted-foreground">Rate Range</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="text"
                                value={filterMinRate}
                                onChange={(e) => {
                                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                                    setFilterMinRate(e.target.value);
                                  }
                                }}
                                placeholder="Min ($)"
                                className="h-8 text-xs bg-background"
                              />
                              <Input
                                type="text"
                                value={filterMaxRate}
                                onChange={(e) => {
                                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                                    setFilterMaxRate(e.target.value);
                                  }
                                }}
                                placeholder="Max ($)"
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Showing {filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0)} records
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Scrollable table container */}
            <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted/40 sticky top-0 z-30">
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="w-8 px-1 text-center"></TableHead>
                    <TableHead className="w-8 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={
                            filteredCategories.length > 0 &&
                            filteredCategories.flatMap((cat) =>
                              cat.items.filter((item) => item.row_type === 'data_item')
                            ).every((item) => selectedRowIdxs.has(item.row_idx))
                          }
                          onCheckedChange={handleToggleSelectAll}
                          aria-label="Select all"
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('name')}
                      className="cursor-pointer select-none hover:text-foreground transition-colors group/th min-w-[280px]"
                    >
                      <div className="flex items-center gap-1">
                        <span>Header</span>
                        {renderSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead className="w-36">
                      <span>Section Type</span>
                    </TableHead>
                    <TableHead className="w-28">
                      <span>Status</span>
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('rate')}
                      className="w-24 text-right cursor-pointer select-none hover:text-foreground transition-colors group/th"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Rate ($)</span>
                        {renderSortIcon('rate')}
                      </div>
                    </TableHead>
                    {viewMode !== 'pricelist' && (
                      <>
                        <TableHead
                          onClick={() => handleSort('quantity')}
                          className="w-20 text-right cursor-pointer select-none hover:text-foreground transition-colors group/th"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Quantity</span>
                            {renderSortIcon('quantity')}
                          </div>
                        </TableHead>
                        <TableHead
                          onClick={() => handleSort('totalCost')}
                          className="w-28 text-right cursor-pointer select-none hover:text-foreground transition-colors group/th"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Total Cost</span>
                            {renderSortIcon('totalCost')}
                          </div>
                        </TableHead>
                        <TableHead
                          onClick={() => handleSort('comments')}
                          className="min-w-[160px] max-w-[240px] cursor-pointer select-none hover:text-foreground transition-colors group/th"
                        >
                          <div className="flex items-center gap-1">
                            <span>Reviewer</span>
                            {renderSortIcon('comments')}
                          </div>
                        </TableHead>
                      </>
                    )}
                    <TableHead className="w-10 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, rIdx) => (
                      <TableRow key={rIdx} className="h-12 border-b border-border/40 animate-pulse">
                        <TableCell className="w-8 px-1"><div className="h-3 bg-muted rounded w-3 mx-auto"></div></TableCell>
                        <TableCell className="w-8 px-2"><div className="h-3.5 bg-muted rounded w-3.5 mx-auto"></div></TableCell>
                        <TableCell><div className="h-3.5 bg-muted rounded w-3/4"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted rounded-full w-24"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted rounded-full w-20"></div></TableCell>
                        <TableCell className="text-right"><div className="h-3.5 bg-muted rounded w-14 ml-auto"></div></TableCell>
                        {viewMode !== 'pricelist' && (
                          <>
                            <TableCell className="text-right"><div className="h-3.5 bg-muted rounded w-10 ml-auto"></div></TableCell>
                            <TableCell className="text-right"><div className="h-3.5 bg-muted rounded w-16 ml-auto"></div></TableCell>
                            <TableCell><div className="h-3.5 bg-muted rounded w-28"></div></TableCell>
                          </>
                        )}
                        <TableCell className="w-10"><div className="h-4 bg-muted rounded w-4 mx-auto"></div></TableCell>
                      </TableRow>
                    ))
                  ) : filteredCategories.length > 0 ? (
                    filteredCategories.map((cat) => (
                      <React.Fragment key={cat.categoryName}>
                        {/* Data Item Rows */}
                        {cat.items.map((item) => {
                          const qtyStr = quantities[item.row_idx] || '';
                          const qty = parseFloat(qtyStr) || 0;
                          const total = item.rate * qty;
                          const isSaving = savingRows[item.row_idx] || false;
                          const cmtVal = comments[item.row_idx] !== undefined ? comments[item.row_idx] : (item.comments || (item.cells && item.cells[6]) || '');
                          const isDone = item.confidence_level === 'HIGH' || item.confidence_score === undefined || item.confidence_score >= 70;

                          return (
                            <TableRow
                              key={item.row_idx}
                              className="h-12 border-b border-border/40 hover:bg-muted/40 transition-colors group"
                            >
                              {/* Drag Handle */}
                              <TableCell className="w-8 px-1 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:bg-transparent cursor-grab active:cursor-grabbing"
                                >
                                  <GripVerticalIcon className="size-3 text-muted-foreground" />
                                  <span className="sr-only">Drag</span>
                                </Button>
                              </TableCell>

                              {/* Checkbox */}
                              <TableCell className="w-8 px-2 text-center">
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={selectedRowIdxs.has(item.row_idx)}
                                    onCheckedChange={() => handleToggleSelectRow(item.row_idx)}
                                    aria-label="Select row"
                                  />
                                </div>
                              </TableCell>

                              {/* Header (SOR Code + Description) */}
                              <TableCell className="font-medium text-foreground py-2">
                                <div className="flex items-center gap-2 max-w-[450px]">
                                  {item.code && item.code !== 'UNQUOTED' ? (
                                    <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0">
                                      {item.code}
                                    </span>
                                  ) : item.code === 'UNQUOTED' ? (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 font-bold tracking-wider shrink-0 uppercase">
                                      UNQUOTED
                                    </Badge>
                                  ) : null}
                                  <span
                                    className="truncate text-xs font-medium hover:underline cursor-pointer text-foreground"
                                    onClick={() => setSelectedProvenanceItem({
                                      ...item,
                                      quantity: quantities[item.row_idx] !== undefined ? parseFloat(String(quantities[item.row_idx])) || 0 : item.quantity
                                    })}
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Section Type */}
                              <TableCell className="w-36 py-2">
                                <Badge
                                  variant="outline"
                                  className="px-2.5 py-0.5 text-xs text-muted-foreground font-normal rounded-full max-w-[140px] truncate block text-center"
                                  title={cat.categoryName}
                                >
                                  {cat.categoryName}
                                </Badge>
                              </TableCell>

                              {/* Status */}
                              <TableCell className="w-28 py-2">
                                <Badge
                                  variant="outline"
                                  className="px-2.5 py-0.5 text-xs text-muted-foreground font-normal rounded-full gap-1.5 inline-flex items-center"
                                >
                                  {isDone ? (
                                    <>
                                      <CircleCheckIcon className="size-3 fill-green-500 text-background dark:fill-green-400" />
                                      <span>Done</span>
                                    </>
                                  ) : (
                                    <>
                                      <LoaderIcon className="size-3 text-amber-500 animate-spin" />
                                      <span>In Process</span>
                                    </>
                                  )}
                                </Badge>
                              </TableCell>

                              {/* Rate */}
                              <TableCell className="w-24 text-right font-medium tabular-nums text-xs text-foreground py-2">
                                ${item.rate.toFixed(2)}
                              </TableCell>

                              {/* Quantity */}
                              {viewMode !== 'pricelist' && (
                                <>
                                  <TableCell className="w-20 text-right font-medium tabular-nums text-xs text-foreground py-2">
                                    <div className="relative inline-flex items-center justify-end">
                                      <Input
                                        type="text"
                                        value={qtyStr}
                                        onChange={(e) =>
                                          handleQuantityEdit(item.row_idx, e.target.value)
                                        }
                                        disabled={!hasActiveProject}
                                        className="h-7 w-14 border-transparent bg-transparent text-right text-xs font-semibold tabular-nums shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background ml-auto"
                                        placeholder="0"
                                      />
                                      {isSaving && (
                                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex items-center">
                                          <div className="size-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Total Cost */}
                                  <TableCell className="w-28 text-right font-medium tabular-nums text-xs text-foreground py-2">
                                    {total > 0 ? (
                                      `$${total.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>

                                  {/* Reviewer / Comments */}
                                  <TableCell className="min-w-[160px] max-w-[240px] text-xs text-muted-foreground py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate" title={cmtVal || 'Lead Estimator'}>
                                        {cmtVal || 'Lead Estimator'}
                                      </span>
                                    </div>
                                  </TableCell>
                                </>
                              )}

                              {/* Actions Dropdown */}
                              <TableCell className="w-10 text-center py-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted"
                                    >
                                      <EllipsisVerticalIcon className="size-3.5" />
                                      <span className="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEditItem?.(item)} className="cursor-pointer">
                                      <PencilIcon className="size-3.5 mr-2" />
                                      <span>Edit Item</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setSelectedProvenanceItem({
                                        ...item,
                                        quantity: quantities[item.row_idx] !== undefined ? parseFloat(String(quantities[item.row_idx])) || 0 : item.quantity
                                      })}
                                      className="cursor-pointer"
                                    >
                                      <ExternalLinkIcon className="size-3.5 mr-2" />
                                      <span>View Evidence Proof</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteItem(item)}
                                      className="text-destructive focus:text-destructive cursor-pointer"
                                    >
                                      <Trash2Icon className="size-3.5 mr-2" />
                                      <span>Delete Item</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={viewMode === 'pricelist' ? 7 : 10} className="h-24 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center font-medium">
                          <SearchIcon className="size-6 mb-2 opacity-40" />
                          <p className="text-xs">
                            No matching items found for query &ldquo;{searchQuery}&rdquo;.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Clean Bottom Summary Bar matching data-table footer */}
            <div className="p-3 px-4 border-t border-border/80 bg-muted/20 flex items-center justify-between text-xs select-none shrink-0">
              <div className="text-muted-foreground font-medium">
                {selectedRowIdxs.size} of {items.filter(i => i.row_type === 'data_item').length} row(s) selected.
              </div>
              <div className="flex items-center gap-8">
                {viewMode === 'pricelist' ? (
                  <div className="flex items-center gap-2 font-medium text-muted-foreground">
                    <span>Total Catalog Items:</span>
                    <span className="font-semibold text-foreground">{stats.totalItems} items</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-medium text-muted-foreground">
                      <span>Total Extracted Items:</span>
                      <span className="font-semibold text-foreground">{stats.activeItemsCount > 0 ? `${stats.activeItemsCount} items` : '0 items'}</span>
                    </div>
                    <div className="flex items-center gap-2 font-medium text-muted-foreground">
                      <span>Total Estimated Cost:</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        ${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        {/* Add Category Modal Dialog Overlay */}
        {isCatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-bg-panel border border-border-color p-5 rounded shadow-xl w-full max-w-sm flex flex-col gap-4 animate-scaleUp">
              <div>
                <h3 className="text-sm font-bold font-display text-text-primary">Add New Section</h3>
                <p className="text-[10px] text-text-muted mt-0.5 font-medium">Create a new Schedule of Rates section</p>
              </div>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Section name (e.g. Cable Works)"
                className="w-full h-8 bg-bg-app border border-border-color rounded px-3 text-xs text-text-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 outline-none transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCategory();
                  if (e.key === 'Escape') setIsCatModalOpen(false);
                }}
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-3 py-1.5 border border-border-color rounded text-text-secondary hover:bg-bg-app transition-colors cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="px-3 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white rounded transition-colors cursor-pointer font-semibold"
                >
                  Create Section
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deletion Confirmation Modal Overlay */}
        {deleteConfirmState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-bg-panel border border-border-color p-5 rounded shadow-xl w-full max-w-sm flex flex-col gap-4 animate-scaleUp">
              <div>
                <h3 className="text-sm font-bold font-display text-text-primary">Delete SOR Pricing Item</h3>
                <p className="text-[11px] text-text-secondary mt-1.5 font-medium leading-relaxed">
                  Are you sure you want to delete the SOR item <span className="font-bold text-text-primary">"{deleteConfirmState.code || deleteConfirmState.name}"</span>?
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-border-color pt-3">
                <button
                  onClick={() => setDeleteConfirmState(null)}
                  className="px-3.5 py-1.5 border border-border-color text-text-secondary hover:bg-bg-app transition-colors text-xs font-semibold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeDeleteItem(deleteConfirmState)}
                  className="px-3.5 py-1.5 bg-red-500 text-white hover:bg-red-650 transition-colors text-xs font-semibold rounded cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Category Modal Overlay */}
        {renameCatState?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-bg-panel border border-border-color p-5 rounded shadow-xl w-full max-w-sm flex flex-col gap-4 animate-scaleUp">
              <div>
                <h3 className="text-sm font-bold font-display text-text-primary">Rename Section</h3>
                <p className="text-[10px] text-text-muted mt-0.5 font-medium">Rename section across all pricing items</p>
              </div>
              <input
                type="text"
                value={renameCatState.value}
                onChange={(e) => setRenameCatState(prev => prev ? { ...prev, value: e.target.value } : null)}
                placeholder="Section name"
                className="w-full h-8 bg-bg-app border border-border-color rounded px-3 text-xs text-text-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 outline-none transition-all"
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    await handleRenameCategory(renameCatState.categoryName, renameCatState.value);
                    setRenameCatState(null);
                  }
                  if (e.key === 'Escape') setRenameCatState(null);
                }}
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setRenameCatState(null)}
                  className="px-3 py-1.5 border border-[#d0d7de] rounded text-text-secondary hover:bg-bg-app transition-colors cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleRenameCategory(renameCatState.categoryName, renameCatState.value);
                    setRenameCatState(null);
                  }}
                  className="px-3 py-1.5 bg-accent-blue text-white rounded transition-colors cursor-pointer font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Item Match & Provenance Breakdown Modal */}
        <ItemProvenanceModal
          isOpen={!!selectedProvenanceItem}
          onClose={() => setSelectedProvenanceItem(null)}
          item={selectedProvenanceItem}
          onNavigateToPage={onNavigateToPage}
        />
      </>
    );
  }
);

UniversViewer.displayName = 'UniversViewer';
