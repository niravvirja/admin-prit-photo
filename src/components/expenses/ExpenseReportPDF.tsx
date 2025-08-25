import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { Expense } from '@/types/studio';
import { formatDate } from '@/lib/date-utils';
import { SharedPDFHeader, SharedPDFFooter, SimpleTable, sharedStyles } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';

interface ExpenseReportProps {
  expenses: Expense[];
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

const ExpenseReportDocument: React.FC<ExpenseReportProps> = ({ expenses, filterType, filterValue, firmData }) => {
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;
  const currentDate = formatDate(new Date());
  
  const expenseStats = {
    total: expenses.length,
    totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    avgAmount: expenses.length > 0 ? expenses.reduce((sum, expense) => sum + expense.amount, 0) / expenses.length : 0,
  };

  const getFilterDisplayText = () => {
    if (filterType === 'global') return 'All Expenses';
    if (filterType === 'category') return `Category: ${filterValue}`;
    if (filterType === 'staff') return `Staff: ${filterValue}`;
    return filterValue;
  };

  const tableData = expenses.slice(0, 25).map(expense => [
    expense.description,
    expense.category,
    formatDate(new Date(expense.expense_date)),
    formatCurrency(expense.amount)
  ]);

  const isMultiPage = expenses.length > 25;

  return (
    <Document>
      {/* Page 1: Header + Report Info + Expense Details */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Expense Report</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Generated:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Expenses:</Text>
              <Text style={sharedStyles.detailValue}>{expenseStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Filter:</Text>
              <Text style={sharedStyles.detailValue}>{getFilterDisplayText()}</Text>
            </View>
          </View>
        </View>

        <SimpleTable
          headers={['Description', 'Category', 'Date', 'Amount']}
          rows={tableData}
        />

        {!isMultiPage && <SharedPDFFooter firmData={firmData} />}
      </Page>

      {/* Page 2: Expense Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>Expense Summary</Text>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Financial Summary</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Expenses:</Text>
              <Text style={sharedStyles.detailValue}>{expenseStats.total}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Amount:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(expenseStats.totalAmount)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Average Amount:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(expenseStats.avgAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer only on last page */}
        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateExpenseReportPDF = async (expenses: Expense[], filterType: string, filterValue: string, firmData?: any) => {
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

  const blob = await pdf(<ExpenseReportDocument expenses={expenses} filterType={filterType} filterValue={filterValue} firmData={firmData} />).toBlob();
  const fileName = `Expense Report ${new Date().toISOString().split('T')[0]}.pdf`;
  saveAs(blob, fileName);
};

export default generateExpenseReportPDF;