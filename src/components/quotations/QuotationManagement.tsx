import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Add01Icon } from 'hugeicons-react';
import { FileText } from 'lucide-react';
import { Quotation, EventType } from '@/types/studio';
import QuotationCardGrid from './QuotationCardGrid';
import CustomizableQuotationBuilder from './CustomizableQuotationBuilder';
import { useQuotations } from './hooks/useQuotations';
import { EnhancedConfirmationDialog } from '@/components/ui/enhanced-confirmation-dialog';

import QuotationFormDialog from './QuotationFormDialog';
import { EmptyState } from '@/components/ui/empty-state';
import QuotationStats from './QuotationStats';
import { useFirmData } from '@/hooks/useFirmData';
import UniversalExportDialog from '@/components/common/UniversalExportDialog';
import { useQuotationExportConfig } from '@/hooks/useQuotationExportConfig';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';

interface QuotationFormData {
  title: string;
  client_id: string;
  event_type: EventType;
  event_date: string;
  venue: string;
  description: string;
  valid_until: string;
}

// Helper function to check if quotation is expired
const isExpired = (validUntil: string | null) => {
  if (!validUntil) return false;
  return new Date(validUntil) < new Date();
};

const QuotationManagement = () => {
  const { profile, currentFirmId } = useAuth();
  const { quotations, clients, loading, loadQuotations, deleteQuotation, confirmDialog, setConfirmDialog } = useQuotations();
  const { firmData } = useFirmData();
  const [events, setEvents] = useState<any[]>([]);
  const quotationExportConfig = useQuotationExportConfig(events);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [formData, setFormData] = useState<QuotationFormData>({
    title: '',
    client_id: '',
    event_type: 'Wedding',
    event_date: '',
    venue: '',
    description: '',
    valid_until: ''
  });
  const { toast } = useToast();

  // Search, Sort & Filter
  const {
    searchValue,
    setSearchValue,
    currentSort,
    sortDirection,
    activeFilters,
    filteredAndSortedData: filteredQuotations,
    handleSortChange,
    handleSortDirectionToggle,
    handleFilterChange
  } = useSearchSortFilter({
    data: quotations,
    searchFields: ['title', 'venue', 'description'],
    defaultSort: 'created_at'
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
        .select('id, title, event_date')
        .eq('firm_id', currentFirmId);
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleSubmit = async (formData: any) => {
    if (!formData.title.trim() || !formData.client_id || !formData.event_date) {
      toast({
        title: "Validation Error",
        description: "Title, client, and event date are required fields",
        variant: "destructive",
      });
      return;
    }

    if (!currentFirmId) {
      toast({
        title: "Error",
        description: "No firm selected",
        variant: "destructive",
      });
      return;
    }

    const processedFormData = {
      ...formData,
      event_date: formData.event_date instanceof Date 
        ? `${formData.event_date.getFullYear()}-${String(formData.event_date.getMonth() + 1).padStart(2, '0')}-${String(formData.event_date.getDate()).padStart(2, '0')}`
        : formData.event_date,
      valid_until: formData.valid_until instanceof Date 
        ? `${formData.valid_until.getFullYear()}-${String(formData.valid_until.getMonth() + 1).padStart(2, '0')}-${String(formData.valid_until.getDate()).padStart(2, '0')}`
        : formData.valid_until || ''
    };

    setFormData(processedFormData);
    setIsDialogOpen(false);
    setShowBuilder(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setEditingQuotation(quotation);
    setFormData({
      title: quotation.title,
      client_id: quotation.client_id || '',
      event_type: quotation.event_type,
      event_date: quotation.event_date,
      venue: quotation.venue || '',
      description: quotation.description || '',
      valid_until: quotation.valid_until || ''
    });
    setIsEditingMode(true);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      client_id: '',
      event_type: 'Wedding',
      event_date: '',
      venue: '',
      description: '',
      valid_until: ''
    });
    setEditingQuotation(null);
    setIsEditingMode(false);
  };

  const handleNewQuotation = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Apply basic filtering and process custom filters
  const processedQuotations = useMemo(() => {
    // Start with filtered quotations from search/sort hook
    let filtered = filteredQuotations.filter(q => 
      !q.converted_to_event && !isExpired(q.valid_until)
    );

    // Apply custom filters
    if (activeFilters.amount_range) {
      const range = activeFilters.amount_range;
      filtered = filtered.filter(q => {
        const amount = q.amount || 0;
        switch (range) {
          case 'under_25000': return amount < 25000;
          case '25000_50000': return amount >= 25000 && amount <= 50000;
          case '50000_100000': return amount >= 50000 && amount <= 100000;
          case 'above_100000': return amount > 100000;
          default: return true;
        }
      });
    }

    return filtered;
  }, [filteredQuotations, activeFilters]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!currentFirmId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quotations</h1>
        </div>
        <EmptyState
          icon={FileText}
          title="No Firm Selected"
          description="Please select a firm to view and manage quotations."
        />
      </div>
    );
  }

  if (showBuilder) {
    return (
      <CustomizableQuotationBuilder
        formData={formData}
        editingQuotation={editingQuotation}
        onBack={() => {
          setShowBuilder(false);
          if (editingQuotation) {
            resetForm();
          } else {
            setIsDialogOpen(true);
          }
        }}
        onComplete={() => {
          setShowBuilder(false);
          resetForm();
          loadQuotations();
        }}
      />
    );
  }

  const activeQuotations = quotations.filter(q => !q.converted_to_event);
  const expiredQuotations = activeQuotations.filter(q => isExpired(q.valid_until));

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quotations</h1>
        <div className="flex items-center gap-2">
          {quotations.length > 0 && (
            <UniversalExportDialog 
              data={processedQuotations}
              config={quotationExportConfig}
            />
          )}
          <QuotationFormDialog
            clients={clients}
            isOpen={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                resetForm();
              }
            }}
            onSubmit={handleSubmit}
            onNewQuotation={handleNewQuotation}
            editingQuotation={isEditingMode ? editingQuotation : null}
            formData={isEditingMode ? formData : undefined}
          />
        </div>
      </div>

      <QuotationStats quotations={quotations} />

      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search quotations by title, client..."
        sortOptions={[
          { key: 'created_at', label: 'Date Created' },
          { key: 'amount', label: 'Amount' },
          { key: 'event_date', label: 'Event Date' },
          { key: 'valid_until', label: 'Validity Date' }
        ]}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        filterOptions={[
          {
            key: 'event_type',
            label: 'Event Type',
            type: 'checkbox',
            options: [
              { value: 'Ring Ceremony', label: 'Ring Ceremony' },
              { value: 'Pre Wedding', label: 'Pre Wedding' },
              { value: 'Wedding', label: 'Wedding' },
              { value: 'Maternity Photography', label: 'Maternity Photography' },
              { value: 'Others', label: 'Others' }
            ]
          },
          {
            key: 'valid_until',
            label: 'Validity Date',
            type: 'date'
          },
          {
            key: 'amount_range',
            label: 'Price Range',
            type: 'select',
            options: [
              { value: 'under_25000', label: 'Under ₹25,000' },
              { value: '25000_50000', label: '₹25,000 - ₹50,000' },
              { value: '50000_100000', label: '₹50,000 - ₹1,00,000' },
              { value: 'above_100000', label: 'Above ₹1,00,000' }
            ]
          }
        ]}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />

      {processedQuotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Active Quotations"
          description={searchValue || Object.keys(activeFilters).length > 0 
            ? "No quotations match your search criteria. Try adjusting your filters." 
            : "All quotations have been confirmed or start managing your quotes by creating your first quotation."
          }
          action={{
            label: "Add Quotation",
            onClick: handleNewQuotation
          }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedQuotations.map((quotation) => (
            <QuotationCardGrid
              key={quotation.id}
              quotation={quotation}
              onUpdate={loadQuotations}
              onEdit={handleEditQuotation}
              onDelete={deleteQuotation}
              firmData={firmData}
            />
          ))}
        </div>
      )}

      <EnhancedConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        requireTextConfirmation={confirmDialog.requireTextConfirmation}
        confirmationKeyword={confirmDialog.confirmationKeyword}
        loading={confirmDialog.loading}
        confirmText={confirmDialog.loading ? "Processing..." : "Confirm"}
      />
    </div>
  );
};

export default QuotationManagement;
