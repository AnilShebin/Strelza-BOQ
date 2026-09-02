import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';
import { KPICards } from './KPICards';
import { ComplianceChecks } from './ComplianceChecks';
import { UniversViewer, type UniversViewerRef } from './UniversViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast as sonnerToast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PlusIcon,
  FileSpreadsheetIcon,
  RotateCcwIcon,
  DownloadIcon,
  UploadIcon,
  BookOpenIcon,
  Trash2Icon,
  EditIcon,
  CheckIcon,
  ChevronDownIcon,
  LayersIcon,
} from 'lucide-react';

interface ShadcnSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  onAddNew?: () => void;
  addNewText?: string;
}

const ShadcnSelect: React.FC<ShadcnSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select option...",
  onAddNew,
  addNewText = "Add custom...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8.5 bg-bg-app border border-border-color rounded-md px-3 text-xs text-text-secondary flex items-center justify-between hover:bg-bg-panel transition-all outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 cursor-pointer shadow-sm"
      >
        <span className="truncate">{value || placeholder}</span>
        <Icon name="chevron-down" size={12} className="text-text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-bg-panel border border-border-color rounded-md shadow-lg flex flex-col min-w-0 max-h-60 overflow-hidden animate-fadeIn">
          <div className="p-1.5 border-b border-border-color flex items-center gap-1.5 bg-bg-app/40 shrink-0">
            <Icon name="search" size={10} className="text-text-muted ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-[11px] text-text-secondary outline-none py-0.5 border-0"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5 custom-scrollbar min-h-0">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer flex items-center justify-between border-0 ${
                    value === opt
                      ? 'bg-accent-blue-light text-accent-blue font-semibold'
                      : 'text-text-secondary hover:bg-bg-app hover:text-text-primary bg-transparent'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {value === opt && <Icon name="check" size={10} className="text-accent-blue" />}
                </button>
              ))
            ) : (
              <div className="py-3 text-center text-[10px] text-text-muted font-medium">
                No matches found
              </div>
            )}
          </div>

          {onAddNew && (
            <div className="p-1 border-t border-border-color bg-bg-app/20 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew();
                  setSearch('');
                }}
                className="w-full text-center py-1.5 rounded-md text-[10px] font-bold text-accent-blue hover:bg-accent-blue/10 transition-all cursor-pointer flex items-center justify-center gap-1 border border-dashed border-accent-blue/20 hover:border-accent-blue/40"
              >
                <span>{addNewText}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
const DEFAULT_UNITS = ['EA', 'MTR', 'SET', 'JOB', 'DAY', 'LOT', 'CORE', 'HOUR'];
const DEFAULT_CATEGORIES = [
  'Antennas & RRUs',
  'Power & Feeder',
  'Structural & Mounts',
  'Plant & Rigging',
  'Testing & Handover',
  'Architectural',
  'General SOR Pricing Items'
];

interface BOQDashboardProps {
  pdfName?: string;
  analyzedData: any;
  analyzing: boolean;
  onLoadPDF: () => void;
  onNavigateToPage?: (page: number) => void;
  viewMode: 'boq' | 'pricelist';
}

export const BOQDashboard: React.FC<BOQDashboardProps> = ({
  pdfName,
  analyzedData,
  analyzing,
  onLoadPDF,
  onNavigateToPage,
  viewMode,
}) => {
  const viewerRef = useRef<UniversViewerRef>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasFile, setHasFile] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('EA');
  const [formRate, setFormRate] = useState('');
  const [formCategory, setFormCategory] = useState('Antennas & RRUs');

  const [existingCategories, setExistingCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [existingUnits, setExistingUnits] = useState<string[]>(DEFAULT_UNITS);

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    placeholder: string;
    value: string;
    onSubmit: (val: string) => void;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const downloadContainerRef = useRef<HTMLDivElement>(null);
  const templateContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [priceLists, setPriceLists] = useState<{ id: number; name: string; is_active: number }[]>([]);
  const [activePriceListId, setActivePriceListId] = useState<string>('1');

  // Automatically reload sheet when analyzedData changes (e.g. from BOQ generation)
  useEffect(() => {
    if (analyzedData) {
      viewerRef.current?.reload();
    }
  }, [analyzedData]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (downloadContainerRef.current && !downloadContainerRef.current.contains(e.target as Node)) {
        setIsDownloadDropdownOpen(false);
      }
      if (templateContainerRef.current && !templateContainerRef.current.contains(e.target as Node)) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadDropdownOptions = async (priceListId?: string) => {
    try {
      const targetId = priceListId || activePriceListId || '1';
      const res = await fetch(`http://localhost:8000/api/price-list?price_list_id=${targetId}`);
      if (res.ok) {
        const json = await res.json();
        const loadedItems = json.items || [];
        
        const categoriesSet = new Set<string>();
        const unitsSet = new Set<string>();
        
        loadedItems.forEach((item: any) => {
          if (item.row_type === 'section_header' && item.name) {
            categoriesSet.add(item.name);
          } else if (item.row_type === 'data_item') {
            if (item.category) categoriesSet.add(item.category);
            if (item.unit) unitsSet.add(item.unit.toLowerCase().trim());
          }
        });
        
        if (categoriesSet.size === 0) {
          categoriesSet.add('General SOR Pricing Items');
        }
        
        const standardUnits = ['each', 'meter', 'm', 'lot', 'km', 'hr', 'day', 'job', 'activity'];
        standardUnits.forEach(u => unitsSet.add(u));
        
        setExistingCategories(Array.from(categoriesSet).sort());
        setExistingUnits(Array.from(unitsSet).sort());
      }
    } catch (err) {
      console.error('Failed to load dropdown options:', err);
    }
  };

  const loadPriceLists = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/price-lists');
      if (res.ok) {
        const data = await res.json();
        setPriceLists(data);
        const active = data.find((p: any) => p.is_active === 1);
        if (active) {
          setActivePriceListId(String(active.id));
          localStorage.setItem('activePriceListId', String(active.id));
        }
      }
    } catch (err) {
      console.error('Failed to load Price Books:', err);
    }
  };

  useEffect(() => {
    loadPriceLists();
  }, []);

  useEffect(() => {
    if (analyzedData) {
      viewerRef.current?.reload();
    }
  }, [analyzedData]);

  const handlePriceListChange = async (idStr: string) => {
    if (idStr === 'CREATE_NEW_BOOK') {
      triggerCreatePriceList();
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:8000/api/price-lists/active/${idStr}`, { method: 'POST' });
      if (res.ok) {
        setActivePriceListId(idStr);
        localStorage.setItem('activePriceListId', idStr);
        showToast('success', 'Switched Price Book.');
        viewerRef.current?.reload();
        loadDropdownOptions(idStr);
      }
    } catch (err) {
      showToast('error', 'Failed to switch Price Book.');
    }
  };

  const triggerCreatePriceList = () => {
    setPromptState({
      isOpen: true,
      title: 'Create New Price Book',
      message: 'Enter a name for the new client or vendor Price Book:',
      placeholder: 'e.g. Optus Wireless V4',
      value: '',
      onSubmit: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
          const res = await fetch('http://localhost:8000/api/price-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          });
          if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.detail || 'Failed to create.');
          }
          const data = await res.json();
          showToast('success', `Price Book "${trimmed}" created.`);
          await loadPriceLists();
          handlePriceListChange(String(data.id));
        } catch (err: any) {
          showToast('error', err.message || 'Failed to create Price Book.');
        } finally {
          setPromptState(null);
        }
      }
    });
  };

  const handleDeletePriceList = () => {
    const currentBook = priceLists.find(p => String(p.id) === activePriceListId);
    if (!currentBook) return;
    
    if (priceLists.length <= 1) {
      showToast('error', 'Cannot delete the last remaining Price Book.');
      return;
    }
    
    setConfirmState({
      isOpen: true,
      title: 'Delete Price Book',
      message: `Are you sure you want to delete the Price Book "${currentBook.name}"? This will permanently delete all its items and comments. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/price-lists/${activePriceListId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete.');
          showToast('success', `Price Book deleted.`);
          await loadPriceLists();
        } catch (err) {
          showToast('error', 'Failed to delete Price Book.');
        } finally {
          setConfirmState(null);
        }
      }
    });
  };

  const handleDownloadTemplate = () => {
    window.location.href = 'http://localhost:8000/api/price-list/template';
  };

  const handleDownloadCurrentBook = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/price-list/file?price_list_id=${activePriceListId}`);
      if (!res.ok) throw new Error('Failed to fetch file.');
      const data = await res.json();
      
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', data.filename || 'active_price_book.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('success', 'Current Price Book downloaded successfully.');
    } catch (err) {
      showToast('error', 'Failed to download current Price Book.');
    }
  };

  const handleClearAllPriceBookItems = () => {
    const currentBook = priceLists.find(p => String(p.id) === activePriceListId);
    if (!currentBook) return;
    
    setConfirmState({
      isOpen: true,
      title: 'Clear Price Book Items',
      message: `Are you sure you want to clear/wipe ALL items inside the Price Book "${currentBook.name}"? This will permanently delete all records. This cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/price-list/clear?price_list_id=${activePriceListId}`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed to clear.');
          showToast('success', `All items in Price Book cleared.`);
          viewerRef.current?.reload();
        } catch (err) {
          showToast('error', 'Failed to clear Price Book.');
        } finally {
          setConfirmState(null);
        }
      }
    });
  };

  const handleRenamePriceList = () => {
    const currentBook = priceLists.find(p => String(p.id) === activePriceListId);
    if (!currentBook) return;

    setPromptState({
      isOpen: true,
      title: 'Rename Price Book',
      message: `Enter new name for Price Book "${currentBook.name}":`,
      placeholder: 'e.g. Optus Wireless Book',
      value: currentBook.name,
      onSubmit: async (newName) => {
        if (!newName.trim() || newName.trim() === currentBook.name) return;
        try {
          const res = await fetch(`http://localhost:8000/api/price-lists/${activePriceListId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || 'Failed to rename.');
          }
          showToast('success', 'Price Book renamed successfully.');
          await loadPriceLists();
        } catch (err: any) {
          showToast('error', err.message || 'Error renaming Price Book.');
        }
      }
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    const currentBook = priceLists.find(p => String(p.id) === activePriceListId);
    const bookName = currentBook ? currentBook.name : 'active';
    
    setConfirmState({
      isOpen: true,
      title: 'Import Price List',
      message: `Warning: Importing a new spreadsheet will replace all items and comments currently in the Price Book "${bookName}". This cannot be undone. Do you want to proceed?`,
      onConfirm: async () => {
        setConfirmState(null);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const res = await fetch(`http://localhost:8000/api/price-list/import?price_list_id=${activePriceListId}`, {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.detail || 'Import failed.');
          }
          showToast('success', 'Price Book successfully imported!');
          viewerRef.current?.reload();
        } catch (err: any) {
          showToast('error', err.message || 'Failed to import Price Book.');
        } finally {
          e.target.value = '';
        }
      }
    });
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (type === 'success') {
      sonnerToast.success(message);
    } else {
      sonnerToast.error(message);
    }
    setTimeout(() => setToast(null), 4000);
  };

  const handleResetEstimates = () => {
    setConfirmState({
      isOpen: true,
      title: 'Reset All Estimates',
      message: 'Are you sure you want to reset all quantities and comments to blank?',
      onConfirm: () => {
        const endpoint = viewMode === 'pricelist' ? 'price-list' : 'boq-items';
        fetch(`http://localhost:8000/api/${endpoint}/clear-quantities?price_list_id=${activePriceListId}`, { method: 'POST' })
          .then((res) => {
            if (!res.ok) throw new Error('Failed to reset estimates.');
            return res.json();
          })
          .then(() => {
            showToast('success', 'Estimates reset successfully.');
            setViewerError(null);
            viewerRef.current?.reload();
          })
          .catch((err) => {
            console.error(err);
            showToast('error', err.message || 'Error resetting estimates.');
          });
      }
    });
  };

  const handleOpenAddModal = () => {
    loadDropdownOptions();
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormUnit('EA');
    setFormRate('');
    setFormCategory('Antennas & RRUs');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    loadDropdownOptions();
    setEditingItem(item);
    setFormCode(item.code || '');
    setFormName(item.name || item.header || '');
    const unitUpper = (item.unit || 'EA').toUpperCase();
    setFormUnit(DEFAULT_UNITS.includes(unitUpper) ? unitUpper : (item.unit || 'EA'));
    setFormRate(item.rate !== undefined ? item.rate.toString() : '');
    setFormCategory(item.category || item.type || 'Antennas & RRUs');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('error', 'Item description name is required.');
      return;
    }
    const rateVal = parseFloat(formRate);
    if (isNaN(rateVal) || rateVal < 0) {
      showToast('error', 'Please enter a valid positive rate value.');
      return;
    }

    const payload = {
      code: formCode.trim(),
      name: formName.trim(),
      unit: formUnit.trim(),
      rate: rateVal,
      category: formCategory.trim() || 'General SOR Pricing Items',
    };

    const url = editingItem
      ? `http://localhost:8000/api/price-list/${editingItem.row_idx}?price_list_id=${activePriceListId}`
      : `http://localhost:8000/api/price-list?price_list_id=${activePriceListId}`;

    const method = editingItem ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to save item.');
        return res.json();
      })
      .then(() => {
        showToast('success', editingItem ? 'SOR item updated.' : 'New SOR item created.');
        setIsModalOpen(false);
        setViewerError(null);
        viewerRef.current?.reload();
      })
      .catch((err) => {
        console.error(err);
        showToast('error', err.message || 'Failed to save SOR item.');
      });
  };

  const handleDownloadWorkbook = (onlyPriced: boolean = false) => {
    fetch(`http://localhost:8000/api/export-priced-excel?price_list_id=${activePriceListId}&only_priced=${onlyPriced}`, {
      method: 'POST',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to download Excel.');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', onlyPriced ? 'Priced_BOQ_Only.xlsx' : 'Priced_BOQ_Full.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('success', 'Excel BOQ downloaded successfully.');
      })
      .catch((err) => {
        console.error(err);
        showToast('error', 'Error downloading Excel workbook.');
      });
  };

  // KPI Calculations from active session data
  const { mapped_items = [], checklist = [] } = analyzedData || {};
  const totalCost = mapped_items.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0);
  const totalItems = mapped_items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  const warningCount = checklist.filter((c: any) => c.status === 'WARNING').length;

  if (analyzing) {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-bg-app select-none">
        <div className="animate-pulse bg-bg-panel border border-border-color rounded-none p-4 h-[350px] mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-bg-panel border border-border-color rounded-none p-4 h-24" />
          ))}
        </div>
        <div className="flex-1 grid grid-cols-12 gap-6">
          <div className="col-span-4 animate-pulse bg-bg-panel border border-border-color rounded-none p-4 h-[250px]" />
          <div className="col-span-8 animate-pulse bg-bg-panel border border-border-color rounded-none p-4 h-[250px]" />
        </div>
      </div>
    );
  }

  const hasActiveProject = Boolean(pdfName);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-background select-none min-h-0 text-foreground animate-fadeIn gap-4 overflow-hidden font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-slideIn ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'check' : 'warning'} size={14} />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-normal tracking-tight text-foreground">
            {viewMode === 'pricelist' ? 'Master Price Catalog' : 'Bill of Quantities (BOQ)'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            {viewMode === 'pricelist'
              ? 'Manage standard schedule of rates, unit pricings, and rate books.'
              : 'Review, price, and export construction takeoff schedule items.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'pricelist' && (
            <div className="flex items-center gap-1">
              {/* Book Selector Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 gap-1.5 cursor-pointer shadow-xs">
                    <BookOpenIcon className="size-3.5 text-muted-foreground" />
                    <span>Book: {priceLists.find((p) => String(p.id) === String(activePriceListId))?.name || 'Default'}</span>
                    <ChevronDownIcon className="size-3 text-muted-foreground ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal px-2 py-1">
                    Select Price Book
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {priceLists.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handlePriceListChange(String(p.id))}
                      className="flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span>{p.name}</span>
                      {String(p.id) === String(activePriceListId) && <CheckIcon className="size-3.5 ml-2 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handlePriceListChange('CREATE_NEW_BOOK')}
                    className="text-primary font-medium cursor-pointer"
                  >
                    <PlusIcon className="size-3.5 mr-1.5" />
                    <span>Create New Book</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {priceLists.length > 1 && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={handleDeletePriceList}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer shadow-xs"
                  title="Delete Current Price Book"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleRenamePriceList}
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer shadow-xs"
                title="Rename Current Price Book"
              >
                <EditIcon className="size-3.5" />
              </Button>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleClearAllPriceBookItems}
                className="h-8 w-8 text-amber-500 hover:bg-amber-500/10 cursor-pointer shadow-xs"
                title="Wipe/Clear All Items inside Price Book"
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>

              {/* Template Download Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 gap-1.5 cursor-pointer shadow-xs">
                    <DownloadIcon className="size-3.5 text-muted-foreground" />
                    <span>Templates</span>
                    <ChevronDownIcon className="size-3 text-muted-foreground ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 text-xs">
                  <DropdownMenuItem onClick={handleDownloadTemplate} className="cursor-pointer">
                    <FileSpreadsheetIcon className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Blank Template (.xlsx)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadCurrentBook} className="cursor-pointer">
                    <FileSpreadsheetIcon className="size-3.5 mr-2 text-primary" />
                    <span>Current Price Book (.xlsx)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                className="h-8 text-xs px-2.5 gap-1.5 cursor-pointer shadow-xs"
                title="Import Excel Price List"
              >
                <UploadIcon className="size-3.5 text-muted-foreground" />
                <span>Import Excel</span>
              </Button>
              <input
                type="file"
                ref={importInputRef}
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </div>
          )}

          {/* Add Item Button */}
          <Button
            size="sm"
            onClick={handleOpenAddModal}
            disabled={!hasFile}
            className="h-8 px-3 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 font-medium rounded-lg"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Item</span>
          </Button>

          {viewMode !== 'pricelist' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetEstimates}
                disabled={!hasFile}
                className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-2xs rounded-lg border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <RotateCcwIcon className="size-3.5 text-muted-foreground" />
                <span>Reset Estimates</span>
              </Button>

              {/* Download Excel Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={!hasFile}
                    className="h-8 px-3 text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs font-medium rounded-lg"
                  >
                    <FileSpreadsheetIcon className="size-3.5" />
                    <span>Export Excel BOQ</span>
                    <ChevronDownIcon className="size-3 ml-0.5 opacity-80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuItem onClick={() => handleDownloadWorkbook(false)} className="cursor-pointer">
                    <FileSpreadsheetIcon className="size-3.5 mr-2 text-emerald-500" />
                    <span>Full BOQ Workbook</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadWorkbook(true)} className="cursor-pointer">
                    <CheckIcon className="size-3.5 mr-2 text-emerald-500" />
                    <span>Priced Items Only (Qty &gt; 0)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Sheet Viewer Container */}
      <div className="flex-1 w-full min-h-0 overflow-hidden flex flex-col">
        {viewerError ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
            <Icon name="warning" size={20} className="text-red-500" />
            <p className="text-xs text-text-secondary font-semibold">{viewerError}</p>
            <button
              onClick={() => { setViewerError(null); viewerRef.current?.reload(); }}
              className="px-3 py-1.5 text-[11px] bg-bg-panel border border-border-color rounded text-text-primary hover:bg-bg-app transition-all cursor-pointer font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <UniversViewer
            ref={viewerRef}
            onReady={() => setHasFile(true)}
            onNoFile={() => setHasFile(false)}
            onError={(msg) => setViewerError(msg)}
            onEditItem={handleOpenEditModal}
            onNavigateToPage={onNavigateToPage}
            activePriceListId={activePriceListId}
            hasActiveProject={hasActiveProject}
            viewMode={viewMode}
            onCategoryOptionsLoaded={(cats, units) => {
              setExistingCategories(cats);
              setExistingUnits(units);
            }}
          />
        )}
      </div>


      {/* Add / Edit Item Shadcn Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingItem ? 'Edit Pricing Item' : 'Add New Item'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingItem
                ? 'Update rate, description, unit, and section classification.'
                : 'Add a new schedule item to the master workbook.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">SOR Code (Optional)</Label>
              <Input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. 1010-05"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">Item Description *</Label>
              <Textarea
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Remote Radio Unit (RRU) Tower Mount"
                rows={2}
                className="text-xs min-h-16 resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select unit..." />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectGroup>
                      {Array.from(new Set([...existingUnits, formUnit])).filter(Boolean).map((u) => (
                        <SelectItem key={u} value={u} className="text-xs">
                          {u}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-foreground">Rate ($ Excl. GST) *</Label>
                <Input
                  type="text"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="e.g. 450.00"
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">Category / Section</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectGroup>
                    {Array.from(new Set([...existingCategories, formCategory])).filter(Boolean).map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
                className="text-xs cursor-pointer bg-primary text-primary-foreground"
              >
                {editingItem ? 'Save Changes' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Prompt Dialog */}
      <Dialog open={Boolean(promptState?.isOpen)} onOpenChange={(open) => { if (!open) setPromptState(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{promptState?.title}</DialogTitle>
            <DialogDescription className="text-xs">{promptState?.message}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="text"
              value={promptState?.value || ''}
              onChange={(e) => setPromptState((prev) => (prev ? { ...prev, value: e.target.value } : null))}
              placeholder={promptState?.placeholder}
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptState) {
                  promptState.onSubmit(promptState.value);
                  setPromptState(null);
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPromptState(null)}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (promptState) {
                  promptState.onSubmit(promptState.value);
                  setPromptState(null);
                }
              }}
              className="text-xs cursor-pointer bg-primary text-primary-foreground"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={Boolean(confirmState?.isOpen)} onOpenChange={(open) => { if (!open) setConfirmState(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-destructive">{confirmState?.title}</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">{confirmState?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmState(null)}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirmState) {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }
              }}
              className="text-xs cursor-pointer"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
