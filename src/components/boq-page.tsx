import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { OverviewDashboard } from '@/components/dashboard/OverviewDashboard';
import { BOQDashboard } from '@/components/dashboard/BOQDashboard';
import { MappingRulesViewer } from '@/components/rules/MappingRulesViewer';
import { EquipmentCatalogViewer } from '@/components/equipment/EquipmentCatalogViewer';
import { SettingsView } from '@/components/layout/SettingsView';
import { toast } from 'sonner';
import { saveWorkspaceToStorage, loadWorkspaceFromStorage } from '@/services/storage';

export interface PDFDoc {
  name: string;
  path: string;
  base64: string;
  currentPage: number;
  totalPages: number;
}

export function BoqPage({ onLogout }: { onLogout?: () => void }) {
  const [activeTab, setActiveTab] = useState<string>('documents');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('strelza-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  // Documents & Workspace state
  const [openPdfs, setOpenPdfs] = useState<PDFDoc[]>([]);
  const [activePdfIndex, setActivePdfIndex] = useState<number>(0);
  const activePdf = activePdfIndex >= 0 && activePdfIndex < openPdfs.length ? openPdfs[activePdfIndex] : null;

  // Extraction & Analysis state
  const [analyzedData, setAnalyzedData] = useState<any>(null);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractingPage, setExtractingPage] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // UI markup state
  const [markups, setMarkups] = useState<any[]>([]);
  const [highlightedBbox, setHighlightedBbox] = useState<[number, number, number, number] | null>(null);
  const [geminiRateLimit, setGeminiRateLimit] = useState<number>(15);

  // Auto-save & session persistence state
  const [isRestored, setIsRestored] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Restore workspace session on initial mount
  useEffect(() => {
    loadWorkspaceFromStorage().then((saved) => {
      if (saved && saved.openPdfs && saved.openPdfs.length > 0) {
        setOpenPdfs(saved.openPdfs);
        if (typeof saved.activePdfIndex === 'number') setActivePdfIndex(saved.activePdfIndex);
        if (saved.analyzedData) setAnalyzedData(saved.analyzedData);
        if (saved.markups) setMarkups(saved.markups);
        if (saved.activeTab) setActiveTab(saved.activeTab);
      }
      setIsRestored(true);
    });
  }, []);

  // Auto-save workspace on changes (debounced by 800ms)
  useEffect(() => {
    if (!isRestored) return;
    if (openPdfs.length === 0 && !analyzedData && markups.length === 0) return;

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      const workspacePayload = {
        openPdfs,
        activePdfIndex,
        analyzedData,
        markups,
        activeTab,
        savedAt: new Date().toISOString(),
      };
      await saveWorkspaceToStorage(workspacePayload);
      setAutoSaveStatus('saved');
    }, 800);

    return () => clearTimeout(timer);
  }, [openPdfs, activePdfIndex, analyzedData, markups, activeTab, isRestored]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('strelza-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectPDF = (index: number) => {
    setActivePdfIndex(index);
    setActiveTab('documents');
  };

  const handleClosePDF = (index: number) => {
    setOpenPdfs((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (activePdfIndex >= next.length) {
        setActivePdfIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleLoadPDF = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      // Try uploading to Python backend for sanitization & rendering
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('http://localhost:8000/api/pdf/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const newDoc: PDFDoc = {
            name: data.name || file.name,
            path: data.path || file.name,
            base64: data.base64,
            currentPage: 1,
            totalPages: parseInt(data.pages, 10) || 1,
          };
          setOpenPdfs((prev) => [...prev, newDoc]);
          setActivePdfIndex(openPdfs.length);
          setActiveTab('documents');
          return;
        }
      } catch (err) {
        console.warn('Backend upload unavailable, using client-side reader:', err);
      }

      // Fallback to client-side FileReader
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        const newDoc: PDFDoc = {
          name: file.name,
          path: file.name,
          base64: base64,
          currentPage: 1,
          totalPages: 1,
        };
        setOpenPdfs((prev) => [...prev, newDoc]);
        setActivePdfIndex(openPdfs.length);
        setActiveTab('documents');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleStartExtraction = async (pages?: number[]) => {
    if (!activePdf) return;
    setExtracting(true);
    setAnalysisError(null);
    try {
      const res = await fetch('http://localhost:8000/api/pdf/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activePdf.path,
          name: activePdf.name,
          base64: activePdf.base64,
          pages: pages && pages.length > 0 ? pages : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`Docling extraction failed with status: ${res.statusText}`);
      }
      const data = await res.json();
      setAnalyzedData(data);
    } catch (err: any) {
      console.error('Docling extraction error:', err);
      setAnalysisError(err.message || 'Docling extraction error');
    } finally {
      setExtracting(false);
    }
  };

  const handleReextractPage = async (page: number) => {
    if (!activePdf) return;
    setExtractingPage(true);
    try {
      const res = await fetch('http://localhost:8000/api/pdf/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activePdf.path,
          name: activePdf.name,
          base64: activePdf.base64,
          pages: [page],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyzedData((prev: any) => {
          if (!prev) return data;
          const otherElements = (prev.elements || []).filter((el: any) => el.page !== page);
          return {
            ...prev,
            elements: [...otherElements, ...(data.elements || [])],
          };
        });
      }
    } catch (err) {
      console.error('Reextract page error:', err);
    } finally {
      setExtractingPage(false);
    }
  };

  const handleSaveProject = async () => {
    if (openPdfs.length === 0) {
      toast.error('No drawings open to save in project.');
      return;
    }

    const defaultName = activePdf
      ? activePdf.name.replace(/\.[^/.]+$/, '').replace(/_cleaned$/, '')
      : 'Strelza_Project';
    const filename = `${defaultName}_${Date.now()}.slz`;

    const projectData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      openPdfs,
      activePdfIndex,
      activeTab,
      markups,
      analyzedData,
    };

    try {
      // Stream compressed .slz from Python backend
      const res = await fetch('http://localhost:8000/api/project/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          project_data: projectData,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Project saved as ${filename}`);
        return;
      }
    } catch (e) {
      console.warn('Backend download unavailable, using client-side fallback:', e);
    }

    // Client-side JSON fallback
    const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${defaultName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Project saved as JSON file.');
  };

  const handleOpenProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.slz,.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      if (file.name.endsWith('.slz')) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('http://localhost:8000/api/project/load-file', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            const proj = data.project_data || {};
            if (proj.openPdfs) setOpenPdfs(proj.openPdfs);
            if (typeof proj.activePdfIndex === 'number') setActivePdfIndex(proj.activePdfIndex);
            if (proj.markups) setMarkups(proj.markups);
            if (proj.analyzedData) setAnalyzedData(proj.analyzedData);
            setActiveTab('documents');
            toast.success(`Project ${file.name} loaded successfully!`);
            return;
          }
        } catch (err) {
          console.error('Error loading .slz project:', err);
        }
      }

      // JSON project loader
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.openPdfs) setOpenPdfs(parsed.openPdfs);
          if (typeof parsed.activePdfIndex === 'number') setActivePdfIndex(parsed.activePdfIndex);
          if (parsed.markups) setMarkups(parsed.markups);
          if (parsed.analyzedData) setAnalyzedData(parsed.analyzedData);
          setActiveTab('documents');
          toast.success(`Project ${file.name} loaded successfully!`);
        } catch (err) {
          console.error('Error parsing project file:', err);
          toast.error('Failed to parse project file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const updateActivePdfField = (field: keyof PDFDoc, value: any) => {
    if (activePdfIndex < 0) return;
    setOpenPdfs((prev) =>
      prev.map((doc, idx) => (idx === activePdfIndex ? { ...doc, [field]: value } : doc))
    );
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onSignOut={onLogout}
      />
      <SidebarInset className="flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TopBar: Microsoft Edge-style browser tabs & sidebar trigger */}
        <header className="flex flex-col z-50 shrink-0">
          <TopBar
            openPdfs={openPdfs}
            activePdfIndex={activePdfIndex}
            activeTab={activeTab}
            onSelectPDF={handleSelectPDF}
            onClosePDF={handleClosePDF}
            onLoadPDF={handleLoadPDF}
            onSaveProject={handleSaveProject}
            onOpenProject={handleOpenProject}
            onSignOut={onLogout}
            autoSaveStatus={autoSaveStatus}
          />
        </header>

        {/* Viewport Dynamic Content Area */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-background">
          {activeTab === 'documents' ? (
            <PDFViewer
              pdfBase64={activePdf?.base64 || ''}
              pdfName={activePdf?.name}
              currentPage={activePdf?.currentPage || 1}
              setCurrentPage={(page: number) => updateActivePdfField('currentPage', page)}
              totalPages={activePdf?.totalPages || 1}
              onDocumentLoad={(pages: number) => updateActivePdfField('totalPages', pages)}
              onLoadPDF={handleLoadPDF}
              analyzedData={analyzedData}
              analyzing={extracting}
              analysisError={analysisError}
              isMaximized={false}
              onGenerateBOQ={() => setActiveTab('boq')}
              onViewDashboard={() => setActiveTab('dashboard')}
              extractedData={analyzedData}
              extracting={extracting}
              onStartExtraction={handleStartExtraction}
              onReextractPage={handleReextractPage}
              extractingPage={extractingPage}
              highlightedBbox={highlightedBbox}
              onHighlightBbox={setHighlightedBbox}
              markups={markups}
              onAddMarkup={(m: any) => setMarkups((prev) => [...prev, m])}
              onDeleteMarkup={(id: string) => setMarkups((prev) => prev.filter((m) => m.id !== id))}
              onClearPageMarkups={(page: number) => setMarkups((prev) => prev.filter((m) => m.page !== page))}
              onUndoMarkup={() => { }}
              onRedoMarkup={() => { }}
              canUndoMarkup={false}
              canRedoMarkup={false}
            />
          ) : activeTab === 'settings' ? (
            <SettingsView
              theme={theme}
              geminiRateLimit={geminiRateLimit}
              handleUpdateDefaultTheme={(t: 'light' | 'dark') => setTheme(t)}
              handleUpdateRateLimit={setGeminiRateLimit}
              handleClearCache={() => { }}
              clearingCache={false}
              cacheClearStatus={null}
              onCancel={() => setActiveTab('dashboard')}
            />
          ) : activeTab === 'rules' ? (
            <MappingRulesViewer />
          ) : activeTab === 'equipment' ? (
            <EquipmentCatalogViewer />
          ) : activeTab === 'dashboard' ? (
            <OverviewDashboard
              pdfName={activePdf?.name}
              analyzedData={analyzedData}
              analyzing={extracting}
              onLoadPDF={handleLoadPDF}
              onGenerateBOQ={() => setActiveTab('boq')}
              onTabChange={setActiveTab}
              extractedData={analyzedData}
              extracting={extracting}
              onStartExtraction={handleStartExtraction}
            />
          ) : activeTab === 'boq' || activeTab === 'pricelist' ? (
            <BOQDashboard
              viewMode={activeTab === 'pricelist' ? 'pricelist' : 'boq'}
              pdfName={activePdf?.name}
              analyzedData={analyzedData}
              analyzing={extracting}
              onLoadPDF={handleLoadPDF}
              onNavigateToPage={(page) => {
                setActiveTab('documents');
                updateActivePdfField('currentPage', page);
              }}
            />
          ) : (
            <OverviewDashboard
              pdfName={activePdf?.name}
              analyzedData={analyzedData}
              analyzing={extracting}
              onLoadPDF={handleLoadPDF}
              onGenerateBOQ={() => setActiveTab('boq')}
              onTabChange={setActiveTab}
              extractedData={analyzedData}
              extracting={extracting}
              onStartExtraction={handleStartExtraction}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default BoqPage;
