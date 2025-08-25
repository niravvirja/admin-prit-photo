
import { useState, useEffect, useMemo } from 'react';
import { Add01Icon } from 'hugeicons-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import ExpenseStats from './ExpenseStats';
import { useExpenses } from './hooks/useExpenses';
import ExpenseTableView from './ExpenseTableView';
import UniversalExportDialog from '@/components/common/UniversalExportDialog';
import { useExpenseExportConfig } from '@/hooks/useExportConfigs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EnhancedConfirmationDialog } from '@/components/ui/enhanced-confirmation-dialog';
import { PageTableSkeletonWithStats } from '@/components/ui/skeleton';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';

const ExpenseManagement = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });
  const { profile, currentFirmId } = useAuth();
  const { expenses, loading, loadExpenses } = useExpenses();
  const { toast } = useToast();
  const expenseExportConfig = useExpenseExportConfig();

  // Search, Sort & Filter
  const {
    searchValue,
    setSearchValue,
    currentSort,
    sortDirection,
    activeFilters,
    filteredAndSortedData: filteredExpenses,
    handleSortChange,
    handleSortDirectionToggle,
    handleFilterChange
  } = useSearchSortFilter({
    data: expenses,
    searchFields: ['description', 'category'],
    defaultSort: 'expense_date'
  });

  useEffect(() => {
    if (currentFirmId) {
      loadEvents();
    }
  }, [currentFirmId]);

  const loadEvents = async () => {
    if (!currentFirmId) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title')
        .eq('firm_id', currentFirmId);
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleExpenseCreated = () => {
    setCreateDialogOpen(false);
    loadExpenses();
  };

  const handleExpenseUpdated = () => {
    setEditDialogOpen(false);
    setEditingExpense(null);
    loadExpenses();
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setEditDialogOpen(true);
  };

  const handleDelete = async (expense: any) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Expense',
      description: `You are about to permanently delete this expense "${expense.description}". This action cannot be undone.`,
      onConfirm: async () => {
        if (submitting) return;
        
        setSubmitting(true);
        try {
          // First, try to delete from Google Sheets
          if (currentFirmId) {
            try {
              await supabase.functions.invoke('delete-item-from-google', {
                body: { 
                  itemType: 'expense', 
                  itemId: expense.id, 
                  firmId: currentFirmId 
                }
              });
              console.log('✅ Expense deleted from Google Sheets');
            } catch (sheetError) {
              console.warn('⚠️ Failed to delete from Google Sheets:', sheetError);
            }
          }

          // If this is a salary expense, also delete the corresponding freelancer/staff payment
          if (expense.category === 'Salary') {
            try {
              // Check if this expense has a corresponding freelancer payment
              const { data: freelancerPayments } = await supabase
                .from('freelancer_payments')
                .select('id')
                .eq('firm_id', currentFirmId)
                .eq('amount', expense.amount)
                .eq('payment_date', expense.expense_date);

              if (freelancerPayments && freelancerPayments.length > 0) {
                // Use the specialized sync function for salary payment deletion
                await supabase.functions.invoke('sync-salary-payments-to-google', {
                  body: {
                    paymentType: 'freelancer',
                    paymentId: freelancerPayments[0].id,
                    firmId: currentFirmId,
                    operation: 'delete'
                  }
                });

                await supabase
                  .from('freelancer_payments')
                  .delete()
                  .eq('id', freelancerPayments[0].id);
                console.log('✅ Corresponding freelancer payment deleted');
              }

              // Check if this expense has a corresponding staff payment
              const { data: staffPayments } = await supabase
                .from('staff_payments')
                .select('id')
                .eq('firm_id', currentFirmId)
                .eq('amount', expense.amount)
                .eq('payment_date', expense.expense_date);

              if (staffPayments && staffPayments.length > 0) {
                // Use the specialized sync function for salary payment deletion
                await supabase.functions.invoke('sync-salary-payments-to-google', {
                  body: {
                    paymentType: 'staff',
                    paymentId: staffPayments[0].id,
                    firmId: currentFirmId,
                    operation: 'delete'
                  }
                });

                await supabase
                  .from('staff_payments')
                  .delete()
                  .eq('id', staffPayments[0].id);
                console.log('✅ Corresponding staff payment deleted');
              }
            } catch (paymentError) {
              console.warn('⚠️ Failed to delete corresponding salary payment:', paymentError);
            }
          }

          const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expense.id);

          if (error) throw error;
          
          toast({
            title: "Expense Deleted",
            description: "Expense has been deleted from both database and Google Sheets",
          });
          loadExpenses();
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setSubmitting(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  // Get unique categories from expenses data
  const categoryOptions = useMemo(() => {
    const categories = [...new Set(expenses.map(e => e.category))];
    return categories.map(cat => ({ value: String(cat), label: String(cat) }));
  }, [expenses]);

  // Apply custom filters for has_event and payment_method
  const processedExpenses = useMemo(() => {
    let filtered = [...filteredExpenses];

    // Apply custom filters
    if (activeFilters.has_event === 'linked') {
      filtered = filtered.filter(e => e.event_id);
    } else if (activeFilters.has_event === 'general') {
      filtered = filtered.filter(e => !e.event_id);
    }

    // Apply payment method filter - treat everything except Cash as Digital
    if (activeFilters.payment_method?.length > 0) {
      filtered = filtered.filter(e => {
        const method = (e as any).payment_method;
        const isDigital = method !== 'Cash';
        return activeFilters.payment_method.includes(isDigital ? 'Digital' : 'Cash');
      });
    }

    return filtered;
  }, [filteredExpenses, activeFilters]);

  if (loading) {
    return <PageTableSkeletonWithStats />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        <div className="flex items-center gap-2">
          {expenses.length > 0 && (
            <UniversalExportDialog 
              data={expenses}
              config={expenseExportConfig}
            />
          )}
          <Button onClick={() => setCreateDialogOpen(true)} className="rounded-full p-3">
            <Add01Icon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ExpenseStats expenses={expenses} />

      {/* Search, Sort & Filter */}
      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search expenses by description, category..."
        sortOptions={[
          { key: 'expense_date', label: 'Date' },
          { key: 'amount', label: 'Amount' },
          { key: 'category', label: 'Category' },
          { key: 'created_at', label: 'Created Date' }
        ]}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        filterOptions={[
          {
            key: 'category',
            label: 'Expense Type',
            type: 'checkbox',
            options: categoryOptions
          },
          {
            key: 'payment_method',
            label: 'Payment Method',
            type: 'checkbox',
            options: [
              { value: 'Cash', label: 'Cash' },
              { value: 'Digital', label: 'Digital' }
            ]
          },
          {
            key: 'has_event',
            label: 'Event Linked',
            type: 'select',
            options: [
              { value: 'linked', label: 'Event Linked' },
              { value: 'general', label: 'General' }
            ]
          },
          {
            key: 'expense_date',
            label: 'Date',
            type: 'date'
          }
        ]}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />

      <ExpenseTableView
        expenses={processedExpenses}
        allExpenses={expenses}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddExpense={() => setCreateDialogOpen(true)}
      />

      <ExpenseFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onExpenseCreated={handleExpenseCreated}
      />

      <ExpenseFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onExpenseCreated={handleExpenseUpdated}
        expense={editingExpense}
        mode="edit"
      />
      
      <EnhancedConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant="destructive"
        confirmText="Delete Expense"
        requireTextConfirmation={true}
        confirmationKeyword="DELETE"
        loading={submitting}
      />
    </div>
  );
};

export default ExpenseManagement;
