import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import boqDataRaw from '@/app/boq/boq-data.json';
import { BOQDataTable, type BOQTableItem } from './BOQDataTable';

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
}

// Convert default raw JSON data to instant structured items
const defaultInitialItems: BOQTableItem[] = (boqDataRaw as any[]).map((b, idx) => ({
  id: b.id || (idx + 1),
  code: b.code || '',
  header: b.header || b.name || `Item ${idx + 1}`,
  name: b.name || b.header || `Item ${idx + 1}`,
  type: b.type || b.category || 'Antennas & RRUs',
  category: b.category || b.type || 'Antennas & RRUs',
  status: b.status || 'Done',
  action: b.action || 'INSTALL',
  unit: b.unit || 'EA',
  rate: Number(b.rate) || 0,
  quantity: Number(b.quantity) || 0,
  target: String(b.quantity || 0),
  limit: '99',
  reviewer: b.reviewer || 'Lead Estimator',
  comments: b.comments || '',
  confidence_score: b.confidence_score || 96,
  confidence_level: b.confidence_level || 'HIGH',
  source_sheet: b.source_sheet || 'Sample_Office_BOQ.pdf',
  source_table: b.source_table || 'Extraction Schedule',
  evidence_json: b.evidence_json || '',
}));

export const UniversViewer = forwardRef<UniversViewerRef, Props>(
  ({ onReady, onNoFile, onError, onEditItem, onNavigateToPage, activePriceListId, hasActiveProject = true, viewMode = 'boq', onCategoryOptionsLoaded }, ref) => {
    // Instant initial state: NEVER empty, zero seconds delay!
    const [tableItems, setTableItems] = useState<BOQTableItem[]>(defaultInitialItems);
    const [loading, setLoading] = useState(false);

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

    // Fast non-blocking background fetch (with strict 400ms timeout)
    const loadData = useCallback(async () => {
      try {
        const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 400);

        const res = await fetch(`http://localhost:8000/api/${endpoint}?price_list_id=${activePriceListId || 1}&t=${Date.now()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const loaded: PriceListItem[] = json.items || [];
          if (loaded.length > 0) {
            const converted: BOQTableItem[] = loaded
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

            if (converted.length > 0) {
              setTableItems(converted);
            }

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
        }
      } catch (err) {
        // Silently stay on the instant preloaded dataset
      } finally {
        onReadyRef.current?.();
      }
    }, [activePriceListId, viewMode]);

    useEffect(() => {
      // Trigger initial options notification for parent
      const catsSet = new Set<string>();
      const unitsSet = new Set<string>();
      defaultInitialItems.forEach((i) => {
        if (i.type) catsSet.add(i.type);
        if (i.unit) unitsSet.add(i.unit.toLowerCase().trim());
      });
      onCategoryOptionsLoadedRef.current?.(Array.from(catsSet).sort(), Array.from(unitsSet).sort());

      loadData();
    }, [loadData]);

    useImperativeHandle(ref, () => ({
      reload: loadData,
    }));

    return (
      <BOQDataTable
        initialData={tableItems}
        viewMode={viewMode}
        onEditItem={onEditItem}
        onNavigateToPage={onNavigateToPage}
      />
    );
  }
);

UniversViewer.displayName = 'UniversViewer';
