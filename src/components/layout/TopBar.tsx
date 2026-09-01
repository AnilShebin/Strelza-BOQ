import React from 'react';
import { Icon } from '../common/Icon';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface TopBarProps {
  openPdfs: Array<{ name: string; path: string }>;
  activePdfIndex: number;
  onSelectPDF: (index: number) => void;
  onClosePDF: (index: number) => void;
  onLoadPDF: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onSignOut?: () => void;
}

/**
 * Pure Web Top Navigation Bar with shadcn buttons, document tabs, and session menu.
 */
export const TopBar: React.FC<TopBarProps> = ({
  openPdfs,
  activePdfIndex,
  onSelectPDF,
  onClosePDF,
  onLoadPDF,
  onSaveProject,
  onOpenProject,
  onSignOut,
}) => {
  return (
    <div className="h-[42px] flex justify-between items-center px-3 border-b border-border/80 bg-background shrink-0 select-none">
      {/* Left: Sidebar Trigger & Document Tabs */}
      <div className="flex items-center h-full shrink-0 max-w-[70vw]">
        <SidebarTrigger className="h-7 w-7 mr-2 text-muted-foreground hover:text-foreground" />
        <div className="flex items-end h-full gap-0 pl-0 flex-1 max-w-[640px]">
          {openPdfs.map((pdf, idx) => {
            const isActive = idx === activePdfIndex;
            const showSeparator = idx > 0 && !isActive && idx - 1 !== activePdfIndex;

            return (
              <React.Fragment key={idx}>
                {showSeparator && (
                  <div className="h-3.5 w-[1px] bg-border/80 self-center shrink-0 mx-1 mb-[3px]" />
                )}

                <div
                  onClick={() => onSelectPDF(idx)}
                  className={`flex items-center gap-2 cursor-pointer text-xs select-none transition-colors duration-150 flex-1 min-w-[60px] max-w-[180px] shrink relative ${
                    isActive
                      ? 'bg-muted text-foreground font-semibold rounded-t-lg h-[34px] px-3.5 z-10 shadow-xs'
                      : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-md h-[28px] px-2.5 mb-[3px] mx-0.5 z-0'
                  }`}
                >
                  {/* Chrome/Edge style curved wings for active tab */}
                  {isActive && (
                    <>
                      <svg
                        className="absolute bottom-0 -left-[10px] w-[10px] h-[10px] fill-muted pointer-events-none z-10"
                        viewBox="0 0 10 10"
                      >
                        <path d="M 10 0 C 10 5.523 5.523 10 0 10 L 10 10 Z" />
                      </svg>
                      <svg
                        className="absolute bottom-0 -right-[10px] w-[10px] h-[10px] fill-muted pointer-events-none z-10"
                        viewBox="0 0 10 10"
                      >
                        <path d="M 0 0 C 0 5.523 4.477 10 10 10 L 0 10 Z" />
                      </svg>
                    </>
                  )}

                  <Icon
                    name="file-text"
                    size={13}
                    className={`shrink-0 ${isActive ? 'text-[#EE4324]' : 'text-muted-foreground'}`}
                  />
                  <span className="truncate min-w-0 flex-1">{pdf.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePDF(idx);
                    }}
                    className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground rounded w-4 h-4 flex items-center justify-center transition-colors ml-1 cursor-pointer shrink-0"
                    title="Close PDF"
                  >
                    <Icon name="close" size={10} />
                  </button>
                </div>
              </React.Fragment>
            );
          })}

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onLoadPDF}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground border border-dashed border-border shrink-0 ml-2 mb-[3px]"
            title="Open New PDF"
          >
            <Icon name="plus" size={13} />
          </Button>
        </div>
      </div>

      {/* Right: Quick actions, Project Save/Open */}
      <div className="flex items-center gap-1.5 h-full shrink-0">
        {onOpenProject && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenProject}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Open Project File"
          >
            <Icon name="folder" size={13} />
            <span>Open</span>
          </Button>
        )}

        {onSaveProject && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSaveProject}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Save / Export Project"
          >
            <Icon name="save" size={13} />
            <span>Save</span>
          </Button>
        )}
      </div>
    </div>
  );
};

