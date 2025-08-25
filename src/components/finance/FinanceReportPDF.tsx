import React from 'react';
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { SharedPDFHeader, SharedPDFFooter, sharedStyles, SimpleTable } from '@/components/pdf/SharedPDFLayout';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/date-utils';
import { parsePaymentMethod } from '@/lib/payment-method-validator';

interface FinanceReportProps {
  stats: any;
  timeRange: string;
  firmData?: any;
  paymentInDetails?: any[];
  paymentOutDetails?: any[];
}

const FinanceReportDocument: React.FC<FinanceReportProps> = ({ 
  stats, 
  timeRange, 
  firmData,
  paymentInDetails = [],
  paymentOutDetails = []
}) => {
  const formatCurrency = (amount: number) => `₹${amount?.toLocaleString() || '0'}`;
  const currentDate = formatDate(new Date());

  const getTimeRangeText = () => {
    switch (timeRange) {
      case 'global': return 'All Time';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      case 'custom': return 'Custom Range';
      default: return timeRange.charAt(0).toUpperCase() + timeRange.slice(1);
    }
  };

  // Prepare payment in table data - FIXED LABELS
  const paymentInTableData = paymentInDetails.slice(0, 25).map(payment => [
    formatDate(new Date(payment.date)),
    payment.source || 'N/A',
    formatCurrency(payment.amount || 0),
    payment.type === 'advance' ? 'Advance' : 
    payment.type === 'accounting_credit' ? 'Accounting' : 'Payment'
  ]);

  // Prepare payment out table data - FIXED LABELS 
  const paymentOutTableData = paymentOutDetails.slice(0, 25).map(payment => [
    formatDate(new Date(payment.date)),
    payment.description || 'N/A',
    formatCurrency(payment.amount || 0),
    payment.type === 'expense' ? 'Expense' : 
    payment.type === 'accounting_debit' ? 'Accounting' :
    payment.type === 'staff_payment' ? 'Staff' : 'Freelancer'
  ]);

  // Compute totals and payment method breakdown (includes accounting entries)
  const paymentInTotal = paymentInDetails.reduce((sum, p) => sum + (p.amount || 0), 0);
  const paymentOutTotal = paymentOutDetails.reduce((sum, p) => sum + (p.amount || 0), 0);
  const cashIn = paymentInDetails.reduce((sum, p) => sum + (parsePaymentMethod(p.payment_method) === 'Cash' ? (p.amount || 0) : 0), 0);
  const digitalIn = paymentInDetails.reduce((sum, p) => sum + (parsePaymentMethod(p.payment_method) === 'Cash' ? 0 : (p.amount || 0)), 0);
  const cashOut = paymentOutDetails.reduce((sum, p) => sum + (parsePaymentMethod(p.payment_method) === 'Cash' ? (p.amount || 0) : 0), 0);
  const digitalOut = paymentOutDetails.reduce((sum, p) => sum + (parsePaymentMethod(p.payment_method) === 'Cash' ? 0 : (p.amount || 0)), 0);

  const isMultiPage = paymentInDetails.length > 0 || paymentOutDetails.length > 0;

  return (
    <Document>
      {/* Page 1: Header + Financial Summary */}
      <Page size="A4" style={sharedStyles.page}>
        <SharedPDFHeader firmData={firmData} />

        <Text style={sharedStyles.title}>Financial Report</Text>

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
              <Text style={sharedStyles.detailValue}>{getTimeRangeText()}</Text>
            </View>
          </View>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Financial Summary</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Total Revenue:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(paymentInTotal)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Net Profit:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(paymentInTotal - paymentOutTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Payment Summary</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Payments In:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(paymentInTotal)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Payments Out:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(paymentOutTotal)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Pending Amount:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(stats?.pendingAmount || 0)}</Text>
            </View>
          </View>
        </View>

        <View style={sharedStyles.detailsContainer}>
          <View style={sharedStyles.column}>
            <Text style={sharedStyles.sectionTitle}>Payment Method Breakdown</Text>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Cash In:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(cashIn)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Digital In:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(digitalIn)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Cash Out:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(cashOut)}</Text>
            </View>
            <View style={sharedStyles.detailRow}>
              <Text style={sharedStyles.detailLabel}>Digital Out:</Text>
              <Text style={sharedStyles.detailValue}>{formatCurrency(digitalOut)}</Text>
            </View>
          </View>
        </View>

        {!isMultiPage && <SharedPDFFooter firmData={firmData} />}
      </Page>

      {/* Page 2: Payment In Details */}
      {paymentInDetails.length > 0 && (
        <Page size="A4" style={sharedStyles.page}>
          <Text style={sharedStyles.title}>Payments In Details</Text>

          <SimpleTable
            headers={['Date', 'Source/Event', 'Amount', 'Type']}
            rows={paymentInTableData}
          />
        </Page>
      )}

      {/* Page 3: Payment Out Details */}
      {paymentOutDetails.length > 0 && (
        <Page size="A4" style={sharedStyles.page}>
          <Text style={sharedStyles.title}>Payments Out Details</Text>

          <SimpleTable
            headers={['Date', 'Description', 'Amount', 'Type']}
            rows={paymentOutTableData}
          />

          {/* Payment Breakdown Summary */}
          <View style={sharedStyles.detailsContainer}>
            <View style={sharedStyles.column}>
              <Text style={sharedStyles.sectionTitle}>Payment Breakdown</Text>
              <View style={sharedStyles.detailRow}>
                <Text style={sharedStyles.detailLabel}>Total Expenses:</Text>
                <Text style={sharedStyles.detailValue}>
                  {formatCurrency(paymentOutDetails.reduce((sum, p) => sum + (p.amount || 0), 0))}
                </Text>
              </View>
              <View style={sharedStyles.detailRow}>
                <Text style={sharedStyles.detailLabel}>Expense Categories:</Text>
                <Text style={sharedStyles.detailValue}>
                  {[...new Set(paymentOutDetails.map(p => p.description.split(':')[0]))].join(', ')}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer only on last page */}
          <SharedPDFFooter firmData={firmData} />
        </Page>
      )}
    </Document>
  );
};

export const generateFinanceReportPDF = async (
  stats: any,
  timeRange: string,
  firmData?: any,
  customStartDate?: string
) => {
  try {
    const firmId = localStorage.getItem('selectedFirmId');
    
    // Fetch firm data if not provided
    if (!firmData) {
      if (firmId) {
        const { data: firm } = await supabase
          .from('firms')
          .select('*')
          .eq('id', firmId)
          .single();
        firmData = firm;
      }
    }

    // Fetch detailed payment data for the report
    let startDate: Date;
    let endDate: Date = new Date();
    let isGlobal = false;

    if (timeRange === 'custom' && customStartDate) {
      startDate = new Date(customStartDate);
      endDate = new Date();
    } else if (timeRange === 'global') {
      isGlobal = true;
    } else {
      // Calculate date range based on timeRange
      const now = new Date();
      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          isGlobal = true;
      }
    }

    // Fetch Payment In details (payments + advance amounts)
    const paymentInDetails: any[] = [];
    
    // Get payments
    let paymentsQuery = supabase
      .from('payments')
      .select('amount, payment_date, event_id, payment_method')
      .eq('firm_id', firmId);

    if (!isGlobal && startDate) {
      paymentsQuery = paymentsQuery
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .lte('payment_date', endDate.toISOString().split('T')[0]);
    }

    const { data: payments } = await paymentsQuery;
    
    // Get event titles for payments
    const { data: allEvents } = await supabase
      .from('events')
      .select('id, title')
      .eq('firm_id', firmId);
    
    payments?.forEach(payment => {
      const event = allEvents?.find(e => e.id === payment.event_id);
      paymentInDetails.push({
        date: payment.payment_date,
        source: event?.title || 'General Payment',
        amount: payment.amount,
        payment_method: payment.payment_method,
        type: 'payment'
      });
    });

    // Get events with advance amounts (only if no payments exist for that event)
    let eventsQuery = supabase
      .from('events')
      .select('title, event_date, advance_amount, advance_payment_method, id')
      .eq('firm_id', firmId)
      .gt('advance_amount', 0);

    if (!isGlobal && startDate) {
      eventsQuery = eventsQuery
        .gte('event_date', startDate.toISOString().split('T')[0])
        .lte('event_date', endDate.toISOString().split('T')[0]);
    }

    const { data: events } = await eventsQuery;
    
    events?.forEach(event => {
      // ALWAYS add advance amounts to financial report
      if (event.advance_amount && event.advance_amount > 0) {
        paymentInDetails.push({
          date: event.event_date,
          source: `${event.title} (Advance)`,
          amount: event.advance_amount,
          payment_method: event.advance_payment_method,
          type: 'advance'
        });
      }
    });

    // Fetch Payment Out details (EXPENSES ONLY - no double counting of salary)
    const paymentOutDetails: any[] = [];

    // Get expenses ONLY (salary payments should be recorded as expenses to avoid duplication)
    let expensesQuery = supabase
      .from('expenses')
      .select('amount, expense_date, description, category, payment_method')
      .eq('firm_id', firmId);

    if (!isGlobal && startDate) {
      expensesQuery = expensesQuery
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0]);
    }

    const { data: expenses } = await expensesQuery;
    
    expenses?.forEach(expense => {
      paymentOutDetails.push({
        date: expense.expense_date,
        description: `${expense.category}: ${expense.description}`,
        amount: expense.amount,
        payment_method: expense.payment_method,
        type: 'expense'
      });
    });

    // Include accounting entries marked reflect_to_company = true - INCLUDE payment_method
    let accQuery = supabase
      .from('accounting_entries')
      .select('amount, entry_date, title, category, entry_type, reflect_to_company, payment_method')
      .eq('firm_id', firmId)
      .eq('reflect_to_company', true);

    if (!isGlobal && startDate) {
      accQuery = accQuery
        .gte('entry_date', startDate.toISOString().split('T')[0])
        .lte('entry_date', endDate.toISOString().split('T')[0]);
    }

    const { data: accEntries, error: accError } = await accQuery;
    
    if (accError) {
      console.warn('Error fetching accounting entries for PDF:', accError);
      // Continue without accounting entries if there's an error
    } else {
      accEntries?.forEach((entry: any) => {
        if (entry.entry_type === 'Credit') {
          paymentInDetails.push({
            date: entry.entry_date,
            source: `${entry.category} - ${entry.title}`,
            amount: entry.amount,
            payment_method: entry.payment_method || 'Cash', // 🔥 FIXED: Use actual payment_method
            type: 'accounting_credit'
          });
        } else if (entry.entry_type === 'Debit') {
          paymentOutDetails.push({
            date: entry.entry_date,
            description: `${entry.category} - ${entry.title}`,
            amount: entry.amount,
            payment_method: entry.payment_method || 'Cash', // 🔥 FIXED: Use actual payment_method
            type: 'accounting_debit'
          });
        }
      });
    }

    // Sort details by date
    paymentInDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    paymentOutDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Generate PDF
    const blob = await pdf(
      <FinanceReportDocument 
        stats={stats} 
        timeRange={timeRange}
        firmData={firmData}
        paymentInDetails={paymentInDetails}
        paymentOutDetails={paymentOutDetails}
      />
    ).toBlob();

    // Save the PDF
    const fileName = `Finance Report ${timeRange ? timeRange.charAt(0).toUpperCase() + timeRange.slice(1) : ''} ${new Date().toISOString().split('T')[0]}.pdf`;
    saveAs(blob, fileName);

  } catch (error) {
    throw error;
  }
};

export default generateFinanceReportPDF;