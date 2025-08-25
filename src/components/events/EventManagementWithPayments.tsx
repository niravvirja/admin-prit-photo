import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Add01Icon, RefreshIcon, Download01Icon, Calendar01Icon } from 'hugeicons-react';

import { Event, TaskFromDB, convertDbTaskToTask } from '@/types/studio';
import CleanEventFormDialog from './CleanEventFormDialog';
import EventPaymentCard from '@/components/payments/EventPaymentCard';
import EventStats from './EventStats';
import { PageSkeleton } from '@/components/ui/skeleton';
import PaymentCard from '@/components/payments/PaymentCard';
import { useToast } from '@/hooks/use-toast';
import { generatePaymentInvoicePDF } from '@/components/payments/PaymentInvoicePDFRenderer';
import { shareEventDetails } from '@/lib/event-share-utils';
import { useFirmData } from '@/hooks/useFirmData';
import ShareOptionsDialog from '@/components/common/ShareOptionsDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EventDeleteConfirmation } from './EventDeleteConfirmation';
import UniversalExportDialog from '@/components/common/UniversalExportDialog';
import { useEventExportConfig } from '@/hooks/useExportConfigs';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';
import { calculateTotalPaid } from '@/lib/payment-calculator';


const EventManagementWithPayments = () => {
  const { profile, currentFirmId } = useAuth();
  const eventExportConfig = useEventExportConfig();
  const [events, setEvents] = useState<Event[]>([]);
  const [optimisticallyDeletedEvents, setOptimisticallyDeletedEvents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedEventForShare, setSelectedEventForShare] = useState<Event | null>(null);
  const [selectedEventForPayment, setSelectedEventForPayment] = useState<Event | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  
  const { toast } = useToast();
  const { firmData } = useFirmData();
  
  // Search, Sort, Filter functionality
  const {
    searchValue,
    setSearchValue,
    currentSort,
    sortDirection,
    activeFilters,
    filteredAndSortedData,
    handleSortChange,
    handleSortDirectionToggle,
    handleFilterChange
  } = useSearchSortFilter({
    data: events,
    searchFields: ['title', 'venue'],
    defaultSort: 'event_date',
    defaultSortDirection: 'desc'
  });

  useEffect(() => {
    if (currentFirmId) {
      loadEvents();
      
      // Set up real-time listeners for payments and closing balances
      const paymentsChannel = supabase
        .channel('payments-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `firm_id=eq.${currentFirmId}`
        }, () => {
          console.log('Payment changed, reloading events...');
          loadEvents();
        })
        .subscribe();

      const closingBalancesChannel = supabase
        .channel('closing-balances-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'event_closing_balances',
          filter: `firm_id=eq.${currentFirmId}`
        }, () => {
          console.log('Closing balance changed, reloading events...');
          loadEvents();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(paymentsChannel);
        supabase.removeChannel(closingBalancesChannel);
      };
    }
  }, [currentFirmId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          client:clients(*),
          quotation_source:quotations(
            id,
            title,
            quotation_details,
            amount,
            event_date
          ),
          event_staff_assignments(
            staff_id,
            freelancer_id,
            role,
            day_number,
            profiles(full_name),
            freelancer:freelancers(full_name)
          ),
          tasks(*, assigned_staff:profiles!tasks_assigned_to_fkey(full_name), freelancer:freelancers(full_name))
        `)
        .eq('firm_id', currentFirmId)
        .order('event_date', { ascending: false });

      // Separately fetch payments and closing balances to avoid relationship conflicts
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('firm_id', currentFirmId);

      const { data: closingBalancesData } = await supabase
        .from('event_closing_balances')
        .select('*')
        .eq('firm_id', currentFirmId);

      if (error) {
        throw error;
      }

      // Convert the database tasks to proper Task objects and add quotation details
      const processedEvents = data?.map(event => {
        // Handle quotation_source properly - it could be an array or null
        let quotationDetails = null;
        let quotationSource = null;
        
        if (event.quotation_source) {
          if (Array.isArray(event.quotation_source) && event.quotation_source.length > 0) {
            quotationSource = event.quotation_source[0];
            quotationDetails = quotationSource.quotation_details;
          } else if (!Array.isArray(event.quotation_source)) {
            quotationSource = event.quotation_source;
            quotationDetails = (event.quotation_source as any).quotation_details;
          }
        }

        // Find payments for this event
        const eventPayments = paymentsData?.filter(payment => payment.event_id === event.id) || [];
        
        // Find closing balances for this event
        const eventClosingBalances = closingBalancesData?.filter(balance => balance.event_id === event.id) || [];

        console.log(`Processing event "${event.title}": closing_balances=${eventClosingBalances.length}, payments=${eventPayments.length}`);

        return {
          ...event,
          quotation_details: quotationDetails,
          quotation_source: quotationSource,
          payments: eventPayments,
          event_closing_balances: eventClosingBalances, // CRITICAL: Properly assign closing balances
          tasks: event.tasks?.map((task: TaskFromDB) => convertDbTaskToTask(task)) || []
        };
      }) || [];
      
      setEvents(processedEvents as any);
      
      // Clear optimistically deleted events that are no longer in the database
      setOptimisticallyDeletedEvents(prev => {
        const currentEventIds = new Set(processedEvents.map(e => e.id));
        const stillDeleted = new Set<string>();
        prev.forEach(deletedId => {
          if (!currentEventIds.has(deletedId)) {
            stillDeleted.add(deletedId);
          }
        });
        return stillDeleted;
      });
      
    } catch (error: any) {
      toast({
        title: "Error loading events",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setOptimisticallyDeletedEvents(new Set()); // Clear optimistic deletions on refresh
    await loadEvents();
    setRefreshing(false);
    toast({
      title: "Events refreshed",
      description: "Event data has been updated successfully.",
    });
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    // Don't clear editing event immediately to prevent race conditions
    setTimeout(() => {
      setEditingEvent(null);
    }, 300);
  };

  const handlePaymentRecord = (event: Event) => {
    setSelectedEventForPayment(event);
    setPaymentDialogOpen(true);
  };

  const handlePaymentCollected = () => {
    loadEvents();
    setPaymentDialogOpen(false);
    setSelectedEventForPayment(null);
  };

  const handleDownloadInvoice = async (event: Event) => {
    try {
      // Generate proper invoice ID for this event
      const { data: invoiceId } = await supabase.rpc('generate_invoice_id', { p_event_id: event.id });
      
      const paymentData = {
        id: `event-${event.id}`,
        event_id: event.id,
        amount: event.total_amount || 0,
        payment_method: 'Cash' as const,
        payment_date: new Date().toISOString(),
        invoice_id: invoiceId,
        event: event,
        firm_id: event.firm_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await generatePaymentInvoicePDF(paymentData, firmData);
      if (result.success) {
        toast({
          title: "Invoice downloaded",
          description: "The payment invoice has been downloaded successfully.",
        });
      } else {
        throw new Error('PDF generation failed');
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the invoice.",
        variant: "destructive",
      });
    }
  };

  const handleShare = (event: Event) => {
    setSelectedEventForShare(event);
    setShareDialogOpen(true);
  };

  const handleDirectToClient = async () => {
    if (!selectedEventForShare) return;
    
    if (!selectedEventForShare.client?.phone) {
      toast({
        title: "No Phone Number",
        description: "Client doesn't have a phone number for WhatsApp sharing.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await shareEventDetails(selectedEventForShare, firmData, 'direct');
      if (result.success) {
        toast({
          title: "Sent to Client!",
          description: `Event details sent to ${selectedEventForShare.client.name} via WhatsApp`
        });
      } else {
        toast({
          title: "WhatsApp Error", 
          description: result.error || "Failed to send event details to client",
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send event details to client';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleCustomShare = async () => {
    if (!selectedEventForShare) return;
    
    try {
      const result = await shareEventDetails(selectedEventForShare, firmData, 'custom');
      if (result.success) {
        let title = "Shared Successfully!";
        let description = "Event details shared successfully";
        
        if ('method' in result) {
          const shareResult = result as any;
          if (shareResult.method === 'download') {
            title = "Download Complete!";
            description = "Event PDF downloaded successfully";
          } else if (shareResult.method === 'text_share_with_download') {
            title = "Shared with PDF!";
            description = "Event details shared and PDF downloaded for manual sharing";
          }
        }
        
        toast({
          title,
          description
        });
      } else {
        throw new Error('Share failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to share event details",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
  };

  const handleOptimisticDelete = (eventId: string) => {
    setOptimisticallyDeletedEvents(prev => new Set([...prev, eventId]));
  };

  const handleEventDeleted = () => {
    // This will be called after background processes complete to refresh data
    loadEvents();
    setEventToDelete(null);
  };

  // Helper function to check crew completeness - defined before usage
  const checkEventCrewCompleteness = (event: Event) => {
    const eventWithStaff = event as any;
    
    // If no quotation details, consider it complete (not incomplete)
    const quotationDetails = eventWithStaff.quotation_details;
    if (!quotationDetails || !quotationDetails.days) return false;
    
    const staffAssignments = eventWithStaff.event_staff_assignments || [];
    const totalDays = eventWithStaff.total_days || 1;
    
    // Check each day for crew completeness
    for (let day = 1; day <= totalDays; day++) {
      const dayConfig = quotationDetails.days?.[day - 1];
      if (!dayConfig) continue;
      
      // Count actual assignments for this specific day
      const dayAssignments = staffAssignments.filter((assignment: any) => 
        assignment.day_number === day
      );
      
      // For legacy events without day_number, include them only for day 1 of single-day events
      const legacyAssignments = staffAssignments.filter((assignment: any) => 
        !assignment.day_number && totalDays === 1 && day === 1
      );
      
      const allDayAssignments = [...dayAssignments, ...legacyAssignments];
      
      const actualPhotographers = allDayAssignments.filter((a: any) => a.role === 'Photographer').length;
      const actualCinematographers = allDayAssignments.filter((a: any) => a.role === 'Cinematographer').length;
      const actualDronePilots = allDayAssignments.filter((a: any) => a.role === 'Drone Pilot').length;
      
      const requiredPhotographers = dayConfig.photographers || 0;
      const requiredCinematographers = dayConfig.cinematographers || 0;
      const requiredDrone = dayConfig.drone || 0;
      
      // If any requirement is not met, the event is crew incomplete
      if (actualPhotographers < requiredPhotographers ||
          actualCinematographers < requiredCinematographers ||
          actualDronePilots < requiredDrone) {
        return true;
      }
    }
    
    // All days have complete crew
    return false;
  };

  // Filter out optimistically deleted events and apply custom filters
  const processedEvents = useMemo(() => {
    let filtered = events.filter(event => !optimisticallyDeletedEvents.has(event.id));

    // Apply search filter first
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(event =>
        ['title', 'venue'].some(field => {
          const value = event[field as keyof typeof event];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply payment status filter
    if (activeFilters.payment_status) {
      filtered = filtered.filter(event => {
        const totalPaid = calculateTotalPaid(event as any);
        const balance = Math.max(0, (event.total_amount || 0) - totalPaid);
        
        switch (activeFilters.payment_status) {
          case 'fully_paid':
            return balance <= 0 && (event.total_amount || 0) > 0;
          case 'partial_paid':
            return balance > 0 && totalPaid > 0;
          case 'payment_pending':
            return balance > 0 && totalPaid === 0;
          case 'no_payment':
            return (event.total_amount || 0) === 0;
          default:
            return true;
        }
      });
    }

    // Apply status filter
    if (activeFilters.status) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        const rawEnd = (event as any).event_end_date;
        const eventEndDate = rawEnd ? new Date(rawEnd) : eventDate;
        
        switch (activeFilters.status) {
          case 'upcoming':
            return eventDate > today;
          case 'in_progress':
            return eventDate <= today && eventEndDate >= today;
          case 'completed':
            return eventEndDate < today;
          case 'confirmed':
            return event.total_amount && event.total_amount > 0;
          case 'crew_incomplete':
            return checkEventCrewCompleteness(event);
          default:
            return true;
        }
      });
    }

    // Apply amount range filter
    if (activeFilters.amount_range) {
      filtered = filtered.filter(event => {
        const amount = event.total_amount || 0;
        switch (activeFilters.amount_range) {
          case 'under_50k':
            return amount < 50000;
          case '50k_1l':
            return amount >= 50000 && amount < 100000;
          case '1l_2l':
            return amount >= 100000 && amount < 200000;
          case 'above_2l':
            return amount >= 200000;
          default:
            return true;
        }
      });
    }

    // Apply client filter
    if (activeFilters.client_id) {
      filtered = filtered.filter(event => event.client?.id === activeFilters.client_id);
    }

    // Apply staff assignment status filter
    if (activeFilters.staff_assignment_status) {
      filtered = filtered.filter(event => {
        const staffAssignments = (event as any).event_staff_assignments || [];
        const quotationDetails = (event as any).quotation_details;
        
        if (!quotationDetails?.days) {
          switch (activeFilters.staff_assignment_status) {
            case 'fully_assigned':
              return staffAssignments.length > 0;
            case 'no_staff':
              return staffAssignments.length === 0;
            case 'partially_assigned':
              return false;
            default:
              return true;
          }
        }
        
        const isComplete = !checkEventCrewCompleteness(event);
        switch (activeFilters.staff_assignment_status) {
          case 'fully_assigned':
            return isComplete;
          case 'partially_assigned':
            return !isComplete && staffAssignments.length > 0;
          case 'no_staff':
            return staffAssignments.length === 0;
          default:
            return true;
        }
      });
    }

    // Apply event type filter  
    if (activeFilters.event_type && Array.isArray(activeFilters.event_type) && activeFilters.event_type.length > 0) {
      filtered = filtered.filter(event => {
        return activeFilters.event_type.includes(event.event_type);
      });
    }

    // Apply specific date filter
    if (activeFilters.event_date) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        const filterDate = new Date(activeFilters.event_date);
        return eventDate.toDateString() === filterDate.toDateString();
      });
    }

    // Apply date range filter
    if (activeFilters.date_range) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        
        switch (activeFilters.date_range) {
          case 'this_week': {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return eventDate >= weekStart && eventDate <= weekEnd;
          }
          case 'this_month': {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return eventDate >= monthStart && eventDate <= monthEnd;
          }
          case 'next_30_days': {
            const next30Days = new Date(today);
            next30Days.setDate(today.getDate() + 30);
            return eventDate >= today && eventDate <= next30Days;
          }
          case 'past_events':
            return eventDate < today;
          case 'future_events':
            return eventDate > today;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[currentSort as keyof typeof a];
      const bValue = b[currentSort as keyof typeof b];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      // Date comparison
      if (currentSort.includes('date') || aValue instanceof Date || bValue instanceof Date) {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        
        const aIsValid = !isNaN(aDate.getTime());
        const bIsValid = !isNaN(bDate.getTime());
        
        if (!aIsValid && !bIsValid) return 0;
        if (!aIsValid) return sortDirection === 'asc' ? 1 : -1;
        if (!bIsValid) return sortDirection === 'asc' ? -1 : 1;
        
        const result = aDate.getTime() - bDate.getTime();
        return sortDirection === 'asc' ? result : -result;
      }
      
      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return sortDirection === 'asc' ? result : -result;
      }
      
      // String comparison
      const result = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  }, [events, searchValue, activeFilters, optimisticallyDeletedEvents, checkEventCrewCompleteness, currentSort, sortDirection]);

  const statusFilters = [
    { value: 'all', label: 'All Events', count: processedEvents.length },
    { value: 'confirmed', label: 'Confirmed', count: processedEvents.filter(e => e.total_amount && e.total_amount > 0).length },
    { value: 'completed', label: 'Completed', count: processedEvents.filter(e => new Date(e.event_date) <= new Date()).length },
    { value: 'pending', label: 'Work Pending', count: processedEvents.filter(e => new Date(e.event_date) > new Date()).length },
    { value: 'crew_incomplete', label: 'Staff Incomplete', count: processedEvents.filter(checkEventCrewCompleteness).length },
    { 
      value: 'paid', 
      label: 'Paid', 
      count: processedEvents.filter(e => {
        const totalPaid = calculateTotalPaid(e as any);
        return Math.max(0, (e.total_amount || 0) - totalPaid) <= 0;
      }).length 
    },
    { 
      value: 'payment_pending', 
      label: 'Payment Due', 
      count: processedEvents.filter(e => {
        const totalPaid = calculateTotalPaid(e as any);
        return Math.max(0, (e.total_amount || 0) - totalPaid) > 0;
      }).length 
    }
  ];

  const sortOptions = [
    { value: 'event_date', label: 'Event Date' },
    { value: 'title', label: 'Event Title' },
    { value: 'total_amount', label: 'Total Amount' },
    { value: 'balance_amount', label: 'Balance Amount' }
  ];

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Events
        </h1>
          <div className="flex gap-2">
        <UniversalExportDialog
          data={processedEvents}
          config={eventExportConfig}
        />
            <Button onClick={() => setCreateDialogOpen(true)} size="icon" className="h-10 w-10 rounded-full">
              <Add01Icon className="h-5 w-5" />
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="icon"
              disabled={refreshing}
              className="h-10 w-10 rounded-full"
            >
              <RefreshIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
      </div>

      <EventStats events={processedEvents} />

      {/* Search, Sort & Filter */}
      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortOptions={[
          { key: 'event_date', label: 'Event Date' },
          { key: 'title', label: 'Title' },
          { key: 'venue', label: 'Venue' },
          { key: 'total_amount', label: 'Amount' }
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
              { value: 'Ring-Ceremony', label: 'Ring-Ceremony' },
              { value: 'Pre-Wedding', label: 'Pre-Wedding' },
              { value: 'Wedding', label: 'Wedding' },
              { value: 'Maternity Photography', label: 'Maternity Photography' },
              { value: 'Others', label: 'Others' }
            ]
          },
          {
            key: 'status',
            label: 'Event Status',
            type: 'select',
            options: [
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'crew_incomplete', label: 'Staff Incomplete' }
            ]
          },
          {
            key: 'payment_status',
            label: 'Payment Status',
            type: 'select',
            options: [
              { value: 'fully_paid', label: 'Fully Paid' },
              { value: 'partial_paid', label: 'Partial' },
              { value: 'payment_pending', label: 'Payment Due' },
              { value: 'no_payment', label: 'No Payment' }
            ]
          },
          {
            key: 'amount_range',
            label: 'Amount Range',
            type: 'select',
            options: [
              { value: 'under_50k', label: 'Under ₹50,000' },
              { value: '50k_1l', label: '₹50,000 - ₹1,00,000' },
              { value: '1l_2l', label: '₹1,00,000 - ₹2,00,000' },
              { value: 'above_2l', label: 'Above ₹2,00,000' }
            ]
          },
          {
            key: 'client_id',
            label: 'Client',
            type: 'select',
            options: processedEvents
              .filter(event => event.client?.name)
              .reduce((unique, event) => {
                const exists = unique.find(item => item.value === event.client?.id);
                if (!exists) {
                  unique.push({ 
                    value: event.client!.id, 
                    label: event.client!.name 
                  });
                }
                return unique;
              }, [] as { value: string; label: string }[])
              .sort((a, b) => a.label.localeCompare(b.label))
          },
          {
            key: 'staff_assignment_status',
            label: 'Staff Assignment',
            type: 'select',
            options: [
              { value: 'fully_assigned', label: 'Fully Assigned' },
              { value: 'partially_assigned', label: 'Partially Assigned' },
              { value: 'no_staff', label: 'No Staff Assigned' }
            ]
          },
          {
            key: 'date_range',
            label: 'Date Range',
            type: 'select',
            options: [
              { value: 'this_week', label: 'This Week' },
              { value: 'this_month', label: 'This Month' },
              { value: 'next_30_days', label: 'Next 30 Days' },
              { value: 'past_events', label: 'Past Events' },
              { value: 'future_events', label: 'Future Events' }
            ]
          },
          {
            key: 'event_date',
            label: 'Specific Date',
            type: 'date'
          }
        ]}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search events..."
      />

      {processedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Calendar01Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No events found</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Get started by creating your first event
          </p>
          <Button className="rounded-full p-3" onClick={() => setCreateDialogOpen(true)}>
            Create Event
          </Button>
        </div>
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {processedEvents.map((event) => (
            <EventPaymentCard
              key={event.id}
              event={event}
              onEdit={handleEditEvent}
              onPaymentClick={handlePaymentRecord}
              onDownloadInvoice={handleDownloadInvoice}
              onSendInvoice={handleShare}
              onDelete={handleDeleteEvent}
            />
          ))}
        </div>
      )}

      {/* Payment Collection Dialog */}
      {selectedEventForPayment && (
        <PaymentCard
          event={selectedEventForPayment}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onPaymentCollected={handlePaymentCollected}
        />
      )}

      <CleanEventFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadEvents}
      />

      <CleanEventFormDialog
        open={editDialogOpen}
        onOpenChange={handleCloseEditDialog}
        editingEvent={editingEvent}
        onSuccess={() => {
          loadEvents();
          handleCloseEditDialog();
        }}
      />

      <EventDeleteConfirmation
        event={eventToDelete}
        open={!!eventToDelete}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        onSuccess={handleEventDeleted}
        onOptimisticDelete={handleOptimisticDelete}
      />

      <ShareOptionsDialog
        isOpen={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onDirectToClient={handleDirectToClient}
        onCustomShare={handleCustomShare}
        title="Share Event Details"
      />
    </div>
  );
};

export default EventManagementWithPayments;
