import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';
import { KPICards } from './KPICards';
import { ComplianceChecks } from './ComplianceChecks';
import { UniversViewer, type UniversViewerRef } from './UniversViewer';

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
  const [formUnit, setFormUnit] = useState('each');
  const [formRate, setFormRate] = useState('');
  const [formCategory, setFormCategory] = useState('');

  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingUnits, setExistingUnits] = useState<string[]>([]);

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
          loadDropdownOptions(String(active.id));
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
    setFormUnit('each');
    setFormRate('');
    setFormCategory('General SOR Pricing Items');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    loadDropdownOptions();
    setEditingItem(item);
    setFormCode(item.code || '');
    setFormName(item.name || '');
    setFormUnit(item.unit || 'each');
    setFormRate(item.rate !== undefined ? item.rate.toString() : '');
    setFormCategory(item.category || 'General SOR Pricing Items');
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
    <div className="flex-1 flex flex-col p-6 bg-bg-app select-none min-h-0 text-text-primary animate-fadeIn gap-6 overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-none border shadow-lg animate-slideIn ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'check' : 'warning'} size={14} />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Row */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-base font-bold font-display tracking-tight flex items-center gap-2 text-text-primary">
            <Icon name={viewMode === 'pricelist' ? 'price-list' : 'file-text'} size={16} className="text-accent-blue" />
            <span>{viewMode === 'pricelist' ? 'Master Price List' : 'Bill of Quantities (BOQ)'}</span>
          </h2>
          <p className="text-[10px] text-text-muted mt-0.5 font-semibold">
            {viewMode === 'pricelist'
              ? 'Manage standard pricing catalog, templates, and reference rates.'
              : hasActiveProject ? `Active PDF Drawing: ${pdfName}` : 'No Active Project / Drawing Loaded'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'pricelist' && (
            <div className="flex items-center gap-2 border border-border-color bg-bg-panel px-2.5 py-1 rounded-lg shadow-sm">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Book:</span>
              <select
                value={activePriceListId}
                onChange={(e) => handlePriceListChange(e.target.value)}
                className="bg-transparent text-xs text-text-primary font-semibold outline-none border-0 pr-6 py-0.5 cursor-pointer"
              >
                {priceLists.map((p) => (
                  <option key={p.id} value={String(p.id)} className="bg-bg-panel text-text-primary">
                    {p.name}
                  </option>
                ))}
                <option value="CREATE_NEW_BOOK" className="text-accent-blue font-bold">
                  + Create New Book
                </option>
              </select>
              
              {priceLists.length > 1 && (
                <button
                  onClick={handleDeletePriceList}
                  className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                  title="Delete Current Price Book"
                >
                  <Icon name="trash" size={12} />
                </button>
              )}

              <button
                onClick={handleRenamePriceList}
                className="p-1 hover:bg-accent-blue/10 text-accent-blue rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                title="Rename Current Price Book"
              >
                <Icon name="edit" size={12} />
              </button>

              <button
                onClick={handleClearAllPriceBookItems}
                className="p-1 hover:bg-yellow-500/10 text-yellow-500 rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                title="Wipe/Clear All Items inside Price Book"
              >
                <Icon name="close" size={12} />
              </button>

              <div className="w-px h-4 bg-border-color mx-1 shrink-0" />

              {/* Template Download Dropdown */}
              <div ref={templateContainerRef} className="relative">
                <button
                  onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                  className="p-1 hover:bg-bg-app text-text-secondary hover:text-text-primary rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                  title="Download Template Options"
                >
                  <Icon name="download" size={13} />
                </button>

                {isTemplateDropdownOpen && (
                  <div className="absolute left-0 mt-2 z-50 bg-bg-panel border border-[#d0d7de] p-1.5 rounded-lg shadow-xl w-48 flex flex-col gap-1 select-none text-[11px] font-semibold text-text-secondary">
                    <button
                      onClick={() => {
                        setIsTemplateDropdownOpen(false);
                        handleDownloadTemplate();
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-bg-app hover:text-text-primary rounded-md border-0 bg-transparent text-left cursor-pointer transition-colors"
                    >
                      <span>Blank Template (.xlsx)</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsTemplateDropdownOpen(false);
                        handleDownloadCurrentBook();
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-bg-app hover:text-text-primary rounded-md border-0 bg-transparent text-left cursor-pointer transition-colors"
                    >
                      <span>Current Price Book (.xlsx)</span>
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => importInputRef.current?.click()}
                className="p-1 hover:bg-bg-app text-text-secondary hover:text-text-primary rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                title="Import Excel Price List"
              >
                <Icon name="upload" size={13} />
              </button>

              <input
                type="file"
                ref={importInputRef}
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </div>
          )}

          <button
            onClick={handleOpenAddModal}
            disabled={!hasFile}
            className="bg-accent-blue hover:bg-accent-blue-hover text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center transition-all cursor-pointer shadow border-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Add Item</span>
          </button>
          
          {viewMode !== 'pricelist' && (
            <>
              <button
                onClick={handleResetEstimates}
                disabled={!hasFile}
                className="border border-border-color bg-bg-panel hover:bg-bg-app text-text-secondary px-3 py-1.5 rounded text-xs font-semibold flex items-center transition-all cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Reset Estimates</span>
              </button>
              
              {/* Download Excel Dropdown */}
              <div ref={downloadContainerRef} className="relative">
                <button
                  onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                  disabled={!hasFile}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed border-0"
                >
                  <span>Download Excel BOQ</span>
                  <Icon name="chevron-down" size={10} className="text-white" />
                </button>

                {isDownloadDropdownOpen && (
                  <div className="absolute right-0 mt-1 z-[100] bg-bg-panel border border-border-color p-1 shadow-xl w-48 flex flex-col gap-0.5 animate-fadeIn">
                    <button
                      onClick={() => {
                        setIsDownloadDropdownOpen(false);
                        handleDownloadWorkbook(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-app transition-colors cursor-pointer bg-transparent border-0"
                    >
                      Full BOQ Workbook
                    </button>
                    <button
                      onClick={() => {
                        setIsDownloadDropdownOpen(false);
                        handleDownloadWorkbook(true);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-text-secondary hover:text-emerald-500 hover:bg-bg-app transition-colors cursor-pointer bg-transparent border-0"
                    >
                      Priced Items Only (Qty &gt; 0)
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sheet Viewer Container */}
      <div className="flex-1 w-full bg-bg-panel relative flex flex-col min-h-0">
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
          />
        )}
      </div>


      {/* Form Modals Transplanted from PriceListDashboard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bg-panel border border-border-color w-full max-w-md p-6 shadow-2xl relative flex flex-col gap-4">
            <h3 className="text-xs font-bold text-text-primary border-b border-border-color pb-2 uppercase tracking-wider">
              {editingItem ? 'Edit SOR Pricing Item' : 'Add New SOR Pricing Item'}
            </h3>
            
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">SOR Code (Optional)</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. W7893"
                  className="w-full h-8 bg-bg-app border border-border-color px-3 text-xs text-text-secondary focus:border-accent-blue outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Item Name / Description</label>
                <textarea
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Tower Mounted Device Installation"
                  rows={2}
                  className="w-full bg-bg-app border border-border-color p-2 text-xs text-text-secondary focus:border-accent-blue outline-none resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Unit</label>
                  <ShadcnSelect
                    value={formUnit}
                    onChange={setFormUnit}
                    options={existingUnits}
                    placeholder="Select unit..."
                    addNewText="➕ Add custom unit..."
                    onAddNew={() => {
                      setPromptState({
                        isOpen: true,
                        title: 'Add Custom Unit',
                        message: 'Enter new unit name (e.g. meter, lot, each):',
                        placeholder: 'e.g. meter',
                        value: '',
                        onSubmit: (newUnit) => {
                          if (newUnit.trim()) {
                            const cleanUnit = newUnit.trim().toLowerCase();
                            if (!existingUnits.includes(cleanUnit)) {
                              setExistingUnits(prev => [...prev, cleanUnit].sort());
                            }
                            setFormUnit(cleanUnit);
                          }
                        }
                      });
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Rate (Excl. GST)</label>
                  <input
                    type="text"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="e.g. 400.00"
                    className="w-full h-8 bg-bg-app border border-border-color px-3 text-xs text-text-secondary focus:border-accent-blue outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Category / Section</label>
                <ShadcnSelect
                  value={formCategory}
                  onChange={setFormCategory}
                  options={existingCategories}
                  placeholder="Select category..."
                  addNewText="➕ Add custom category..."
                  onAddNew={() => {
                    setPromptState({
                      isOpen: true,
                      title: 'Add Custom Category',
                      message: 'Enter new category name:',
                      placeholder: 'e.g. MOBILES - SMR and INTEGRATION',
                      value: '',
                      onSubmit: (newCat) => {
                        if (newCat.trim()) {
                          const cleanCat = newCat.trim();
                          if (!existingCategories.includes(cleanCat)) {
                            setExistingCategories(prev => [...prev, cleanCat].sort());
                          }
                          setFormCategory(cleanCat);
                        }
                      }
                    });
                  }}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-border-color pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary hover:bg-bg-app transition-colors text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors text-xs font-semibold cursor-pointer border-0"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {promptState?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bg-panel border border-border-color w-full max-w-sm p-5 rounded-lg shadow-2xl flex flex-col gap-4 animate-scaleUp">
            <div>
              <h4 className="text-sm font-bold font-display text-text-primary">{promptState.title}</h4>
              <p className="text-[11px] text-text-muted mt-1 font-medium">{promptState.message}</p>
            </div>
            <input
              type="text"
              value={promptState.value}
              onChange={(e) => setPromptState(prev => prev ? { ...prev, value: e.target.value } : null)}
              placeholder={promptState.placeholder}
              className="w-full h-8 bg-bg-app border border-border-color rounded-md px-3 text-xs text-text-secondary focus:border-accent-blue outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  promptState.onSubmit(promptState.value);
                  setPromptState(null);
                }
              }}
            />
            <div className="flex justify-end gap-3 border-t border-border-color pt-3">
              <button
                type="button"
                onClick={() => setPromptState(null)}
                className="px-3.5 py-1.5 border border-border-color text-text-secondary hover:bg-bg-app transition-colors text-xs font-semibold rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  promptState.onSubmit(promptState.value);
                  setPromptState(null);
                }}
                className="px-3.5 py-1.5 bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors text-xs font-semibold rounded-md cursor-pointer border-0"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bg-panel border border-border-color w-full max-w-sm p-5 rounded-lg shadow-2xl flex flex-col gap-4 animate-scaleUp">
            <div>
              <h4 className="text-sm font-bold font-display text-text-primary">{confirmState.title}</h4>
              <p className="text-[11px] text-text-secondary mt-1.5 font-medium leading-relaxed">{confirmState.message}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-border-color pt-3">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-3.5 py-1.5 border border-border-color text-text-secondary hover:bg-bg-app transition-colors text-xs font-semibold rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className="px-3.5 py-1.5 bg-red-500 text-white hover:bg-red-650 transition-colors text-xs font-semibold rounded-md cursor-pointer border-0"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
