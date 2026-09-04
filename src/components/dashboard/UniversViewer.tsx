import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { BOQDataTable, type BOQTableItem, type BOQDataTableRef } from './BOQDataTable';

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
}

interface Props {
  onReady?: () => void;
  onNoFile?: () => void;
  onError?: (msg: string) => void;
  onEditItem?: (item: any) => void;
  onNavigateToPage?: (page: number) => void;
  activePriceListId?: string;
  hasActiveProject?: boolean;
  viewMode?: 'boq' | 'pricelist';
  onCategoryOptionsLoaded?: (categories: string[], units: string[]) => void;
}

export interface UniversViewerRef {
  reload: () => void;
  setItems: (items: PriceListItem[]) => void;
  openAddItem: () => void;
}

const convertPriceListItems = (loaded: PriceListItem[]): BOQTableItem[] => {
  return loaded
    .filter((i) => i.row_type === 'data_item')
    .map((i) => ({
      id: i.row_idx,
      code: i.code || '',
      header: i.name || `Item ${i.row_idx}`,
      name: i.name || '',
      type: i.category || 'General SOR Pricing Items',
      category: i.category,
      status: (i.confidence_level === 'HIGH' || (i.confidence_score || 0) >= 70) ? 'Done' : 'In Process',
      action: i.action || 'INSTALL',
      unit: i.unit || 'EA',
      rate: Number(i.rate) || 0,
      quantity: Number(i.quantity) || 0,
      target: String(i.quantity || 0),
      limit: '99',
      reviewer: i.comments || 'Lead Estimator',
      comments: i.comments || '',
      confidence_score: i.confidence_score || 95,
      confidence_level: i.confidence_level || 'HIGH',
      source_sheet: i.source_sheet || 'Sample_Office_BOQ.pdf',
      source_table: 'Schedule of Rates',
      evidence_json: i.evidence_json || '',
    }));
};

const memoryCache: Record<string, PriceListItem[]> = {};

export const clearUniversViewerCache = (key?: string) => {
  if (key) delete memoryCache[key];
  else Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
};

export const UniversViewer = forwardRef<UniversViewerRef, Props>(
  ({ onReady, onNoFile, onError, onEditItem, onNavigateToPage, activePriceListId, hasActiveProject = true, viewMode = 'boq', onCategoryOptionsLoaded }, ref) => {
    const dataTableRef = useRef<BOQDataTableRef>(null);
    const cacheKey = `${viewMode}-${activePriceListId || 1}`;
    const initialCached = memoryCache[cacheKey];

    const [tableItems, setTableItems] = useState<BOQTableItem[]>(() => {
      if (initialCached && initialCached.length > 0) {
        return convertPriceListItems(initialCached);
      }
      return [];
    });
    const [loading, setLoading] = useState(!initialCached || initialCached.length === 0);

    const onReadyRef = useRef(onReady);
    const onNoFileRef = useRef(onNoFile);
    const onErrorRef = useRef(onError);
    const onCategoryOptionsLoadedRef = useRef(onCategoryOptionsLoaded);

    useEffect(() => {
      onReadyRef.current = onReady;
      onNoFileRef.current = onNoFile;
      onErrorRef.current = onError;
      onCategoryOptionsLoadedRef.current = onCategoryOptionsLoaded;
    }, [onReady, onNoFile, onError, onCategoryOptionsLoaded]);

    const loadData = useCallback(async (forceLoading = false) => {
      const cKey = `${viewMode}-${activePriceListId || 1}`;
      const cached = memoryCache[cKey];
      if (!cached || forceLoading) {
        setLoading(true);
      }
      try {
        const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
        const res = await fetch(`http://localhost:8000/api/${endpoint}?price_list_id=${activePriceListId || 1}&t=${Date.now()}`);

        if (res.ok) {
          const json = await res.json();
          const loaded: PriceListItem[] = json.items || [];
          memoryCache[cKey] = loaded;
          const converted = convertPriceListItems(loaded);
          setTableItems(converted);

          // Extract categories and units for parent dropdowns
          const catsSet = new Set<string>();
          const unitsSet = new Set<string>();
          loaded.forEach((i) => {
            if (i.row_type === 'section_header' && i.name) catsSet.add(i.name);
            else if (i.row_type === 'data_item') {
              if (i.category) catsSet.add(i.category);
              if (i.unit) unitsSet.add(i.unit.toLowerCase().trim());
            }
          });
          onCategoryOptionsLoadedRef.current?.(Array.from(catsSet).sort(), Array.from(unitsSet).sort());
        }
      } catch (err) {
        console.error('Error loading price list data:', err);
      } finally {
        setLoading(false);
        onReadyRef.current?.();
      }
    }, [activePriceListId, viewMode]);

    useEffect(() => {
      loadData();
    }, [loadData]);

    useImperativeHandle(ref, () => ({
      reload: () => loadData(true),
      setItems: (loaded: PriceListItem[]) => {
        const cKey = `${viewMode}-${activePriceListId || 1}`;
        memoryCache[cKey] = loaded;
        const converted = convertPriceListItems(loaded);
        setTableItems(converted);
        setLoading(false);
      },
      openAddItem: () => {
        dataTableRef.current?.openAddItem();
      },
    }));

    return (
      <BOQDataTable
        ref={dataTableRef}
        initialData={tableItems}
        loading={loading}
        viewMode={viewMode}
        activePriceListId={activePriceListId}
        onEditItem={onEditItem}
        onNavigateToPage={onNavigateToPage}
        onReload={loadData}
      />
    );
  }
);

UniversViewer.displayName = 'UniversViewer';
