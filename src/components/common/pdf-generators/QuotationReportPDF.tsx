import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { formatDate } from '@/lib/date-utils';
import { SharedPDFHeader, SharedPDFFooter, SimpleTable, sharedStyles } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';

interface QuotationReportProps {
  quotations: any[];
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

const QuotationReportDocument: React.FC<QuotationReportProps> = ({ quotations, filterType, filterValue, firmData }) => {
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;
  const currentDate = formatDate(new Date());
  
  const quotationStats = {
    total: quotations.length,
    totalAmount: quotations.reduce((sum, quotation) => sum + (quotation.amount || 0), 0),
    avgAmount: quotations.length > 0 ? quotations.reduce((sum, quotation) => sum + (quotation.amount || 0), 0) / quotations.length : 0,
    convertedCount: quotations.filter((q: any) => q.converted_to_event).length,
  };

  const getFilterDisplayText = () => {
    if (filterType === 'all') return 'All Quotations';
    if (filterType === 'event_type') return `Event Type: ${filterValue}`;
    if (filterType === 'status') {
      const statusLabels: Record<string, string> = {
        'upcoming': 'Upcoming Quotations',
        'past': 'Past Quotations',
        'converted': 'Converted to Event',
        'pending': 'Pending Quotations'
      };
      return statusLabels[filterValue] || filterValue;
    }
    if (filterType === 'event') return `Event Filter: ${filterValue}`;
    return filterValue || 'All Quotations';
  };

  const tableData = quotations.slice(0, 25).map(quotation => [
    quotation.title || 'N/A',
    quotation.client?.name || 'N/A',
    quotation.event_type || 'N/A',
    formatDate(new Date(quotation.event_date)),
    formatCurrency(quotation.amount || 0),
    quotation.converted_to_event ? 'Converted' : 'Pending'
  ]);

  const isMultiPage = quotations.length > 25;

  return (
    <Document>
      {/* Page 1: Header + Report Info + Quotation Details */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Quotation Report</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Generated:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Quotations:</Text>
              <Text style={sharedStyles.detailValue}>{quotationStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Filter:</Text>
              <Text style={sharedStyles.detailValue}>{getFilterDisplayText()}</Text>
            </View>
          </View>
        </View>

        <SimpleTable
          headers={['Title', 'Client', 'Event Type', 'Event Date', 'Amount', 'Status']}
          rows={tableData}
        />

        {!isMultiPage && <SharedPDFFooter firmData={firmData} />}
      </Page>

      {/* Page 2: Quotation Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Quotation Summary</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Financial Summary</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Quotations:</Text>
              <Text style={sharedStyles.detailValue}>{quotationStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Amount:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(quotationStats.totalAmount)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Average Amount:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(quotationStats.avgAmount)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Converted to Events:</Text>
              <Text style={sharedStyles.detailValue}>{quotationStats.convertedCount}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Pending Quotations:</Text>
              <Text style={sharedStyles.detailValue}>{quotationStats.total - quotationStats.convertedCount}</Text>
            </View>
          </View>
        </View>

        {/* Footer only on last page */}
        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateQuotationReportPDF = async (data: any[], filterType: string, filterValue: string, firmData?: any) => {
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

  const blob = await pdf(<QuotationReportDocument quotations={data} filterType={filterType} filterValue={filterValue} firmData={firmData} />).toBlob();
  const fileName = `Quotation Report ${new Date().toISOString().split('T')[0]}.pdf`;
  saveAs(blob, fileName);
};