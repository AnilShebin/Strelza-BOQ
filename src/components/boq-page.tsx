import React, { useState, useEffect } from 'react';
import { TopBar } from './layout/TopBar';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { PDFViewer } from './pdf/PDFViewer';
import { BOQDashboard } from './dashboard/BOQDashboard';
import { OverviewDashboard } from './dashboard/OverviewDashboard';
import { SettingsView } from './layout/SettingsView';
import { MappingRulesViewer } from './rules/MappingRulesViewer';
import { EquipmentCatalogViewer } from './equipment/EquipmentCatalogViewer';
import { Icon } from './common/Icon';

interface PDFDoc {
  name: string;
  path: string;
  base64: string;
  currentPage: number;
  totalPages: number;
}

interface BoqPageProps {
  onLogout: () => void;
}

export function BoqPage({ onLogout }: BoqPageProps) {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('strelza-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  // Documents & Workspace state
  const [openPdfs, setOpenPdfs] = useState<PDFDoc[]>([
    {
      name: 'Sample_Office_BOQ.pdf',
      path: '/sample.pdf',
      base64: '',
      currentPage: 1,
      totalPages: 12,
    },
    {
      name: 'Electrical_Specifications_Rev2.pdf',
      path: '/electrical.pdf',
      base64: '',
      currentPage: 1,
      totalPages: 8,
    },
  ]);
  const [activePdfIndex, setActivePdfIndex] = useState<number>(0);
  const activePdf = activePdfIndex >= 0 && activePdfIndex < openPdfs.length ? openPdfs[activePdfIndex] : null;

  // Mock UI state
  const [markups, setMarkups] = useState<any[]>([]);
  const [highlightedBbox, setHighlightedBbox] = useState<[number, number, number, number] | null>(null);
  const [geminiRateLimit, setGeminiRateLimit] = useState<number>(15);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('strelza-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectPDF = (index: number) => {
    setActivePdfIndex(index);
    setActiveTab('documents');
  };

  const handleClosePDF = (index: number) => {
    setOpenPdfs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (activePdfIndex >= next.length) {
        setActivePdfIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleLoadPDF = () => {
    // Pure Web File input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

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

  const handleSaveProject = () => {
    const projectData = {
      openPdfs,
      activeTab,
      markups,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strelza-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.openPdfs) setOpenPdfs(parsed.openPdfs);
          if (parsed.markups) setMarkups(parsed.markups);
        } catch (err) {
          console.error('Error loading project file:', err);
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
    <SidebarProvider>
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
        {/* TopBar: Tabs, Search, Actions (Only visible in Document Viewer) */}
        {activeTab === 'documents' && (
          <header className="flex flex-col z-50 shrink-0">
            <TopBar
              openPdfs={openPdfs}
              activePdfIndex={activePdfIndex}
              onSelectPDF={handleSelectPDF}
              onClosePDF={handleClosePDF}
              onLoadPDF={handleLoadPDF}
              onSaveProject={handleSaveProject}
              onOpenProject={handleOpenProject}
              onSignOut={onLogout}
            />
          </header>
        )}

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
              analyzedData={null}
              analyzing={false}
              analysisError={null}
              isMaximized={false}
              onGenerateBOQ={() => setActiveTab('boq')}
              onViewDashboard={() => setActiveTab('dashboard')}
              extractedData={null}
              extracting={false}
              onStartExtraction={() => {}}
              onReextractPage={() => {}}
              extractingPage={false}
              highlightedBbox={highlightedBbox}
              onHighlightBbox={setHighlightedBbox}
              markups={markups}
              onAddMarkup={(m: any) => setMarkups((prev) => [...prev, m])}
              onDeleteMarkup={(id: string) => setMarkups((prev) => prev.filter((m) => m.id !== id))}
              onClearPageMarkups={(page: number) => setMarkups((prev) => prev.filter((m) => m.page !== page))}
              onSelectVersion={() => {}}
              projectVersions={[]}
              activeVersionId=""
              onUndoMarkup={() => {}}
              onRedoMarkup={() => {}}
              canUndoMarkup={false}
              canRedoMarkup={false}
            />
          ) : activeTab === 'settings' ? (
            <SettingsView
              theme={theme}
              geminiRateLimit={geminiRateLimit}
              handleUpdateDefaultTheme={(t: 'light' | 'dark') => setTheme(t)}
              handleUpdateRateLimit={setGeminiRateLimit}
              handleClearCache={() => {}}
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
              analyzedData={null}
              analyzing={false}
              onLoadPDF={handleLoadPDF}
              onGenerateBOQ={() => setActiveTab('boq')}
              onTabChange={setActiveTab}
              extractedData={null}
              extracting={false}
              onStartExtraction={() => {}}
            />
          ) : activeTab === 'boq' || activeTab === 'pricelist' ? (
            <BOQDashboard
              viewMode={activeTab === 'pricelist' ? 'pricelist' : 'boq'}
              pdfName={activePdf?.name}
              analyzedData={null}
              analyzing={false}
              onLoadPDF={handleLoadPDF}
              onNavigateToPage={(page) => {
                setActiveTab('documents');
                updateActivePdfField('currentPage', page);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Icon name="layout" size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">Select a view from the sidebar to get started</p>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default BoqPage;
