import React from 'react';
import { Icon } from '../common/Icon';

interface SidebarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Collapsible main navigation drawer panel.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  theme,
  onToggleTheme,
  activeTab,
  onTabChange
}) => {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
    { id: 'documents', name: 'Documents', icon: 'document' },
    { id: 'boq', name: 'BOQ Viewer', icon: 'file-text' },
    { id: 'equipment', name: 'Equipment', icon: 'cpu' },
    { id: 'pricelist', name: 'Master Prices', icon: 'price-list' },
    { id: 'rules', name: 'Rules', icon: 'tag' },
  ];

  return (
    <aside className="h-full w-[68px] border-r border-border-color bg-bg-panel flex flex-col justify-between shrink-0 select-none">
      <div className="flex flex-col items-center w-full">
        {/* Exact 42px header matching TopBar height and border alignment */}
        <div className="w-full h-[42px] flex items-center justify-center border-b border-border-color-light shrink-0">
          <Icon name="logo" size={26} />
        </div>

        <nav className="flex flex-col gap-0.5 w-full pt-1.5 px-1">
          {navItems.map((item) => {
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all duration-150 cursor-pointer ${isActive
                    ? 'text-accent-blue font-bold bg-bg-app/50'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-app/30'
                  }`}
              >
                <Icon name={item.icon} size={16} />
                <span className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-accent-blue font-bold' : 'text-text-muted'}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col items-stretch gap-1 w-full border-t border-border-color-light p-1.5 shrink-0">
        <button
          onClick={onToggleTheme}
          className="text-text-muted hover:bg-bg-app/40 hover:text-text-secondary py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 w-full cursor-pointer"
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} />
          <span className="text-[8px] font-semibold mt-0.5">{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={`py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 w-full cursor-pointer ${activeTab === 'settings'
              ? 'text-accent-blue font-bold bg-bg-app/40'
              : 'text-text-muted hover:bg-bg-app/40 hover:text-text-secondary'
            }`}
        >
          <Icon name="settings" size={14} />
          <span className={`text-[8px] font-semibold mt-0.5 ${activeTab === 'settings' ? 'text-accent-blue font-bold' : 'text-text-muted'}`}>Settings</span>
        </button>
      </div>
    </aside>
  );
};
