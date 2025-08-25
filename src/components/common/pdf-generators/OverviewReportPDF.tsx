import React from 'react';
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { SharedPDFHeader, SharedPDFFooter, sharedStyles, SimpleTable } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/date-utils';

interface OverviewReportProps {
  overviewData: any;
  filterType: string;
  filterValue: string;
  firmData?: any;
}

const OverviewReportDocument: React.FC<OverviewReportProps> = ({ 
  overviewData, 
  filterType, 
  filterValue, 
  firmData 
}) => {
  const formatCurrency = (amount: number) => `₹${amount?.toLocaleString() || '0'}`;
  const currentDate = formatDate(new Date());

  const getFilterDisplayText = () => {
    if (filterType === 'all') return 'Complete Overview';
    if (filterValue === 'this_month') return 'This Month';
    if (filterValue === 'last_month') return 'Last Month';
    if (filterValue === 'this_quarter') return 'This Quarter';
    if (filterValue === 'this_year') return 'This Year';
    if (filterValue === 'global') return 'All Time';
    return filterValue;
  };

  // Prepare recent events data for table
  const recentEvents = (overviewData?.events || []).slice(0, 10).map((event: any) => [
    event.title || 'N/A',
    event.event_type || 'N/A',
    formatDate(new Date(event.event_date)),
    formatCurrency(event.total_amount || 0)
  ]);

  // Prepare recent payments data for table
  const recentPayments = (overviewData?.payments || []).slice(0, 10).map((payment: any) => [
    payment.event?.title || 'General Payment',
    formatDate(new Date(payment.payment_date)),
    payment.payment_method || 'N/A',
    formatCurrency(payment.amount || 0)
  ]);

  return (
    <Document>
      {/* Page 1: Overview Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Business Overview Report</Text>

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
              <Text style={sharedStyles.detailValue}>{getFilterDisplayText()}</Text>
            </View>
          </View>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Business Metrics</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Events:</Text>
              <Text style={sharedStyles.detailValue}>{overviewData?.events?.length || 0}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Clients:</Text>
              <Text style={sharedStyles.detailValue}>{overviewData?.clients?.length || 0}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Revenue:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(overviewData?.totalRevenue || 0)}</Text>
            </View>
          </View>
        </View>

        {/* Recent Events Table */}
        {recentEvents.length > 0 && (
          <>
            <Text style={[sharedStyles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>
              Recent Events (Latest 10)
            </Text>
            <SimpleTable
              headers={['Event Name', 'Type', 'Date', 'Amount']}
              rows={recentEvents}
            />
          </>
        )}

        <SharedPDFFooter firmData={firmData} />
      </Page>

      {/* Page 2: Recent Payments */}
      {recentPayments.length > 0 && (
        <Page size="A4" style={sharedStyles.page}>
          <Text style={sharedStyles.title}>Recent Payments</Text>

          <SimpleTable
            headers={['Event/Source', 'Payment Date', 'Method', 'Amount']}
            rows={recentPayments}
          />

          {/* Additional Summary */}
          <View style={sharedStyles.detailsContainer}>
            <View style={sharedStyles.column}>
              <Text style={sharedStyles.sectionTitle}>Summary</Text>
              <View style={sharedStyles.detailRow}>
                <Text style={sharedStyles.detailLabel}>Total Payments:</Text>
                <Text style={sharedStyles.detailValue}>{overviewData?.payments?.length || 0}</Text>
              </View>
              <View style={sharedStyles.detailRow}>
                <Text style={sharedStyles.detailLabel}>Pending Tasks:</Text>
                <Text style={sharedStyles.detailValue}>{overviewData?.pendingTasks || 0}</Text>
              </View>
              <View style={sharedStyles.detailRow}>
                <Text style={sharedStyles.detailLabel}>Active Freelancers:</Text>
                <Text style={sharedStyles.detailValue}>{overviewData?.freelancers?.length || 0}</Text>
              </View>
            </View>
          </View>

          <SharedPDFFooter firmData={firmData} />
        </Page>
      )}
    </Document>
  );
};

export const generateOverviewReportPDF = async (
  overviewData: any,
  filterType: string,
  filterValue: string
) => {
  try {
    // Fetch firm data
    const firmId = localStorage.getItem('selectedFirmId');
    let firmData = null;
    
    if (firmId) {
      const { data: firm } = await supabase
        .from('firms')
        .select('*')
        .eq('id', firmId)
        .single();
      firmData = firm;
    }

    // Generate PDF
    const blob = await pdf(
      <OverviewReportDocument 
        overviewData={overviewData}
        filterType={filterType}
        filterValue={filterValue}
        firmData={firmData}
      />
    ).toBlob();

    // Save the PDF
    const fileName = `Overview Report ${filterValue ? filterValue.charAt(0).toUpperCase() + filterValue.slice(1) : 'All'} ${new Date().toISOString().split('T')[0]}.pdf`;
    saveAs(blob, fileName);

  } catch (error) {
    throw error;
  }
};

export default generateOverviewReportPDF;