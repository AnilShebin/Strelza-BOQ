import React from 'react';
import { Icon } from '../common/Icon';

interface ComplianceCheckItem {
  check_name: string;
  status: 'PASSED' | 'WARNING' | 'N/A';
  message: string;
  action_required?: string;
}

interface ComplianceChecksProps {
  /** List of checklist validations computed by the backend check validator. */
  checklist: ComplianceCheckItem[];
}

/**
 * Panel showing checklist validations list.
 */
export const ComplianceChecks: React.FC<ComplianceChecksProps> = ({ checklist }) => {
  return (
    <div className="flex-1 bg-bg-panel border border-border-color rounded-none p-4 flex flex-col min-h-0 shadow-sm select-none">
      <h3 className="text-xs font-bold font-display uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5 border-b border-border-color-light pb-2 shrink-0">
        <Icon name="info" size={13} className="text-accent-blue" />
        <span>Quote Compliance Checks</span>
      </h3>
      
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
        {checklist.map((check, idx) => {
          const isPassed = check.status === 'PASSED';
          const isWarning = check.status === 'WARNING';
          
          return (
            <div 
              key={idx} 
              className={`p-3 rounded-none border text-[11px] ${
                isPassed 
                  ? 'bg-emerald-500/5 border-emerald-500/10 text-text-secondary' 
                  : isWarning 
                    ? 'bg-[#EE4324]/5 border-[#EE4324]/10 text-text-secondary' 
                    : 'bg-bg-app border-border-color-light text-text-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 font-bold">
                <span className="truncate pr-2 font-display">{check.check_name}</span>
                <span className={`px-1.5 py-0.5 rounded-none text-[9px] uppercase ${
                  isPassed 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : isWarning 
                      ? 'bg-[#EE4324]/10 text-[#EE4324]' 
                      : 'bg-border-color-light text-text-muted'
                }`}>
                  {check.status}
                </span>
              </div>
              <p className="leading-relaxed mb-1">{check.message}</p>
              {isWarning && check.action_required && (
                <p className="font-semibold text-[#EE4324] mt-1.5">Action: {check.action_required}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
