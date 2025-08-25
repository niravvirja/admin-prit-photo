
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Event } from '@/types/studio';
import RefinedEventSheetTable from './RefinedEventSheetTable';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';
import { Button } from '@/components/ui/button';
import { File01Icon, Calendar01Icon } from 'hugeicons-react';
import { useFirmData } from '@/hooks/useFirmData';

const EventSheetManagement = () => {
  const { currentFirmId } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { firmData: firm } = useFirmData();

  // Search, Sort & Filter
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
    }
  }, [currentFirmId]);

  const loadEvents = async () => {
    if (!currentFirmId) return;

    try {
      setLoading(true);
      // Fetch events first
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          client:clients(name, phone, email),
          event_closing_balances(closing_amount),
          quotation_source:quotations(
            id,
            quotation_details
          )
        `)
        .eq('firm_id', currentFirmId)
        .order('event_date', { ascending: false });

      // Fetch staff assignments separately
      let staffAssignmentsData = [];
      if (data) {
        const eventIds = data.map(event => event.id);
        const { data: assignmentsData } = await supabase
          .from('event_staff_assignments')
          .select(`
            *,
            staff:profiles(id, full_name, role),
            freelancer:freelancers!event_staff_assignments_freelancer_id_fkey(id, full_name, role, phone, email)
          `)
          .in('event_id', eventIds);
        
        staffAssignmentsData = assignmentsData || [];
      }

      // Fetch payments separately to avoid relationship conflicts
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('firm_id', currentFirmId);

      if (error) throw error;
      
      // Process events to include quotation details and staff assignments
      const processedEvents = (data || []).map(event => {
        // Add staff assignments to each event
        const eventStaffAssignments = staffAssignmentsData.filter(
          assignment => assignment.event_id === event.id
        );
        
        return {
          ...event,
          quotation_details: (event.quotation_source as any)?.[0]?.quotation_details || null,
          event_staff_assignments: eventStaffAssignments,
          payments: paymentsData?.filter(payment => payment.event_id === event.id) || []
        };
      });
      
      setEvents(processedEvents as any);
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

  // Apply custom status filtering for overview page
  const processedEvents = useMemo(() => {
    let filtered = [...filteredAndSortedData];

    // Apply status filter based on event dates
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
          default:
            return true;
        }
      });
    }

    // Apply payment status filter
    if (activeFilters.payment_status) {
      filtered = filtered.filter(event => {
        const payments = (event as any).payments || [];
        const totalPaid = payments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
        const balance = Math.max(0, (event.total_amount || 0) - totalPaid);
        const eventDate = new Date(event.event_date);
        const today = new Date();
        
        switch (activeFilters.payment_status) {
          case 'fully_paid':
            return balance <= 0 && (event.total_amount || 0) > 0;
          case 'partial_paid':
            return balance > 0 && totalPaid > 0;
          case 'payment_pending':
            return balance > 0 && totalPaid === 0;
          case 'overdue':
            return balance > 0 && eventDate < today;
          default:
            return true;
        }
      });
    }

    // Apply staff assignment status filter
    if (activeFilters.staff_assignment_status) {
      filtered = filtered.filter(event => {
        const staffAssignments = (event as any).event_staff_assignments || [];
        const quotationDetails = (event as any).quotation_details;
        
        if (!quotationDetails?.days) {
          switch (activeFilters.staff_assignment_status) {
            case 'complete':
              return staffAssignments.length > 0;
            case 'no_staff':
              return staffAssignments.length === 0;
            case 'incomplete':
              return false;
            default:
              return true;
          }
        }

        // Check crew completeness based on quotation requirements
        let isComplete = true;
        const totalDays = (event as any).total_days || 1;
        
        for (let day = 1; day <= totalDays; day++) {
          const dayConfig = quotationDetails.days?.[day - 1];
          if (!dayConfig) continue;
          
          const dayAssignments = staffAssignments.filter((assignment: any) => 
            assignment.day_number === day
          );
          
          const actualPhotographers = dayAssignments.filter((a: any) => a.role === 'Photographer').length;
          const actualCinematographers = dayAssignments.filter((a: any) => a.role === 'Cinematographer').length;
          const actualDronePilots = dayAssignments.filter((a: any) => a.role === 'Drone Pilot').length;
          
          if (actualPhotographers < (dayConfig.photographers || 0) ||
              actualCinematographers < (dayConfig.cinematographers || 0) ||
              actualDronePilots < (dayConfig.drone || 0)) {
            isComplete = false;
            break;
          }
        }
        
        switch (activeFilters.staff_assignment_status) {
          case 'complete':
            return isComplete;
          case 'incomplete':
            return !isComplete && staffAssignments.length > 0;
          case 'no_staff':
            return staffAssignments.length === 0;
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

    // Apply recent activity filter
    if (activeFilters.recent_activity) {
      const now = new Date();
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        const createdDate = new Date(event.created_at);
        
        switch (activeFilters.recent_activity) {
          case 'last_7_days': {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            return eventDate >= sevenDaysAgo || createdDate >= sevenDaysAgo;
          }
          case 'last_30_days': {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return eventDate >= thirtyDaysAgo || createdDate >= thirtyDaysAgo;
          }
          case 'this_month': {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return eventDate >= monthStart || createdDate >= monthStart;
          }
          case 'last_3_months': {
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            return eventDate >= threeMonthsAgo || createdDate >= threeMonthsAgo;
          }
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [filteredAndSortedData, activeFilters]);

  const handleOpenSpreadsheet = () => {
    if (firm?.spreadsheet_id) {
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${firm.spreadsheet_id}`;
      window.open(spreadsheetUrl, '_blank');
      
      toast({
        title: "Opening Spreadsheet",
        description: "Your studio spreadsheet is opening in a new tab",
      });
    } else {
      toast({
        title: "No Spreadsheet Found",
        description: "This firm doesn't have a spreadsheet configured yet",
        variant: "destructive",
      });
    }
  };

  const handleOpenCalendar = () => {
    if (firm?.calendar_id) {
      const calendarUrl = `https://calendar.google.com/calendar/u/0/r?cid=${firm.calendar_id}`;
      window.open(calendarUrl, '_blank');
      
      toast({
        title: "Opening Calendar",
        description: "Your studio calendar is opening in a new tab",
      });
    } else {
      toast({
        title: "No Calendar Found",
        description: "This firm doesn't have a calendar configured yet",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <RefinedEventSheetTable 
        events={processedEvents}
        loading={loading}
        onRefresh={loadEvents}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortOptions={[
          { key: 'event_date', label: 'Event Date' },
          { key: 'title', label: 'Title' },
          { key: 'total_amount', label: 'Amount' },
          { key: 'venue', label: 'Venue' }
        ]}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        filterOptions={[]}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleOpenSpreadsheet}
            disabled={!firm?.spreadsheet_id}
            className="rounded-full p-3"
          >
            <File01Icon className={`h-4 w-4 ${firm?.spreadsheet_id ? 'text-emerald-600' : 'text-rose-600'}`} />
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleOpenCalendar}
            disabled={!firm?.calendar_id}
            className="rounded-full p-3"
          >
            <Calendar01Icon className={`h-4 w-4 ${firm?.calendar_id ? 'text-emerald-600' : 'text-rose-600'}`} />
          </Button>
        </div>
      </div>

      {/* Events Overview */}
      <RefinedEventSheetTable
        events={processedEvents}
        loading={loading}
        onRefresh={loadEvents}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortOptions={[
          { key: 'event_date', label: 'Event Date' },
          { key: 'title', label: 'Title' },
          { key: 'total_amount', label: 'Amount' },
          { key: 'venue', label: 'Venue' }
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
            label: 'Status',
            type: 'select',
            options: [
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' }
            ]
          },
          {
            key: 'payment_status',
            label: 'Payment Status',
            type: 'select',
            options: [
              { value: 'fully_paid', label: 'Fully Paid' },
              { value: 'partial_paid', label: 'Partial Payment' },
              { value: 'payment_pending', label: 'Payment Due' },
              { value: 'overdue', label: 'Overdue Payment' }
            ]
          },
          {
            key: 'staff_assignment_status',
            label: 'Staff Assignment',
            type: 'select',
            options: [
              { value: 'complete', label: 'Complete Assignment' },
              { value: 'incomplete', label: 'Incomplete Assignment' },
              { value: 'no_staff', label: 'No Staff Assigned' }
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
            key: 'recent_activity',
            label: 'Recent Activity',
            type: 'select',
            options: [
              { value: 'last_7_days', label: 'Last 7 Days' },
              { value: 'last_30_days', label: 'Last 30 Days' },
              { value: 'this_month', label: 'This Month' },
              { value: 'last_3_months', label: 'Last 3 Months' }
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
      />
    </div>
  );
};

export default EventSheetManagement;
