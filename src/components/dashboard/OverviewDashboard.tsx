import React from 'react';
import { SectionCards } from '@/components/section-cards';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import dashboardData from '@/app/dashboard/data.json';
import { Button } from '@/components/ui/button';
import { Icon } from '../common/Icon';

interface OverviewDashboardProps {
  pdfName?: string;
  analyzedData?: any;
  analyzing?: boolean;
  onLoadPDF: () => void;
  onGenerateBOQ?: () => void;
  onTabChange: (tab: string) => void;
  extractedData?: any;
  extracting?: boolean;
  onStartExtraction?: (pages?: number[]) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  pdfName,
  onLoadPDF,
  onTabChange,
}) => {
  return (
    <div className="flex-1 overflow-y-auto h-full bg-background p-4 md:p-6 space-y-6 select-none font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            BOQ Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time quantity takeoffs, cost intelligence, and project estimation metrics.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadPDF}
            className="h-9 gap-1.5 cursor-pointer shadow-xs"
          >
            <Icon name="upload" size={14} />
            <span>Upload New Drawing</span>
          </Button>
          <Button
            size="sm"
            onClick={() => onTabChange('boq')}
            className="h-9 gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Icon name="file-text" size={14} />
            <span>Open BOQ Viewer</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Section Cards (dashboard-01) */}
      <div className="w-full">
        <SectionCards />
      </div>

      {/* Interactive Chart Analytics (dashboard-01) */}
      <div className="w-full">
        <ChartAreaInteractive />
      </div>

      {/* Data Table with sorting, filtering, columns & details drawer (dashboard-01) */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Recent Extraction Activities
            </h2>
            <p className="text-xs text-muted-foreground">
              Review and audit all structured takeoff items and drawing revisions.
            </p>
          </div>
        </div>
        <DataTable data={dashboardData} />
      </div>
    </div>
  );
};
