import React from 'react';
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { SharedPDFHeader, SharedPDFFooter, sharedStyles, SimpleTable } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/date-utils';
import { calculateEventBalance } from '@/lib/payment-calculator';

interface BalanceSheetData {
  assets: {
    cash: number;
    accountsReceivable: number;
    otherAssets?: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    accountingLiabilities?: number;
    totalLiabilities: number;
  };
  equity: {
    retainedEarnings: number;
    totalEquity: number;
  };
  firmData?: any;
}

const BalanceSheetDocument: React.FC<BalanceSheetData> = ({ 
  assets, 
  liabilities, 
  equity, 
  firmData 
}) => {
  const formatCurrency = (amount: number) => `₹${amount?.toLocaleString() || '0'}`;
  const currentDate = formatDate(new Date());

  // Prepare balance sheet table data
  const balanceSheetData = [
    ['ASSETS', '', ''],
    ['Current Assets:', '', ''],
    ['  Cash & Bank Balance', formatCurrency(assets.cash), ''],
    ['  Accounts Receivable (Pending Payments)', formatCurrency(assets.accountsReceivable), ''],
    ['  Other Assets (Accounting Entries)', formatCurrency(assets.otherAssets || 0), ''],
    ['TOTAL ASSETS', '', formatCurrency(assets.totalAssets)],
    ['', '', ''],
    ['LIABILITIES', '', ''],
    ['Current Liabilities:', '', ''],
    ['  Expenses & Salary Payments', formatCurrency(liabilities.accountsPayable), ''],
    ['  Accounting Liabilities/Capital (Accounting Entries)', formatCurrency(liabilities.accountingLiabilities || 0), ''],
    ['TOTAL LIABILITIES', '', formatCurrency(liabilities.totalLiabilities)],
    ['', '', ''],
    ['EQUITY', '', ''],
    ['  Retained Earnings (Net Profit)', formatCurrency(equity.retainedEarnings), ''],
    ['TOTAL EQUITY', '', formatCurrency(equity.totalEquity)],
    ['', '', ''],
    ['TOTAL LIABILITIES + EQUITY', '', formatCurrency(liabilities.totalLiabilities + equity.totalEquity)]
  ];

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />
        
        <Text style={sharedStyles.title}>Balance Sheet</Text>
        
        {/* Report Info */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Report Information</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Date:</Text>
              <Text style={sharedStyles.detailValue}>{currentDate}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Type:</Text>
              <Text style={sharedStyles.detailValue}>Balance Sheet Statement</Text>
            </View>
          </View>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Financial Position</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Assets:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(assets.totalAssets)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Net Worth:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(equity.totalEquity)}</Text>
            </View>
          </View>
        </View>

        {/* Balance Sheet Table */}
        <SimpleTable
          headers={['Account', 'Amount', 'Total']}
          rows={balanceSheetData}
        />

        {/* Balance Check */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Balance Check</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Assets:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(assets.totalAssets)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Liabilities + Equity:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(liabilities.totalLiabilities + equity.totalEquity)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Balance Status:</Text>
              <Text style={sharedStyles.detailValue}>
                {Math.abs(assets.totalAssets - (liabilities.totalLiabilities + equity.totalEquity)) < 1 ? 'BALANCED ✓' : 'UNBALANCED ⚠'}
              </Text>
            </View>
          </View>
        </View>

        <SharedPDFFooter firmData={firmData} />
      </Page>
    </Document>
  );
};

export const generateBalanceSheetPDF = async () => {
  try {
    const firmId = localStorage.getItem('selectedFirmId');
    if (!firmId) throw new Error('No firm selected');

    // Fetch firm data
    const { data: firmData } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    // Calculate Assets
    // Cash = Total payments received (client payments + advances)
    const { data: paymentsReceived } = await supabase
      .from('payments')
      .select('amount')
      .eq('firm_id', firmId);

    const { data: advancePayments } = await supabase
      .from('events')
      .select('advance_amount')
      .eq('firm_id', firmId)
      .gt('advance_amount', 0);

    const totalPaymentsReceived = (paymentsReceived?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0) +
                                  (advancePayments?.reduce((sum, e) => sum + (e.advance_amount || 0), 0) || 0);

    // Expenses and salary outflows (treated as current liabilities)
    const { data: expensesPaid } = await supabase
      .from('expenses')
      .select('amount')
      .eq('firm_id', firmId);

    const { data: staffPayments } = await supabase
      .from('staff_payments')
      .select('amount')
      .eq('firm_id', firmId);

    const { data: freelancerPayments } = await supabase
      .from('freelancer_payments')
      .select('amount')
      .eq('firm_id', firmId);

    const totalExpensesPaid = expensesPaid?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalStaffPayments = staffPayments?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalFreelancerPayments = freelancerPayments?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    const cash = totalPaymentsReceived; // do not subtract expenses here; show them under liabilities

    // Accounts Receivable = Pending payments (balance amounts from events)
    const { data: events } = await supabase
      .from('events')
      .select(`
        *,
        payments(amount),
        event_closing_balances(closing_amount)
      `)
      .eq('firm_id', firmId);

    const accountsReceivable = events?.reduce((sum, event) => {
      const balance = calculateEventBalance(event as any);
      return sum + balance;
    }, 0) || 0;

    // Accounting entries (manual ledger)
    const { data: accountingEntries } = await supabase
      .from('accounting_entries')
      .select('amount, entry_type')
      .eq('firm_id', firmId);

    const accountingDebits = accountingEntries?.filter((e: any) => e.entry_type === 'Debit')
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0;
    const accountingCredits = accountingEntries?.filter((e: any) => e.entry_type === 'Credit')
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0;

    const otherAssets = accountingDebits;
    const accountingLiabilities = accountingCredits;

    const totalAssets = cash + accountsReceivable + otherAssets;

    // Liabilities = Expenses + salary payments + accounting credits
    const accountsPayable = totalExpensesPaid + totalStaffPayments + totalFreelancerPayments;
    const totalLiabilities = accountsPayable + accountingLiabilities;

    // Equity = Assets - Liabilities (retained earnings / net worth)
    const retainedEarnings = totalAssets - totalLiabilities;
    const totalEquity = retainedEarnings;

    const balanceSheetData: BalanceSheetData = {
      assets: {
        cash,
        accountsReceivable,
        otherAssets,
        totalAssets
      },
      liabilities: {
        accountsPayable,
        accountingLiabilities,
        totalLiabilities
      },
      equity: {
        retainedEarnings,
        totalEquity
      },
      firmData
    };

    // Generate PDF
    const blob = await pdf(
      <BalanceSheetDocument {...balanceSheetData} />
    ).toBlob();

    const fileName = `Balance Sheet ${new Date().toISOString().split('T')[0]}.pdf`;
    saveAs(blob, fileName);

  } catch (error) {
    throw error;
  }
};

export default generateBalanceSheetPDF;