import React, { useState } from 'react';
import { Icon } from '../common/Icon';

interface MenuBarProps {
  onLoadPDF: () => void;
}

/**
 * Top menu bar containing action menus, standard page tools, and undo/redo operations.
 */
export const MenuBar: React.FC<MenuBarProps> = ({ onLoadPDF }) => {
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'text'>('select');

  return (
    <div className="h-[42px] flex justify-between items-center px-4 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2">
        <button className="text-muted-foreground hover:bg-accent hover:text-accent-foreground p-1.5 rounded-md flex items-center justify-center transition-colors duration-150">
          <Icon name="menu" size={16} />
        </button>

        <nav className="flex items-center gap-1">
          <button
            onClick={onLoadPDF}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
          >
            <Icon name="document" size={13} className="opacity-70" />
            <span>Import PDF</span>
          </button>
          
          <button className="px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150">
            Edit
          </button>
          
          <button className="px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150">
            View
          </button>

          <button className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold text-primary bg-primary/10 transition-all duration-150 ml-1.5">
            <span>Extract BOQ</span>
          </button>
        </nav>

        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => setActiveTool('select')}
            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all duration-150 ${
              activeTool === 'select' ? 'bg-primary/10 text-primary shadow-[0_1px_2px_rgba(37,99,235,0.05)]' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon name="select" size={13} />
            <span>Select</span>
          </button>
          <button 
            onClick={() => setActiveTool('hand')}
            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all duration-150 ${
              activeTool === 'hand' ? 'bg-primary/10 text-primary shadow-[0_1px_2px_rgba(37,99,235,0.05)]' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon name="hand" size={13} />
            <span>Hand</span>
          </button>
          <button 
            onClick={() => setActiveTool('text')}
            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all duration-150 ${
              activeTool === 'text' ? 'bg-primary/10 text-primary shadow-[0_1px_2px_rgba(37,99,235,0.05)]' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon name="text" size={13} />
            <span>Text</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon name="cloud" size={14} className="text-emerald-500" />
            <span>Saved</span>
          </div>
          <div className="w-[1px] h-[18px] bg-border" />
          <button className="text-muted-foreground hover:bg-accent hover:text-accent-foreground p-1.5 rounded flex items-center justify-center transition-colors duration-150">
            <Icon name="undo" size={14} />
          </button>
          <button className="text-muted-foreground hover:bg-accent hover:text-accent-foreground p-1.5 rounded flex items-center justify-center transition-colors duration-150">
            <Icon name="redo" size={14} />
          </button>
        </div>

        <div className="w-[1px] h-[18px] bg-border" />

        <div className="flex items-center bg-primary rounded-md overflow-hidden shadow-sm">
          <button className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors duration-150">
            <Icon name="share" size={14} />
            <span>Export BOQ</span>
            <Icon name="chevron-down" size={12} className="ml-0.5 opacity-90" />
          </button>
          <button className="px-2 py-1.5 border-l border-primary-foreground/20 text-primary-foreground flex items-center justify-center hover:bg-primary/95 transition-colors duration-150">
            <Icon name="more" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
