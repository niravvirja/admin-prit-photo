import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit01Icon, Delete02Icon, File01Icon, MoneyBag01Icon, MoneyReceive01Icon, WalletAdd01Icon, Building06Icon } from 'hugeicons-react';
import { useAccountingEntries } from '@/hooks/useAccountingEntries';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageSkeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AccountingEntryDialog } from './AccountingEntryDialog';
import { EnhancedConfirmationDialog } from '@/components/ui/enhanced-confirmation-dialog';
import StatsGrid from '@/components/ui/stats-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import type { SortOption, FilterOption } from '@/components/common/SearchSortFilter';

const CATEGORIES = [
  'Equipment',
  'Travel', 
  'Accommodation',
  'Food',
  'Marketing',
  'Software',
  'Maintenance',
  'Salary',
  'Office Supplies',
  'Insurance',
  'Legal',
  'Consulting',
  'Utilities',
  'Rent',
  'Other'
];

const ENTRY_TYPES = ['Credit', 'Debit'];
const PAYMENT_METHODS = ['Cash', 'Digital',];

export const AccountingManagement = () => {
  const { entries, loading, deleteEntry, refetch } = useAccountingEntries();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  
  // Search, Sort, Filter state
  const [searchValue, setSearchValue] = useState('');
  const [currentSort, setCurrentSort] = useState('entry_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({
    category: '',
    entry_type: '',
    payment_method: ''
  });

  // Search, sort, and filter logic
  const processedEntries = useMemo(() => {
    let filtered = entries;

    // Apply search
    if (searchValue.trim()) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.title?.toLowerCase().includes(search) ||
        entry.description?.toLowerCase().includes(search) ||
        entry.category?.toLowerCase().includes(search) ||
        entry.payment_method?.toLowerCase().includes(search)
      );
    }

    // Apply filters
    if (activeFilters.category) {
      filtered = filtered.filter(entry => entry.category === activeFilters.category);
    }
    if (activeFilters.entry_type) {
      filtered = filtered.filter(entry => entry.entry_type === activeFilters.entry_type);
    }
    if (activeFilters.payment_method) {
      filtered = filtered.filter(entry => entry.payment_method === activeFilters.payment_method);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (currentSort) {
        case 'entry_date':
          aValue = new Date(a.entry_date);
          bValue = new Date(b.entry_date);
          break;
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'amount':
          aValue = Number(a.amount || 0);
          bValue = Number(b.amount || 0);
          break;
        case 'category':
          aValue = a.category?.toLowerCase() || '';
          bValue = b.category?.toLowerCase() || '';
          break;
        default:
          aValue = a[currentSort];
          bValue = b[currentSort];
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [entries, searchValue, activeFilters, currentSort, sortDirection]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const totalCredits = entries
      .filter(entry => entry.entry_type === 'Credit')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    
    const totalDebits = entries
      .filter(entry => entry.entry_type === 'Debit')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    return {
      totalCredits,
      totalDebits,
      netWorth: totalCredits - totalDebits,
      totalEntries: entries.length
    };
  }, [entries]);

  // Sort and filter options
  const sortOptions: SortOption[] = [
    { key: 'entry_date', label: 'Date' },
    { key: 'title', label: 'Title' },
    { key: 'amount', label: 'Amount' },
    { key: 'category', label: 'Category' }
  ];

  const filterOptions: FilterOption[] = [
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: CATEGORIES.map(cat => ({ value: cat, label: cat }))
    },
    {
      key: 'entry_type',
      label: 'Entry Type',
      type: 'select',
      options: ENTRY_TYPES.map(type => ({ value: type, label: type }))
    },
    {
      key: 'payment_method',
      label: 'Payment Method',
      type: 'select',
      options: PAYMENT_METHODS.map(method => ({ value: method, label: method }))
    }
  ];

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry(id);
      toast({
        title: "Success",
        description: "Accounting entry deleted successfully",
      });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete accounting entry",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      'Equipment': 'text-category-equipment',
      'Travel': 'text-category-travel',
      'Accommodation': 'text-category-accommodation',
      'Food': 'text-category-food',
      'Marketing': 'text-category-marketing',
      'Software': 'text-category-software',
      'Maintenance': 'text-category-maintenance',
      'Salary': 'text-category-salary',
      'Office Supplies': 'text-category-other',
      'Insurance': 'text-category-other',
      'Legal': 'text-category-other',
      'Consulting': 'text-category-other',
      'Utilities': 'text-category-other',
      'Rent': 'text-category-other',
      'Other': 'text-category-other'
    };
    return colorMap[category] || 'text-category-other';
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
        </div>
        <AccountingEntryDialog onSuccess={refetch} />
      </div>

      {/* Stats Grid */}
      <StatsGrid
        stats={[
          {
            title: "Total Credits",
            value: `₹${overallStats.totalCredits.toLocaleString('en-IN')}`,
            icon: <MoneyReceive01Icon className="w-4 h-4" />,
            colorClass: "bg-green-50 text-green-600"
          },
          {
            title: "Total Debits", 
            value: `₹${overallStats.totalDebits.toLocaleString('en-IN')}`,
            icon: <MoneyBag01Icon className="w-4 h-4" />,
            colorClass: "bg-red-50 text-red-600"
          },
          {
            title: "Net Worth",
            value: `₹${overallStats.netWorth.toLocaleString('en-IN')}`,
            icon: <WalletAdd01Icon className="w-4 h-4" />,
            colorClass: overallStats.netWorth >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          },
          {
            title: "Total Entries",
            value: overallStats.totalEntries.toString(),
            icon: <Building06Icon className="w-4 h-4" />,
            colorClass: "bg-primary/20 text-primary"
          }
        ]}
      />

      {/* Search, Sort, Filter */}
      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortOptions={sortOptions}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={setCurrentSort}
        onSortDirectionToggle={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        searchPlaceholder="Search entries..."
      />

      <div className="text-sm text-muted-foreground">
        Showing {processedEntries.length} of {entries.length} entries
      </div>

      {/* Entries Display */}
      {processedEntries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={entries.length === 0 ? 'No Accounting Entries Yet' : 'No Entries Found'}
          description={entries.length === 0 
            ? 'Start tracking your financial records by adding your first accounting entry.'
            : 'No entries match your current search criteria. Try adjusting your filters or search terms.'
          }
          action={entries.length === 0 ? {
            label: "Add Entry",
            onClick: () => {}
          } : undefined}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">Title</TableHead>
                  <TableHead className="text-center">Category</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                  <TableHead className="text-center">Payment Method</TableHead>
                  <TableHead className="text-center">Reflect to Company</TableHead>
                  <TableHead className="text-center">Document</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/25">
                    <TableCell className="text-center">
                      <div className="font-medium">
                        {format(new Date(entry.entry_date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium">{entry.title}</div>
                      {entry.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {entry.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${getCategoryColor(entry.category)}`}>
                        {entry.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${
                        entry.entry_type === 'Credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.entry_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${
                        entry.entry_type === 'Credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.entry_type === 'Credit' ? '+' : '-'}₹{Number(entry.amount).toLocaleString('en-IN')}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {entry.payment_method || 'Cash'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                        entry.reflect_to_company 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {entry.reflect_to_company ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.document_url && entry.document_url.trim() !== '' ? (
                        <Button
                          variant="action-neutral"
                          size="sm"
                          onClick={() => {
                            window.open(entry.document_url, '_blank');
                          }}
                          className="h-8 w-8 p-0 rounded-full"
                          title="View document"
                        >
                          <File01Icon className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">~</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <AccountingEntryDialog 
                          entry={entry}
                          onSuccess={refetch}
                          trigger={
                            <Button
                              variant="action-edit"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              title="Edit entry"
                            >
                              <Edit01Icon className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="action-delete"
                          size="sm"
                          onClick={() => openDeleteDialog(entry.id)}
                          className="h-8 w-8 p-0 rounded-full"
                          title="Delete entry"
                        >
                          <Delete02Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {processedEntries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className={`text-lg font-bold mb-1 ${
                        entry.entry_type === 'Credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.entry_type === 'Credit' ? '+' : '-'}₹{Number(entry.amount).toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm font-medium text-foreground mb-1">
                        {entry.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(entry.entry_date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {entry.document_url && entry.document_url.trim() !== '' && (
                        <Button
                          variant="action-neutral"
                          size="sm"
                          onClick={() => {
                            window.open(entry.document_url, '_blank');
                          }}
                          className="h-8 w-8 p-0 rounded-full"
                          title="View document"
                        >
                          <File01Icon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <AccountingEntryDialog 
                        entry={entry}
                        onSuccess={refetch}
                        trigger={
                          <Button
                            variant="action-edit"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full"
                            title="Edit entry"
                          >
                            <Edit01Icon className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="action-delete"
                        size="sm"
                        onClick={() => openDeleteDialog(entry.id)}
                        className="h-8 w-8 p-0 rounded-full"
                        title="Delete entry"
                      >
                        <Delete02Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                    <div>
                      <div className="text-xs text-muted-foreground">Category</div>
                      <span className={`text-sm font-medium ${getCategoryColor(entry.category)}`}>
                        {entry.category}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Type</div>
                      <span className={`text-sm font-medium ${
                        entry.entry_type === 'Credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.entry_type}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Payment Method</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.payment_method || 'Cash'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Reflect to Company</div>
                      <div className={`text-sm font-medium px-2 py-1 rounded-full inline-block ${
                        entry.reflect_to_company 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {entry.reflect_to_company ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <EnhancedConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => entryToDelete && handleDeleteEntry(entryToDelete)}
        title="Delete Accounting Entry"
        description="Are you sure you want to delete this accounting entry? This action cannot be undone and will permanently remove the entry from your records."
        confirmText="Delete Entry"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};