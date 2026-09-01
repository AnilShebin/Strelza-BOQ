import React from 'react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  FolderOpenIcon,
  SaveIcon,
  PlusIcon,
  FileTextIcon,
  XIcon,
} from 'lucide-react';

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
 * Global Top Navigation Bar with persistent document tabs, sidebar trigger, and project toolbar actions.
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
    <div className="h-[42px] flex justify-between items-center px-3 border-b border-border/80 bg-background/95 backdrop-blur-md shrink-0 select-none z-40">
      {/* Left: Sidebar Trigger & Persistent Document Tabs */}
      <div className="flex items-center h-full shrink-0 max-w-[70vw]">
        <SidebarTrigger className="h-7.5 w-7.5 mr-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-md" />

        <div className="flex items-end h-full gap-0 pl-0 flex-1 max-w-[680px]">
          {openPdfs.map((pdf, idx) => {
            const isActive = idx === activePdfIndex && activeTab === 'documents';
            const showSeparator = idx > 0 && !isActive && (idx - 1 !== activePdfIndex || activeTab !== 'documents');

            return (
              <React.Fragment key={idx}>
                {showSeparator && (
                  <div className="h-3.5 w-[1px] bg-border/80 self-center shrink-0 mx-1 mb-[3px]" />
                )}

                <div
                  onClick={() => onSelectPDF(idx)}
                  className={`flex items-center gap-1.5 cursor-pointer text-xs select-none transition-all duration-150 flex-1 min-w-[70px] max-w-[190px] shrink relative ${isActive
                    ? 'bg-muted/90 text-foreground font-semibold rounded-t-lg h-[34px] px-3 z-10 border-t border-x border-border/80 shadow-2xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-md h-[28px] px-2.5 mb-[3px] mx-0.5 z-0'
                    }`}
                >
                  {/* Curved wings for active tab */}
                  {isActive && (
                    <>
                      <svg
                        className="absolute bottom-0 -left-[8px] w-[8px] h-[8px] fill-muted/90 pointer-events-none z-10"
                        viewBox="0 0 10 10"
                      >
                        <path d="M 10 0 C 10 5.523 5.523 10 0 10 L 10 10 Z" />
                      </svg>
                      <svg
                        className="absolute bottom-0 -right-[8px] w-[8px] h-[8px] fill-muted/90 pointer-events-none z-10"
                        viewBox="0 0 10 10"
                      >
                        <path d="M 0 0 C 0 5.523 4.477 10 10 10 L 0 10 Z" />
                      </svg>
                    </>
                  )}

                  <FileTextIcon
                    className={`size-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="truncate min-w-0 flex-1 text-[11.5px]">{pdf.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePDF(idx);
                    }}
                    className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground rounded size-4 flex items-center justify-center transition-colors ml-0.5 cursor-pointer shrink-0"
                    title="Close PDF"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              </React.Fragment>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadPDF}
            className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground border border-dashed border-border/80 shrink-0 ml-1.5 mb-[3px] cursor-pointer"
            title="Open New PDF"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Right Area */}
      <div className="flex items-center gap-2 h-full shrink-0">
      </div>
    </div>
  );
};
