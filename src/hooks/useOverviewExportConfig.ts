import { useMemo } from 'react';
import { ExportConfig } from '@/components/common/UniversalExportDialog';
import { generateOverviewReportPDF } from '@/components/common/pdf-generators/OverviewReportPDF';

export const useOverviewExportConfig = (events: any[]): ExportConfig => {
  return useMemo(() => ({
    title: "Overview Report", 
    filterTypes: [
      { value: 'all', label: 'Complete Overview' },
      { 
        value: 'date_range', 
        label: 'By Date Range',
        options: [
          { value: 'this_month', label: 'This Month' },
          { value: 'last_month', label: 'Last Month' },
          { value: 'this_quarter', label: 'This Quarter' },
          { value: 'this_year', label: 'This Year' },
          { value: 'global', label: 'All Time' }
        ]
      }
    ],
    exportFunction: async (data, filterType, filterValue) => {
      const overviewData = Array.isArray(data) ? data[0] : data;
      await generateOverviewReportPDF(overviewData, filterType, filterValue);
    },
    getPreviewData: (data) => {
      const overviewData = Array.isArray(data) ? data[0] : data;
      return {
        count: 1,
        summary: {
          'Total Events': overviewData?.events?.length?.toString() || '0',
          'Total Clients': overviewData?.clients?.length?.toString() || '0',
          'Total Revenue': `₹${overviewData?.totalRevenue?.toLocaleString() || '0'}`,
          'Pending Tasks': overviewData?.pendingTasks?.toString() || '0'
        }
      };
    }
  }), [events]);
};