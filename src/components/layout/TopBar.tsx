import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { PlusIcon, FileTextIcon, XIcon, SaveIcon, FolderOpenIcon } from 'lucide-react';

interface TopBarProps {
  openPdfs: Array<{ name: string; path: string }>;
  activePdfIndex: number;
  activeTab?: string;
  onSelectPDF: (index: number) => void;
  onClosePDF: (index: number) => void;
  onLoadPDF: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onSignOut?: () => void;
}

/**
 * Microsoft Edge-style browser tab bar with concave corner fillets,
 * fluid hover states, and quick Project Save/Open actions.
 */
export const TopBar: React.FC<TopBarProps> = ({
  openPdfs,
  activePdfIndex,
  activeTab = 'dashboard',
  onSelectPDF,
  onClosePDF,
  onLoadPDF,
  onSaveProject,
  onOpenProject,
}) => {
  return (
    <div className="h-[36px] flex justify-between items-center px-2 border-b border-border/70 bg-neutral-900/90 dark:bg-neutral-950/95 backdrop-blur-md shrink-0 select-none z-40 relative">
      {/* Left: Sidebar Trigger & Edge-style Tabs */}
      <div className="flex items-center h-full shrink-0 max-w-[75vw]">
        {/* Sidebar Trigger */}
        <SidebarTrigger className="h-7 w-7 mr-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-md transition-colors cursor-pointer" />

        {/* Tab Strip */}
        <div className="flex items-end h-full gap-0 flex-1 max-w-[760px] relative">
          {openPdfs.map((pdf, idx) => {
            const isActive = idx === activePdfIndex && activeTab === 'documents';
            const isPrevActive = idx - 1 === activePdfIndex && activeTab === 'documents';
            const showDivider = idx > 0 && !isActive && !isPrevActive;

            return (
              <React.Fragment key={idx}>
                {/* Inactive Tab Separator Divider */}
                {showDivider && (
                  <div className="w-[1px] h-3.5 bg-white/15 dark:bg-white/10 self-center shrink-0 mx-0.5 pointer-events-none" />
                )}

                {/* Tab Item */}
                <div
                  onClick={() => onSelectPDF(idx)}
                  className={`group relative flex items-center gap-2 cursor-pointer select-none transition-all duration-150 flex-1 min-w-[90px] max-w-[210px] shrink ${
                    isActive
                      ? 'bg-card text-foreground font-medium rounded-t-[9px] h-[31px] px-3 z-10 shadow-xs border-t border-x border-border/70'
                      : 'bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground rounded-md h-[27px] px-2.5 mb-[2px] mx-0.5 z-0'
                  }`}
                >
                  {/* Left Concave Wing (Edge Curve) */}
                  {isActive && (
                    <svg
                      className="absolute bottom-0 -left-[9px] w-[9px] h-[9px] fill-card pointer-events-none z-10"
                      viewBox="0 0 10 10"
                    >
                      <path d="M 10 0 C 10 5.523 5.523 10 0 10 L 10 10 Z" />
                    </svg>
                  )}

                  {/* Right Concave Wing (Edge Curve) */}
                  {isActive && (
                    <svg
                      className="absolute bottom-0 -right-[9px] w-[9px] h-[9px] fill-card pointer-events-none z-10"
                      viewBox="0 0 10 10"
                    >
                      <path d="M 0 0 C 0 5.523 4.477 10 10 10 L 0 10 Z" />
                    </svg>
                  )}

                  {/* Document Favicon Icon */}
                  <FileTextIcon
                    className={`size-3.5 shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  />

                  {/* Tab Title */}
                  <span className="truncate min-w-0 flex-1 text-[11.5px] leading-none">
                    {pdf.name}
                  </span>

                  {/* Close Tab Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePDF(idx);
                    }}
                    className={`rounded-full size-4.5 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'text-muted-foreground hover:bg-foreground/15 hover:text-foreground'
                        : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                    }`}
                    title="Close tab (Ctrl+W)"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </div>
              </React.Fragment>
            );
          })}

          {/* New Tab (+) Button */}
          <button
            type="button"
            onClick={onLoadPDF}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ml-1.5 mb-[2px] cursor-pointer"
            title="New tab (Open PDF)"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Right Area: Project Save & Open Quick Actions */}
      <div className="flex items-center gap-1.5 h-full shrink-0">
        {onOpenProject && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onOpenProject}
            className="h-6.5 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded cursor-pointer"
            title="Open Strelza Project (.slz / .json)"
          >
            <FolderOpenIcon className="size-3.5" />
            <span className="hidden sm:inline">Open</span>
          </Button>
        )}

        {onSaveProject && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onSaveProject}
            disabled={openPdfs.length === 0}
            className="h-6.5 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded cursor-pointer disabled:opacity-30"
            title="Save Project with PDFs & Extracted Schedules (.slz)"
          >
            <SaveIcon className="size-3.5 text-primary" />
            <span className="hidden sm:inline font-medium">Save Project</span>
          </Button>
        )}
      </div>
    </div>
  );
};
