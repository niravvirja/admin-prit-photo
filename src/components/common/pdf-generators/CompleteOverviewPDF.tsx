import React from 'react';
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { SharedPDFHeader, SharedPDFFooter, sharedStyles, SimpleTable } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/date-utils';
import { calculateEventBalance } from '@/lib/payment-calculator';

interface OverviewData {
  businessSummary: {
    totalEvents: number;
    totalClients: number;
    totalRevenue: number;
    netProfit: number;
    activeEvents: number;
    completedEvents: number;
  };
  financialSummary: {
    paymentsIn: number;
    paymentsOut: number;
    pendingAmount: number;
    cashPosition: number;
  };
  operationalSummary: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    totalStaff: number;
    totalFreelancers: number;
  };
  topEvents: Array<{ title: string; amount: number; status: string }>;
  recentActivity: Array<{ date: string; activity: string; amount?: number }>;
  firmData?: any;
}

const CompleteOverviewDocument: React.FC<OverviewData> = ({ 
  businessSummary,
  financialSummary,
  operationalSummary,
  topEvents,
  recentActivity,
  firmData 
}) => {
  const formatCurrency = (amount: number) => `₹${amount?.toLocaleString() || '0'}`;
  const currentDate = formatDate(new Date());

  // Business metrics table
  const businessMetricsData = [
    ['BUSINESS METRICS', 'Count/Amount', 'Status'],
    ['Total Events', businessSummary.totalEvents.toString(), businessSummary.totalEvents > 0 ? '✓' : '⚠'],
    ['Active Events', businessSummary.activeEvents.toString(), ''],
    ['Completed Events', businessSummary.completedEvents.toString(), ''],
    ['Total Clients', businessSummary.totalClients.toString(), businessSummary.totalClients > 0 ? '✓' : '⚠'],
    ['Total Revenue', formatCurrency(businessSummary.totalRevenue), businessSummary.totalRevenue > 0 ? '✓' : '⚠'],
    ['Net Profit', formatCurrency(businessSummary.netProfit), businessSummary.netProfit > 0 ? '✓' : '⚠']
  ];

  // Financial position table
  const financialPositionData = [
    ['FINANCIAL POSITION', 'Amount', 'Health'],
    ['Payments Received', formatCurrency(financialSummary.paymentsIn), '✓'],
    ['Payments Made', formatCurrency(financialSummary.paymentsOut), ''],
    ['Pending Collections', formatCurrency(financialSummary.pendingAmount), financialSummary.pendingAmount > 0 ? '⚠' : '✓'],
    ['Current Cash Position', formatCurrency(financialSummary.cashPosition), financialSummary.cashPosition > 0 ? '✓' : '⚠']
  ];

  // Operational metrics table
  const operationalMetricsData = [
    ['OPERATIONAL METRICS', 'Count', 'Efficiency'],
    ['Total Tasks', operationalSummary.totalTasks.toString(), ''],
    ['Completed Tasks', operationalSummary.completedTasks.toString(), ''],
    ['Pending Tasks', operationalSummary.pendingTasks.toString(), operationalSummary.pendingTasks === 0 ? '✓' : '⚠'],
    ['Staff Members', operationalSummary.totalStaff.toString(), operationalSummary.totalStaff > 0 ? '✓' : '⚠'],
    ['Freelancers', operationalSummary.totalFreelancers.toString(), ''],
    ['Task Completion Rate', 
     operationalSummary.totalTasks > 0 ? 
       `${((operationalSummary.completedTasks / operationalSummary.totalTasks) * 100).toFixed(1)}%` : 
       '0%', 
     operationalSummary.totalTasks > 0 && (operationalSummary.completedTasks / operationalSummary.totalTasks) > 0.8 ? '✓' : '⚠']
  ];

  // Top events table
  const topEventsData = topEvents.map(event => [
    event.title,
    formatCurrency(event.amount),
    event.status
  ]);

  return (
    <Document>
      {/* Page 1: Business Overview */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />
        
        <Text style={sharedStyles.title}>Complete Business Overview</Text>
        
        {/* Report Info */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Generated:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Period:</Text>
              <Text style={sharedStyles.detailValue}>All Time</Text>
            </View>
          </View>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Quick Stats</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Business Health:</Text>
              <Text style={sharedStyles.detailValue}>
                {businessSummary.netProfit > 0 ? 'Profitable ✓' : 'Needs Attention ⚠'}
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Cash Position:</Text>
              <Text style={sharedStyles.detailValue}>
                {financialSummary.cashPosition > 0 ? 'Positive ✓' : 'Critical ⚠'}
              </Text>
            </View>
          </View>
        </View>

        {/* Business Metrics Table */}
        <SimpleTable
          headers={['Metric', 'Value', 'Status']}
          rows={businessMetricsData}
        />
      </Page>

      {/* Page 2: Financial & Operational Details */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Financial & Operational Analysis</Text>
        
        {/* Financial Position Table */}
        <SimpleTable
          headers={['Financial Metric', 'Amount', 'Health']}
          rows={financialPositionData}
        />

        {/* Operational Metrics Table */}
        <SimpleTable
          headers={['Operational Metric', 'Count', 'Status']}
          rows={operationalMetricsData}
        />

        {/* Top Events */}
        {topEvents.length > 0 && (
          <>
            <Text style={sharedStyles.sectionTitle}>Top Events by Revenue</Text>
            <SimpleTable
              headers={['Event Title', 'Amount', 'Status']}
              rows={topEventsData}
            />
          </>
        )}
      </Page>

      {/* Page 3: Key Insights & Recommendations */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Key Insights & Recommendations</Text>
        
        {/* Key Performance Indicators */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Key Performance Indicators</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Revenue per Event:</Text>
              <Text style={sharedStyles.detailValue}>
                {businessSummary.totalEvents > 0 ? 
                  formatCurrency(businessSummary.totalRevenue / businessSummary.totalEvents) : 
                  '₹0'
                }
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Client Retention:</Text>
              <Text style={sharedStyles.detailValue}>
                {businessSummary.totalClients > 0 && businessSummary.totalEvents > 0 ?
                  `${(businessSummary.totalEvents / businessSummary.totalClients).toFixed(1)} events/client` :
                  'N/A'
                }
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Collection Efficiency:</Text>
              <Text style={sharedStyles.detailValue}>
                {(financialSummary.paymentsIn + financialSummary.pendingAmount) > 0 ?
                  `${((financialSummary.paymentsIn / (financialSummary.paymentsIn + financialSummary.pendingAmount)) * 100).toFixed(1)}%` :
                  'N/A'
                }
              </Text>
            </View>
          </View>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Business Recommendations</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Priority 1:</Text>
              <Text style={sharedStyles.detailValue}>
                {financialSummary.pendingAmount > 0 ? 'Follow up on pending payments' : 'Maintain payment discipline ✓'}
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Priority 2:</Text>
              <Text style={sharedStyles.detailValue}>
                {operationalSummary.pendingTasks > 0 ? 'Complete pending tasks' : 'Task management optimal ✓'}
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Priority 3:</Text>
              <Text style={sharedStyles.detailValue}>
                {businessSummary.activeEvents === 0 ? 'Focus on booking new events' : 'Deliver current projects well ✓'}
              </Text>
            </View>
          </View>
        </View>

        {/* Business Health Score */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Overall Business Health Score</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Financial Health:</Text>
              <Text style={sharedStyles.detailValue}>
                {financialSummary.cashPosition > 0 && businessSummary.netProfit > 0 ? '90/100 ✓' :
                 financialSummary.cashPosition > 0 || businessSummary.netProfit > 0 ? '70/100' : '40/100 ⚠'}
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Operational Health:</Text>
              <Text style={sharedStyles.detailValue}>
                {operationalSummary.totalTasks > 0 && (operationalSummary.completedTasks / operationalSummary.totalTasks) > 0.8 ? '85/100 ✓' :
                 operationalSummary.totalTasks > 0 ? '65/100' : '50/100'}
              </Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Growth Potential:</Text>
              <Text style={sharedStyles.detailValue}>
                {businessSummary.activeEvents > 0 && businessSummary.totalClients > 5 ? '80/100 ✓' : '60/100'}
              </Text>
            </View>
          </View>
        </View>

        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateCompleteOverviewPDF = async () => {
  try {
    const firmId = localStorage.getItem('selectedFirmId');
    if (!firmId) throw new Error('No firm selected');

    // Fetch firm data
    const { data: firmData } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    // Fetch all business data
    const [
      { data: events },
      { data: clients },
      { data: payments },
      { data: expenses },
      { data: tasks },
      { data: staff },
      { data: freelancers }
    ] = await Promise.all([
      supabase.from('events').select('*').eq('firm_id', firmId),
      supabase.from('clients').select('*').eq('firm_id', firmId),
      supabase.from('payments').select('*').eq('firm_id', firmId),
      supabase.from('expenses').select('*').eq('firm_id', firmId),
      supabase.from('tasks').select('*').eq('firm_id', firmId),
      supabase.from('profiles').select('*').eq('firm_id', firmId),
      supabase.from('freelancers').select('*').eq('firm_id', firmId)
    ]);

    // Calculate business summary
    const totalEvents = events?.length || 0;
    const totalClients = clients?.length || 0;
    const totalRevenue = events?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    
    const now = new Date();
    const activeEvents = events?.filter(e => new Date(e.event_date) >= now).length || 0;
    const completedEvents = events?.filter(e => new Date(e.event_date) < now).length || 0;

    // Calculate financial summary
    const paymentsIn = (payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0) +
                      (events?.reduce((sum, e) => sum + (e.advance_amount || 0), 0) || 0);
    const paymentsOut = totalExpenses;
    const pendingAmount = events?.reduce((sum, event) => sum + calculateEventBalance(event as any), 0) || 0;
    const cashPosition = paymentsIn - paymentsOut;

    // Calculate operational summary
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'Completed').length || 0;
    const pendingTasks = totalTasks - completedTasks;
    const totalStaff = staff?.length || 0;
    const totalFreelancers = freelancers?.length || 0;

    // Get top events by revenue
    const topEvents = events?.
      sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
      .slice(0, 5)
      .map(e => ({
        title: e.title,
        amount: e.total_amount || 0,
        status: new Date(e.event_date) >= now ? 'Upcoming' : 'Completed'
      })) || [];

    // Generate recent activity (simplified)
    const recentActivity = [
      ...(payments?.slice(-5).map(p => ({
        date: p.payment_date,
        activity: `Payment received`,
        amount: p.amount
      })) || []),
      ...(events?.slice(-3).map(e => ({
        date: e.created_at?.split('T')[0] || '',
        activity: `Event created: ${e.title}`
      })) || [])
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    const overviewData: OverviewData = {
      businessSummary: {
        totalEvents,
        totalClients,
        totalRevenue,
        netProfit,
        activeEvents,
        completedEvents
      },
      financialSummary: {
        paymentsIn,
        paymentsOut,
        pendingAmount,
        cashPosition
      },
      operationalSummary: {
        totalTasks,
        completedTasks,
        pendingTasks,
        totalStaff,
        totalFreelancers
      },
      topEvents,
      recentActivity,
      firmData
    };

    // Generate PDF
    const blob = await pdf(
      <CompleteOverviewDocument {...overviewData} />
    ).toBlob();

    const fileName = `Complete Business Overview ${new Date().toISOString().split('T')[0]}.pdf`;
    saveAs(blob, fileName);

  } catch (error) {
    throw error;
  }
};

export default generateCompleteOverviewPDF;