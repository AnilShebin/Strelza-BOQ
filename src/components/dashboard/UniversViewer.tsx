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
        console.error('[UniversViewer] Load error:', err);
        setLoading(false);
        onErrorRef.current?.('Failed to load Excel price list. Make sure the backend is running.');
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
          return <Icon name="chevron-up" size={12} className="text-accent-blue font-bold shrink-0 ml-1.5" />;
        } else {
          return <Icon name="chevron-down" size={12} className="text-accent-blue font-bold shrink-0 ml-1.5" />;
        }
      }
      return <Icon name="chevrons-up-down" size={12} className="text-text-muted/30 group-hover:text-text-muted/60 transition-colors shrink-0 ml-1.5" />;
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
      <div className="h-full flex flex-col min-h-0 bg-bg-app">


        {/* Workspace content area (Sidebar + Unified Data Table) */}
        <div className="flex-1 flex min-h-0 gap-4 pb-0 overflow-hidden">


          {/* Right Main Unified Table Grid */}
          <div className="flex-1 border border-border-color rounded bg-bg-panel flex flex-col min-h-0 overflow-hidden shadow-sm">
            {/* Top Toolbar with Search bar */}
            <div className="h-[54px] px-3.5 border-b border-border-color bg-bg-panel/10 flex justify-between items-center shrink-0">
              {selectedRowIdxs.size > 0 ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-accent-blue px-2.5 py-1 bg-accent-blue/10 border border-accent-blue/20 rounded">
                      {selectedRowIdxs.size} selected
                    </span>
                    <button
                      onClick={handleBulkResetSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 border border-yellow-500/30 rounded font-bold text-xs cursor-pointer transition-all border-0"
                    >
                      <Icon name="close" size={11} />
                      <span>Reset Selected</span>
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30 rounded font-bold text-xs cursor-pointer transition-all border-0"
                    >
                      <Icon name="trash" size={11} />
                      <span>Delete Selected</span>
                    </button>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="text-xs font-bold text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent"
                  >
                    Deselect All
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-md">
                    <Icon
                      name="search"
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by SOR code or item description..."
                      className="w-full h-8.5 bg-bg-panel border border-border-color rounded pl-9 pr-4 text-xs text-text-secondary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 outline-none transition-all duration-150 shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div ref={filterContainerRef} className="relative">
                      <button
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1 border rounded transition-all cursor-pointer font-bold text-xs ${filterOnlyPriced || filterUnit || filterMinRate || filterMaxRate
                            ? 'border-accent bg-accent/40 text-text-primary'
                            : 'border-border-color bg-bg-panel hover:bg-bg-app text-text-secondary'
                          }`}
                      >
                        <Icon name="filter" size={11} />
                        <span>Filters</span>
                        {(filterOnlyPriced || filterUnit || filterMinRate || filterMaxRate) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                        )}
                      </button>

                      {/* Custom Filter Popover Card */}
                      {isFilterDropdownOpen && (
                        <div className="absolute right-0 mt-2 z-[40] bg-bg-panel border border-border-color p-4 rounded shadow-xl w-64 flex flex-col gap-3.5 animate-fadeIn">
                          <div className="flex justify-between items-center border-b border-border-color pb-1.5">
                            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Table Filters</span>
                            <button
                              onClick={() => {
                                setFilterOnlyPriced(false);
                                setFilterUnit('');
                                setFilterMinRate('');
                                setFilterMaxRate('');
                              }}
                              className="text-[10px] text-text-muted hover:text-accent-blue transition-colors font-bold cursor-pointer bg-transparent border-0"
                            >
                              Reset All
                            </button>
                          </div>

                          {/* 1. Only Show Priced Items (Qty > 0) */}
                          <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer select-none font-semibold">
                            <input
                              type="checkbox"
                              checked={filterOnlyPriced}
                              onChange={(e) => setFilterOnlyPriced(e.target.checked)}
                              className="rounded border-border-color text-accent-blue focus:ring-accent-blue/20 w-3.5 h-3.5"
                            />
                            <span>Priced items only (Qty &gt; 0)</span>
                          </label>

                          {/* 2. Filter by Unit */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Filter by Unit</label>
                            <select
                              value={filterUnit}
                              onChange={(e) => setFilterUnit(e.target.value)}
                              className="w-full h-8 bg-bg-app border border-border-color rounded px-2.5 text-xs text-text-secondary focus:border-accent-blue outline-none"
                            >
                              <option value="">All Units</option>
                              {uniqueUnits.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Rate Range */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rate Range</label>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={filterMinRate}
                                onChange={(e) => {
                                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                                    setFilterMinRate(e.target.value);
                                  }
                                }}
                                placeholder="Min ($)"
                                className="w-full h-8 bg-bg-app border border-border-color rounded px-2.5 text-xs text-text-secondary focus:border-accent-blue outline-none"
                              />
                              <input
                                type="text"
                                value={filterMaxRate}
                                onChange={(e) => {
                                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                                    setFilterMaxRate(e.target.value);
                                  }
                                }}
                                placeholder="Max ($)"
                                className="w-full h-8 bg-bg-app border border-border-color rounded px-2.5 text-xs text-text-secondary focus:border-accent-blue outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-[9.5px] text-text-muted font-bold uppercase tracking-wider">
                      Showing {filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0)} records
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Scrollable table container */}
            <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs leading-normal bg-bg-panel/10">
                <thead>
                  <tr className="bg-bg-app border-b border-border-color font-bold text-text-muted select-none text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-3 w-[40px] text-center bg-bg-app sticky top-0 z-30 border-b border-border-color">
                      <input
                        type="checkbox"
                        checked={
                          filteredCategories.length > 0 &&
                          filteredCategories.flatMap((cat) =>
                            cat.items.filter((item) => item.row_type === 'data_item')
                          ).every((item) => selectedRowIdxs.has(item.row_idx))
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-border-color text-accent-blue focus:ring-accent-blue/20 w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th
                      onClick={() => handleSort('code')}
                      className="py-3 px-3 text-left w-[120px] bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                    >
                      <div className="flex items-center justify-between">
                        <span>SOR Code</span>
                        {renderSortIcon('code')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3 px-3 text-left bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                    >
                      <div className="flex items-center justify-between">
                        <span>Item Description</span>
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    {viewMode !== 'pricelist' && (
                      <th
                        onClick={() => handleSort('action')}
                        className="py-3 px-3 w-[110px] text-center bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                      >
                        <div className="flex items-center justify-center">
                          <span>Action</span>
                          {renderSortIcon('action')}
                        </div>
                      </th>
                    )}
                    <th
                      onClick={() => handleSort('unit')}
                      className="py-3 px-3 w-[80px] text-center bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                    >
                      <div className="flex items-center justify-center">
                        <span>Unit</span>
                        {renderSortIcon('unit')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('rate')}
                      className="py-3 px-3 w-[110px] text-right bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                    >
                      <div className="flex items-center justify-end">
                        <span>Rate</span>
                        {renderSortIcon('rate')}
                      </div>
                    </th>
                    {viewMode !== 'pricelist' && (
                      <>
                        <th
                          onClick={() => handleSort('quantity')}
                          className="py-3 px-3 w-[100px] text-center bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                        >
                          <div className="flex items-center justify-center">
                            <span>Quantity</span>
                            {renderSortIcon('quantity')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('totalCost')}
                          className="py-3 px-3 w-[130px] text-right bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                        >
                          <div className="flex items-center justify-end">
                            <span>Total Cost</span>
                            {renderSortIcon('totalCost')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('comments')}
                          className="py-3 px-3 min-w-[240px] max-w-md text-left bg-bg-app sticky top-0 z-30 border-b border-border-color cursor-pointer select-none hover:text-text-primary transition-colors group/th"
                        >
                          <div className="flex items-center justify-between">
                            <span>Comments</span>
                            {renderSortIcon('comments')}
                          </div>
                        </th>
                      </>
                    )}
                    <th className="py-3 px-3 w-[100px] text-center bg-bg-app sticky top-0 z-30 border-b border-border-color select-none">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, rIdx) => (
                      <tr key={rIdx} className="border-b border-border-color-light animate-pulse">
                        <td className="py-3 px-3 w-[40px]"><div className="h-3 bg-border-color/30 rounded w-4 mx-auto"></div></td>
                        <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-16"></div></td>
                        <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-5/6"></div></td>
                        {viewMode !== 'pricelist' && (
                          <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-16 mx-auto"></div></td>
                        )}
                        <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-8 mx-auto"></div></td>
                        <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-12 ml-auto"></div></td>
                        {viewMode !== 'pricelist' && (
                          <>
                            <td className="py-3 px-3"><div className="h-6 bg-border-color/20 rounded w-16 mx-auto"></div></td>
                            <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-16 ml-auto"></div></td>
                            <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-24"></div></td>
                          </>
                        )}
                        <td className="py-3 px-3"><div className="h-3 bg-border-color/30 rounded w-12 mx-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredCategories.length > 0 ? (
                    filteredCategories.map((cat) => (
                      <React.Fragment key={cat.categoryName}>
                        {/* Category Header Row separator (Flat, matching mockup, sticky under headers) */}
                        <tr
                          ref={(el) => { sectionRefs.current[cat.categoryName] = el; }}
                          className="scroll-mt-[35px]"
                        >
                          <td
                            colSpan={viewMode === 'pricelist' ? 6 : 10}
                            className="py-2 px-3 text-[10px] tracking-wide bg-bg-panel/95 border-b border-border-color sticky top-[35px] z-20 font-bold backdrop-blur-md"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-display font-bold text-accent-blue text-xs">{cat.categoryName}</span>
                              <span className="text-[10px] text-accent-blue font-bold px-2.5 py-0.5 bg-accent-blue/10 border border-accent-blue/20 rounded">
                                {cat.items.length} items
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Data Item Rows */}
                        {cat.items.map((item) => {
                          const qtyStr = quantities[item.row_idx] || '';
                          const qty = parseFloat(qtyStr) || 0;
                          const total = item.rate * qty;
                          const isSaving = savingRows[item.row_idx] || false;
                          const hasQtyVal = qty > 0;
                          const isUnquoted = item.code === 'UNQUOTED';
                          const rowClass = hasQtyVal && viewMode !== 'pricelist' && !isUnquoted ? 'bg-emerald-500/5 font-semibold text-text-primary' : 'bg-transparent';

                          return (
                            <tr
                              key={item.row_idx}
                              className={`border-b border-border-color-light transition-colors duration-100 ${rowClass}`}
                            >
                              {/* Selection Checkbox */}
                              <td className="py-3 px-3 text-center w-[40px]">
                                <input
                                  type="checkbox"
                                  checked={selectedRowIdxs.has(item.row_idx)}
                                  onChange={() => handleToggleSelectRow(item.row_idx)}
                                  className="rounded border-border-color text-accent-blue focus:ring-accent-blue/20 w-3.5 h-3.5 cursor-pointer"
                                />
                              </td>

                              {/* SOR Code Badge (Orange highlight in mockup) */}
                              <td className="py-3 px-3 font-mono font-bold text-accent-blue/90">
                                {item.code ? (
                                  item.code === 'UNQUOTED' ? (
                                    <span className="bg-rose-500/15 px-2 py-0.5 rounded text-[9.5px] border border-rose-500/30 text-rose-500 font-extrabold tracking-wider">
                                      UNQUOTED
                                    </span>
                                  ) : (
                                    <span className="bg-[#f27e20]/10 px-2 py-0.5 rounded text-[9.5px] border border-[#f27e20]/25 text-[#f27e20]">
                                      {item.code}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-text-muted font-normal italic">-</span>
                                )}
                              </td>

                              {/* Item Description & Confidence Badge */}
                              <td className="py-3 px-3 text-text-secondary font-medium max-w-md break-words leading-relaxed">
                                {viewMode === 'pricelist' ? (
                                  <div className="max-w-[600px] break-words">{item.name}</div>
                                ) : (
                                  <div
                                    className="cursor-pointer hover:text-accent-blue transition-colors flex items-center gap-1.5 group select-none max-w-[600px]"
                                    onClick={() => setSelectedProvenanceItem({
                                      ...item,
                                      quantity: quantities[item.row_idx] !== undefined ? parseFloat(String(quantities[item.row_idx])) || 0 : item.quantity
                                    })}
                                    title="Click to view extraction facts and match provenance"
                                  >
                                    <span className="group-hover:underline underline-offset-2 break-words">{item.name}</span>
                                    <Icon name="search" size={11} className="opacity-0 group-hover:opacity-100 text-accent-blue shrink-0 transition-opacity" />
                                  </div>
                                )}
                                {viewMode !== 'pricelist' && (() => {
                                  const qty = quantities[item.row_idx] !== undefined ? quantities[item.row_idx] : item.quantity;
                                  const numQty = parseFloat(String(qty || 0));
                                  if (isNaN(numQty) || numQty <= 0) return null;

                                  let evData: any = null;
                                  if (item.evidence_json) {
                                    try {
                                      evData = JSON.parse(item.evidence_json);
                                    } catch (e) {
                                      // ignore json parse error
                                    }
                                  }

                                  const confLevel = item.confidence_level || 'HIGH';
                                  const confScore = item.confidence_score !== undefined ? item.confidence_score : 100.0;

                                  const evidenceTooltip = evData ? [
                                    `Provenance: ${evData.source_sheet || 'Drawing Sheet'}`,
                                    evData.source_table ? `Table: ${evData.source_table}` : '',
                                    evData.sector && evData.sector !== '-' ? `Sector: ${evData.sector}` : '',
                                    evData.matched_rule ? `Rule: ${evData.matched_rule}` : '',
                                    `Status: ${evData.validation_status || 'VERIFIED'}`
                                  ].filter(Boolean).join(' • ') : `Confidence: ${confScore}%`;

                                  const openModal = () => setSelectedProvenanceItem({
                                    ...item,
                                    quantity: numQty
                                  });

                                  if (confLevel === 'NEEDS_REVIEW' || confScore < 70) {
                                    return (
                                      <div
                                        className="mt-1 flex items-center gap-1.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                                        title={evidenceTooltip}
                                        onClick={openModal}
                                      >
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                          ⚠️ Review Required ({confScore.toFixed(0)}%)
                                        </span>
                                        {evData?.source_sheet && (
                                          <span className="text-[9px] text-text-muted font-normal">
                                            {evData.source_sheet}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  } else if (confLevel === 'MEDIUM' || confScore < 90) {
                                    return (
                                      <div
                                        className="mt-1 flex items-center gap-1.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                                        title={evidenceTooltip}
                                        onClick={openModal}
                                      >
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                          ⚡ Recommended Review ({confScore.toFixed(0)}%)
                                        </span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div
                                        className="mt-1 flex items-center gap-1.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                                        title={evidenceTooltip}
                                        onClick={openModal}
                                      >
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                          ✓ {confScore.toFixed(0)}% Verified
                                        </span>
                                        {evData?.source_sheet && (
                                          <span className="text-[9px] text-text-muted font-normal">
                                            {evData.source_sheet}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                })()}
                              </td>

                              {/* Action Badge */}
                              {viewMode !== 'pricelist' && (
                                <td className="py-3 px-3 text-center">
                                  {item.action ? (
                                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border uppercase tracking-wider ${item.action.toUpperCase().includes('REMOVE')
                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                        : item.action.toUpperCase().includes('RELOCATE')
                                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      }`}>
                                      {item.action}
                                    </span>
                                  ) : (
                                    <span className="text-text-muted italic font-normal">-</span>
                                  )}
                                </td>
                              )}

                              {/* Unit */}
                              <td className="py-3 px-3 text-center text-text-muted font-semibold">
                                {item.unit || <span className="italic font-normal">-</span>}
                              </td>

                              {/* Rate */}
                              <td className="py-3 px-3 text-right text-text-secondary font-bold font-mono">
                                ${item.rate.toFixed(2)}
                              </td>

                              {/* Quantity Input with saving indicator */}
                              {viewMode !== 'pricelist' && (
                                <>
                                  <td className="py-3 px-3 text-center">
                                    <div className="relative inline-flex items-center">
                                      <input
                                        type="text"
                                        value={qtyStr}
                                        onChange={(e) =>
                                          handleQuantityEdit(item.row_idx, e.target.value)
                                        }
                                        disabled={!hasActiveProject}
                                        className={`w-[64px] h-6 bg-bg-app border border-border-color rounded px-1.5 text-center text-xs font-mono font-bold outline-none transition-all duration-150 ${isSaving
                                            ? 'border-accent-blue ring-1 ring-accent-blue/20'
                                            : isUnquoted
                                              ? 'border-rose-500/40 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
                                              : hasQtyVal
                                                ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20'
                                                : 'border-border-color focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20'
                                          }`}
                                        placeholder="0"
                                      />
                                      {isSaving && (
                                        <div className="absolute -right-5 top-1/2 -translate-y-1/2 flex items-center">
                                          <div className="w-2.5 h-2.5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Total Cost Column */}
                                  <td className="py-3 px-3 text-right font-mono font-bold text-text-primary">
                                    {total > 0 ? (
                                      <span className="text-emerald-500">
                                        ${total.toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    ) : (
                                      <span className="text-text-muted/40">$-</span>
                                    )}
                                  </td>

                                  {/* Comments Column Input */}
                                  <td className="py-3 px-3 text-left max-w-md">
                                    {(() => {
                                      const cmtVal = comments[item.row_idx] !== undefined ? comments[item.row_idx] : (item.comments || (item.cells && item.cells[6]) || '');
                                      const isMismatch = cmtVal.toLowerCase().includes('not matching') || cmtVal.toLowerCase().includes('discrepancy') || cmtVal.toLowerCase().includes('mismatch');
                                      const isUnquoted = cmtVal.toLowerCase().includes('estimator') || cmtVal.toLowerCase().includes('unquoted');
                                      const isWarning = isMismatch || isUnquoted || cmtVal.includes('⚠️') || cmtVal.toLowerCase().includes('warning') || cmtVal.toLowerCase().includes('verify') || cmtVal.toLowerCase().includes('re-check');

                                      let extraClass = 'border-border-color focus:border-accent-blue focus:ring-accent-blue/20 text-text-secondary bg-bg-app';
                                      if (isMismatch) {
                                        extraClass = 'border-rose-500/60 bg-rose-500/5 text-rose-600 dark:text-rose-400 font-semibold focus:border-rose-500 focus:ring-rose-500/20';
                                      } else if (isUnquoted || isWarning) {
                                        extraClass = 'border-amber-500/60 bg-amber-500/5 text-amber-600 dark:text-amber-400 font-semibold focus:border-amber-500 focus:ring-amber-500/20';
                                      }

                                      const calculatedRows = cmtVal ? Math.min(4, Math.max(1, Math.ceil(cmtVal.length / 38))) : 1;

                                      return (
                                        <div className="relative flex items-start w-full">
                                          <textarea
                                            rows={calculatedRows}
                                            value={cmtVal}
                                            onChange={(e) =>
                                              handleCommentEdit(item.row_idx, e.target.value)
                                            }
                                            className={`w-full rounded py-1 pl-2 pr-6 text-xs outline-none border focus:ring-1 transition-all duration-150 resize-none break-words whitespace-normal leading-relaxed ${extraClass}`}
                                            placeholder="Add comments..."
                                            title={cmtVal}
                                          />
                                          {isMismatch && (
                                            <span className="absolute right-1.5 top-1.5 text-[9px] font-bold text-rose-500 pointer-events-none" title="Mismatch with layout">
                                              ⚠️
                                            </span>
                                          )}
                                          {!isMismatch && isWarning && (
                                            <span className="absolute right-1.5 top-1.5 text-[9px] font-bold text-amber-500 pointer-events-none" title="AI Verification Note">
                                              ⚠️
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </>
                              )}

                              {/* Edit/Delete Actions */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => onEditItem?.(item)}
                                    className="p-1 text-[#f27e20] hover:bg-[#f27e20]/15 rounded transition-colors cursor-pointer"
                                    title="Edit Item"
                                  >
                                    <Icon name="edit" size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="p-1 text-red-500 hover:bg-red-500/15 rounded transition-colors cursor-pointer"
                                    title="Delete Item"
                                  >
                                    <Icon name="trash" size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-text-muted select-none">
                        <div className="flex flex-col items-center justify-center font-semibold">
                          <Icon name="search" size={24} className="mb-3 opacity-40" />
                          <p className="text-xs">
                            No matching items found for query &ldquo;{searchQuery}&rdquo;.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-bg-panel border-t-2 border-border-color z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                  {viewMode === 'pricelist' ? (
                    <tr className="font-bold text-text-primary text-xs select-none">
                      <td colSpan={3} className="py-3.5 px-4 text-left font-display text-text-secondary uppercase tracking-wider text-[10px]">
                        Total Catalog Items:
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-[11px] text-text-secondary">
                        {stats.totalItems} items
                      </td>
                      <td colSpan={2} className="py-3.5 px-3"></td>
                    </tr>
                  ) : (
                    <tr className="font-bold text-text-primary text-xs select-none">
                      <td colSpan={6} className="py-3.5 px-4 text-right font-display text-text-secondary uppercase tracking-wider text-[10px]">
                        Total Estimated Cost:
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-[11px] text-text-secondary">
                        {stats.activeItemsCount > 0 ? `${stats.activeItemsCount} items` : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-display text-emerald-500 text-sm font-black pr-3">
                        ${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="py-3.5 px-3"></td>
                    </tr>
                  )}
                </tfoot>
              </table>
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
      </div>
    );
  }
);

UniversViewer.displayName = 'UniversViewer';
