import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { formatDate } from '@/lib/date-utils';
import { SharedPDFHeader, SharedPDFFooter, SimpleTable, sharedStyles } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';

interface ClientReportProps {
  clients: any[];
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

const ClientReportDocument: React.FC<ClientReportProps> = ({ clients, filterType, filterValue, firmData }) => {
  const formatPhoneNumber = (phone: string) => phone || 'N/A';
  const currentDate = formatDate(new Date());
  
  const clientStats = {
    total: clients.length,
    withEvents: clients.filter(client => client.events && client.events.length > 0).length,
    withEmail: clients.filter(client => client.email).length,
    withAddress: clients.filter(client => client.address).length,
  };

  const getFilterDisplayText = () => {
    if (filterType === 'all') return 'All Clients';
    if (filterType === 'event') return `Event-wise Clients: ${filterValue}`;
    return filterValue;
  };

  const tableData = clients.slice(0, 50).map(client => [
    client.name,
    formatPhoneNumber(client.phone),
    client.email || 'N/A',
    client.address || 'N/A',
    formatDate(new Date(client.created_at))
  ]);

  const isMultiPage = clients.length > 50;

  return (
    <Document>
      {/* Page 1: Header + Report Info + Client Details */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Client Report</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Generated:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Clients:</Text>
              <Text style={sharedStyles.detailValue}>{clientStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Filter:</Text>
              <Text style={sharedStyles.detailValue}>{getFilterDisplayText()}</Text>
            </View>
          </View>
        </View>

        <SimpleTable
          headers={['Name', 'Phone', 'Email', 'Address', 'Added On']}
          rows={tableData}
        />

        {!isMultiPage && <SharedPDFFooter firmData={firmData} />}
      </Page>

      {/* Page 2: Client Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Client Summary</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Client Statistics</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Clients:</Text>
              <Text style={sharedStyles.detailValue}>{clientStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Clients with Events:</Text>
              <Text style={sharedStyles.detailValue}>{clientStats.withEvents}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Clients with Email:</Text>
              <Text style={sharedStyles.detailValue}>{clientStats.withEmail}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Clients with Address:</Text>
              <Text style={sharedStyles.detailValue}>{clientStats.withAddress}</Text>
            </View>
          </View>
        </View>

        {/* Footer only on last page */}
        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateClientReportPDF = async (clients: any[], filterType: string, filterValue: string, firmData?: any) => {
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

  const blob = await pdf(<ClientReportDocument clients={clients} filterType={filterType} filterValue={filterValue} firmData={firmData} />).toBlob();
  const fileName = `Client Report ${new Date().toISOString().split('T')[0]}.pdf`;
  saveAs(blob, fileName);
};

export default generateClientReportPDF;