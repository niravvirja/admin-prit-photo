
import { useState } from 'react';
import { PageTableSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getEventTypeColors, getStatusColors } from '@/lib/status-colors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar01Icon, Camera01Icon, Video01Icon, DollarCircleIcon, DroneIcon } from 'hugeicons-react';
import { Calendar, Edit } from 'lucide-react';
import { formatEventDateRange } from '@/lib/date-utils';
import StatsGrid from '@/components/ui/stats-grid';
import { Event } from '@/types/studio';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchSortFilter, SortOption, FilterOption } from '@/components/common/SearchSortFilter';
import EventFinancialSummaryDialog from '@/components/events/EventFinancialSummaryDialog';

interface RefinedEventSheetTableProps {
  events: Event[];
  loading: boolean;
  onRefresh: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortOptions: SortOption[];
  currentSort: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortKey: string) => void;
  onSortDirectionToggle: () => void;
  filterOptions: FilterOption[];
  activeFilters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
}

const RefinedEventSheetTable = ({ 
  events, 
  loading, 
  onRefresh, 
  searchValue,
  onSearchChange,
  sortOptions,
  currentSort,
  sortDirection,
  onSortChange,
  onSortDirectionToggle,
  filterOptions,
  activeFilters,
  onFilterChange
}: RefinedEventSheetTableProps) => {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setReportDialogOpen(true);
  };


  const getEventTypeColor = (eventType: string) => {
    return getEventTypeColors(eventType, 'text');
  };

  const getEventStatusColor = (eventDate: string, eventEndDate?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison
    
    const startDate = new Date(eventDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = eventEndDate ? new Date(eventEndDate) : startDate;
    endDate.setHours(23, 59, 59, 999); // End of day for accurate comparison
    
    // If today is within the event date range
    if (today >= startDate && today <= endDate) {
      return { label: 'In Progress', color: getStatusColors('in-progress', 'text') };
    }
    
    // If event has ended
    if (today > endDate) {
      return { label: 'Completed', color: getStatusColors('completed', 'text') };
    }
    
    // If event starts in the future
    if (startDate > today) {
      return { label: 'Upcoming', color: getStatusColors('pending', 'text') };
    }
    
    // Fallback
    return { label: 'Pending', color: getStatusColors('pending', 'text') };
  };

  const handleRefreshData = async () => {
    await onRefresh();
    toast({
      title: "Data Refreshed",
      description: "Event data has been updated",
    });
  };

  // Use the filtered events from props
  const eventsToShow = events;

  const totalEvents = eventsToShow.length;
  const totalRevenue = eventsToShow.reduce((sum, event) => sum + (event.total_amount || 0), 0);
  const completedEvents = eventsToShow.filter(event => new Date(event.event_date) <= new Date()).length;
  const pendingEvents = eventsToShow.filter(event => new Date(event.event_date) > new Date()).length;

  if (loading) {
    return <PageTableSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Event Statistics */}
      <StatsGrid stats={[
        {
          title: "Total Events",
          value: totalEvents,
          icon: <Calendar01Icon className="h-4 w-4" />,
          colorClass: "bg-primary/20 text-primary"
        },
        {
          title: "Total Revenue",
          value: `₹${totalRevenue.toLocaleString()}`,
          icon: <DollarCircleIcon className="h-4 w-4" />,
          colorClass: "bg-primary/20 text-primary"
        },
        {
          title: "Completed",
          value: completedEvents,
          icon: <Camera01Icon className="h-4 w-4" />,
          colorClass: "bg-primary/20 text-primary"
        },
        {
          title: "In Progress",
          value: pendingEvents,
          icon: <Video01Icon className="h-4 w-4" />,
          colorClass: "bg-primary/20 text-primary"
        }
      ]} />

      {/* Search, Sort & Filter */}
      <SearchSortFilter
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search events by title, venue..."
        sortOptions={sortOptions}
        currentSort={currentSort}
        sortDirection={sortDirection}
        onSortChange={onSortChange}
        onSortDirectionToggle={onSortDirectionToggle}
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
      />

      {/* Events Table */}
      {eventsToShow.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Events Found"
          description="Create your first event to start managing your photography business."
          action={{
            label: "Create Event",
            onClick: () => window.location.href = '/events'
          }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden lg:block rounded-2xl border-gray-200">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Event Details</TableHead>
                    <TableHead className="text-center">Client</TableHead>
                    <TableHead className="text-center">Date</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Staff</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsToShow.map((event) => {
                    const eventStatus = getEventStatusColor(event.event_date, (event as any).event_end_date);
                    return (
                      <TableRow 
                        key={event.id} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleEventClick(event)}
                      >
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <div className="font-medium">{event.title}</div>
                             {event.venue && (
                               <div className="text-sm text-muted-foreground">
                                 {event.venue}
                               </div>
                             )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-center">
                          {event.client?.name || '~'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm">
                            {formatEventDateRange(event.event_date, (event as any).total_days, (event as any).event_end_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${getEventTypeColors(event.event_type)}`}>
                            {event.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            {(() => {
                              const staffAssignments = (event as any).event_staff_assignments || [];
                              const quotationDetails = (event as any).quotation_details;
                              const isFromQuotation = !!(event as any).quotation_source_id;
                              
                              // Group assignments by role
                              const photographers = staffAssignments.filter((assignment: any) => assignment.role === 'Photographer');
                              const cinematographers = staffAssignments.filter((assignment: any) => assignment.role === 'Cinematographer');
                              const dronePilots = staffAssignments.filter((assignment: any) => assignment.role === 'Drone Pilot');
                              const editors = staffAssignments.filter((assignment: any) => assignment.role === 'Editor' || assignment.role === 'Same Day Editor');

                              // Helper function to determine if a role should be shown
                              const shouldShowRole = (role: string) => {
                                if (!isFromQuotation) return true; // Show all roles for manual events
                                
                                if (!quotationDetails?.days) return true; // Show all if no quotation details
                                
                                // Check if any day in quotation requires this role
                                return quotationDetails.days.some((dayConfig: any) => {
                                  switch (role) {
                                    case 'photographer':
                                      return (dayConfig.photographers || 0) > 0;
                                    case 'cinematographer':
                                      return (dayConfig.cinematographers || 0) > 0;
                                    case 'drone':
                                      return (dayConfig.drone || 0) > 0;
                                    case 'editor':
                                      return quotationDetails.sameDayEditing === true;
                                    default:
                                      return false;
                                  }
                                });
                              };

                              // Helper function to render staff names or ~
                              const renderStaffNames = (assignments: any[]) => {
                                const names = assignments
                                  .map((a: any) => {
                                    if (a.staff?.full_name) return a.staff.full_name.trim();
                                    if (a.freelancer?.full_name) return a.freelancer.full_name.trim();
                                    return '';
                                  })
                                  .filter((n: string) => n.length > 0)
                                  .filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i);
                                return names.length > 0 ? names.join(', ') : '~';
                              };

                              return (
                                <>
                                  {shouldShowRole('photographer') && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                      <Camera01Icon className="h-3 w-3" />
                                      <span>{renderStaffNames(photographers)}</span>
                                    </div>
                                  )}
                                  
                                  {shouldShowRole('cinematographer') && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                      <Video01Icon className="h-3 w-3" />
                                      <span>{renderStaffNames(cinematographers)}</span>
                                    </div>
                                  )}
                                  
                                  {shouldShowRole('drone') && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                      <DroneIcon className="h-3 w-3" />
                                      <span>{renderStaffNames(dronePilots)}</span>
                                    </div>
                                  )}
                                  
                                  {shouldShowRole('editor') && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                      <Edit className="h-3 w-3" />
                                      <span>{renderStaffNames(editors)}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${eventStatus.color}`}>
                            {eventStatus.label}
                          </span>
                        </TableCell>
                         <TableCell className="text-right font-semibold">
                           {event.total_amount ? `₹${event.total_amount.toLocaleString()}` : '~'}
                         </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {eventsToShow.map((event) => {
              const eventStatus = getEventStatusColor(event.event_date, (event as any).event_end_date);
              const staffAssignments = (event as any).event_staff_assignments || [];
              return (
                <Card 
                  key={event.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-foreground">
                            {event.title}
                          </span>
                          <Badge variant="secondary" className={`text-xs ${eventStatus.color}`}>
                            {eventStatus.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.client?.name || '~'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {event.total_amount ? `₹${event.total_amount.toLocaleString()}` : '~'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                      <div>
                        <div className="text-xs text-muted-foreground">Date</div>
                        <div className="text-sm font-medium">
                          {formatEventDateRange(event.event_date, (event as any).total_days, (event as any).event_end_date)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Type</div>
                        <span className={`font-medium ${getEventTypeColors(event.event_type)}`}>
                          {event.event_type}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Venue</div>
                        <div className="text-sm font-medium">
                          {event.venue || '~'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Staff</div>
                        <div className="text-sm font-medium">
                          {staffAssignments.length > 0 ? `${staffAssignments.length} assigned` : '~'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </>
        )}

        {/* Event Financial Summary Dialog */}
        <EventFinancialSummaryDialog
          event={selectedEvent}
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
        />
      </div>
    );
  };

  export default RefinedEventSheetTable;
