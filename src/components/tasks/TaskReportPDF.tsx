import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { Task } from '@/types/studio';
import { formatDate } from '@/lib/date-utils';
import { SharedPDFHeader, SharedPDFFooter, SimpleTable, sharedStyles } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';

interface TaskReportProps {
  tasks: Task[];
  filterType: string;
  filterValue: string;
  firmData?: {
    name: string;
    description?: string;
    logo_url?: string;
    header_left_content?: string;
    footer_content?: string;
  };
}

const TaskReportDocument: React.FC<TaskReportProps> = ({ tasks, filterType, filterValue, firmData }) => {
  const currentDate = formatDate(new Date());
  
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'Completed').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    pending: tasks.filter(t => t.status === 'Waiting for Response').length,
    totalAmount: tasks.reduce((sum, task) => sum + (task.amount || 0), 0),
  };

  const getFilterDisplayText = () => {
    if (filterType === 'global') return 'All Tasks';
    if (filterType === 'staff') return `Staff: ${filterValue}`;
    if (filterType === 'status') return `Status: ${filterValue}`;
    return filterValue;
  };

  const tableData = tasks.slice(0, 25).map(task => [
    task.title,
    task.task_type,
    task.status,
    task.priority,
    task.assigned_staff?.full_name || task.freelancer?.full_name || 'Unassigned',
    task.amount ? `₹${task.amount.toLocaleString()}` : '-'
  ]);

  const isMultiPage = tasks.length > 25;

  return (
    <Document>
      {/* Page 1: Header + Report Info + Task Details */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Task Report</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Generated:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Tasks:</Text>
              <Text style={sharedStyles.detailValue}>{taskStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Filter:</Text>
              <Text style={sharedStyles.detailValue}>{getFilterDisplayText()}</Text>
            </View>
          </View>
        </View>

        <SimpleTable
          headers={['Title', 'Type', 'Status', 'Priority', 'Assigned To', 'Amount']}
          rows={tableData}
        />

        {!isMultiPage && <SharedPDFFooter firmData={firmData} />}
      </Page>

      {/* Page 2: Task Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Task Summary</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Task Statistics</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Tasks:</Text>
              <Text style={sharedStyles.detailValue}>{taskStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Completed:</Text>
              <Text style={sharedStyles.detailValue}>{taskStats.completed}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>In Progress:</Text>
              <Text style={sharedStyles.detailValue}>{taskStats.inProgress}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Amount:</Text>
              <Text style={sharedStyles.detailValue}>₹{taskStats.totalAmount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Footer only on last page */}
        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateTaskReportPDF = async (tasks: Task[], filterType: string, filterValue: string, firmData?: any) => {
  // Use provided firmData or fetch it if not provided
  if (!firmData) {
    try {
      // Try to get current user and their firm
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Try multiple ways to get firm ID
        const userFirmKey = `selectedFirmId_${user.id}`;
        let firmId = localStorage.getItem(userFirmKey) || localStorage.getItem('selectedFirmId');
        
        // If no localStorage, try getting from profile
        if (!firmId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('current_firm_id, firm_id')
            .eq('user_id', user.id)
            .single();
          
          firmId = profile?.current_firm_id || profile?.firm_id;
        }
        
        if (firmId) {
          console.log('Fetching firm data for PDF with ID:', firmId);
          const { data: firm, error } = await supabase
            .from('firms')
            .select('name, description, logo_url, header_left_content, footer_content')
            .eq('id', firmId)
            .single();
          
          if (error) {
            console.error('Supabase error fetching firm data:', error);
          } else {
            console.log('Successfully fetched firm data:', firm);
            firmData = firm;
          }
        } else {
          console.warn('No firm ID found for PDF generation');
        }
      }
    } catch (error) {
      console.error('Error fetching firm data for PDF:', error);
    }
  }
  
  console.log('Final firmData for PDF:', firmData);

  const blob = await pdf(<TaskReportDocument tasks={tasks} filterType={filterType} filterValue={filterValue} firmData={firmData} />).toBlob();
  const fileName = `Task Report ${new Date().toISOString().split('T')[0]}.pdf`;
  saveAs(blob, fileName);
};

export default generateTaskReportPDF;