import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { DollarCircleIcon, UserIcon, MoneyBag02Icon, TaskDone01Icon, Calendar01Icon, Download01Icon, Settings02Icon, UserMultipleIcon, Briefcase01Icon, UserGroupIcon } from 'hugeicons-react';
import { useToast } from '@/hooks/use-toast';
import { PageTableSkeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SalaryStats from './SalaryStats';
import PaySalaryDialog from './PaySalaryDialog';
import SalaryHistoryDialog from './SalaryHistoryDialog';
import UniversalExportDialog from '@/components/common/UniversalExportDialog';
import { useSalaryExportConfig } from '@/hooks/useExportConfigs';
import { useSalaryData } from './hooks/useSalaryData';
import { useFreelancerSalaryData } from '@/components/freelancers/hooks/useFreelancerSalaryData';
import EventAssignmentRatesDialog from './EventAssignmentRatesDialog';
import FreelancerDetailedReportDialog from './FreelancerDetailedReportDialog';
import StaffDetailedReportDialog from './StaffDetailedReportDialog';
import SalaryCardView from './SalaryCardView';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { getFreelancerRoleColors, getRoleTextColor } from '@/lib/status-colors';
import { getRoleOptions, displayRole } from '@/lib/role-utils';
import { SearchSortFilter } from '@/components/common/SearchSortFilter';
import { useSearchSortFilter } from '@/hooks/useSearchSortFilter';

const SalaryManagement = () => {
  const { profile, currentFirmId } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [currentView, setCurrentView] = useState<'staff' | 'freelancers' | 'mix'>('staff');
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedForAssignment, setSelectedForAssignment] = useState<any>(null);
  const [detailedReportOpen, setDetailedReportOpen] = useState(false);
  const [selectedForDetailedReport, setSelectedForDetailedReport] = useState<any>(null);
  const [staffDetailedReportOpen, setStaffDetailedReportOpen] = useState(false);
  const [selectedStaffForDetailedReport, setSelectedStaffForDetailedReport] = useState<any>(null);
  
  const { 
    staffData, 
    totalStats, 
    loading, 
    refetch: refetchStaff
  } = useSalaryData();

  const { 
    freelancerData, 
    totalStats: freelancerStats, 
    loading: freelancerLoading,
    refetch: refetchFreelancers
  } = useFreelancerSalaryData();

  // Search, Sort, Filter functionality for staff
  const {
    searchValue: staffSearchValue,
    setSearchValue: setStaffSearchValue,
    currentSort: staffCurrentSort,
    sortDirection: staffSortDirection,
    activeFilters: staffActiveFilters,
    filteredAndSortedData: filteredStaffData,
    handleSortChange: handleStaffSortChange,
    handleSortDirectionToggle: handleStaffSortDirectionToggle,
    handleFilterChange: handleStaffFilterChange
  } = useSearchSortFilter({
    data: staffData || [],
    searchFields: ['full_name', 'role'],
    defaultSort: 'full_name',
    defaultSortDirection: 'asc'
  });

  // Search, Sort, Filter functionality for freelancers
  const {
    searchValue: freelancerSearchValue,
    setSearchValue: setFreelancerSearchValue,
    currentSort: freelancerCurrentSort,
    sortDirection: freelancerSortDirection,
    activeFilters: freelancerActiveFilters,
    filteredAndSortedData: filteredFreelancerData,
    handleSortChange: handleFreelancerSortChange,
    handleSortDirectionToggle: handleFreelancerSortDirectionToggle,
    handleFilterChange: handleFreelancerFilterChange
  } = useSearchSortFilter({
    data: freelancerData || [],
    searchFields: ['full_name', 'role'],
    defaultSort: 'full_name',
    defaultSortDirection: 'asc'
  });

  // Combined data for Mix mode - include ALL staff and freelancers with a type identifier
  const combinedData = useMemo(() => {
    const staffWithType = (staffData || []).map(staff => ({ ...staff, type: 'staff' as const }));
    const freelancersWithType = (freelancerData || []).map(freelancer => ({ ...freelancer, type: 'freelancer' as const }));
    return [...staffWithType, ...freelancersWithType];
  }, [staffData, freelancerData]);


  // Search, Sort, Filter functionality for Mix mode
  const {
    searchValue: mixSearchValue,
    setSearchValue: setMixSearchValue,
    currentSort: mixCurrentSort,
    sortDirection: mixSortDirection,
    activeFilters: mixActiveFilters,
    filteredAndSortedData: filteredMixData,
    handleSortChange: handleMixSortChange,
    handleSortDirectionToggle: handleMixSortDirectionToggle,
    handleFilterChange: handleMixFilterChange
  } = useSearchSortFilter({
    data: combinedData,
    searchFields: ['full_name', 'role'],
    defaultSort: 'full_name',
    defaultSortDirection: 'asc'
  });

  // Load staff and freelancer data for filters
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [allFreelancers, setAllFreelancers] = useState<any[]>([]);

  useEffect(() => {
    if (currentFirmId) {
      loadStaffAndFreelancers();
    }
  }, [currentFirmId]);

  const loadStaffAndFreelancers = async () => {
    if (!currentFirmId) return;
    try {
      const [staffResult, freelancerResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').eq('firm_id', currentFirmId),
        supabase.from('freelancers').select('id, full_name, role').eq('firm_id', currentFirmId)
      ]);
      setAllStaff(staffResult.data || []);
      setAllFreelancers(freelancerResult.data || []);
    } catch (error) {
      console.error('Error loading staff/freelancers:', error);
    }
  };

  // Use all staff and freelancer data
  const staffDataToShow = staffData || [];
  const freelancerDataToShow = freelancerData || [];

  const salaryExportConfig = useSalaryExportConfig(staffData || [], freelancerData || [], totalStats);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Role color mapping using standardized function
  const getRoleColor = (role: string) => {
    return getRoleTextColor(role);
  };

  const handlePaySalary = (staff: any) => {
    // 🚀 FIXED: Check if staff has pending amount before opening dialog
    if (staff.pending_amount <= 0) {
      toast({
        title: "No pending amount",
        description: `${staff.full_name} has no pending payments to process.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedStaff(staff);
    setPayDialogOpen(true);
  };

  const handleViewHistory = (staff: any) => {
    setSelectedStaff(staff);
    setHistoryDialogOpen(true);
  };

  const handlePayFreelancer = (freelancer: any) => {
    // 🚀 FIXED: Check if freelancer has pending amount before opening dialog
    if (freelancer.pending_amount <= 0) {
      toast({
        title: "No pending amount",
        description: `${freelancer.full_name} has no pending payments to process.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedStaff({ ...freelancer, is_freelancer: true });
    setPayDialogOpen(true);
  };

  const handleViewFreelancerHistory = (freelancer: any) => {
    setSelectedStaff({ ...freelancer, is_freelancer: true });
    setHistoryDialogOpen(true);
  };

  const handleViewDetailedReport = (freelancer: any) => {
    setSelectedForDetailedReport(freelancer);
    setDetailedReportOpen(true);
  };

  const handleViewStaffDetailedReport = (staff: any) => {
    setSelectedStaffForDetailedReport(staff);
    setStaffDetailedReportOpen(true);
  };

  const handleAssignmentRates = (freelancer: any) => {
    setSelectedForAssignment({ ...freelancer, is_freelancer: true });
    setAssignmentDialogOpen(true);
  };

  const onPaymentSuccess = () => {
    refetchStaff();
    refetchFreelancers();
    setPayDialogOpen(false);
  };

  // Global refetch function that refreshes all data
  const refetchAll = () => {
    refetchStaff();
    refetchFreelancers();
  };

  // Add keyboard shortcut for quick refresh
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        refetchAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [refetchAll]);

  if (!currentFirmId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <CardContent>
            <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Firm Selected</h3>
            <p className="text-muted-foreground">Please select a firm to view salary information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || freelancerLoading) {
    return <PageTableSkeleton />;
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Salary</h1>
        <div className="flex items-center gap-3">
          {/* Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const nextView = currentView === 'staff' ? 'freelancers' : currentView === 'freelancers' ? 'mix' : 'staff';
              setCurrentView(nextView);
            }}
            className="h-10 w-10 p-0 rounded-full"
            title={`Current: ${currentView === 'staff' ? 'Staff' : currentView === 'freelancers' ? 'Freelancers' : 'Mixed View'} - Click to switch`}
          >
            {currentView === 'staff' ? (
              <UserIcon className="h-4 w-4" />
            ) : currentView === 'freelancers' ? (
              <Briefcase01Icon className="h-4 w-4" />
            ) : (
              <UserMultipleIcon className="h-4 w-4" />
            )}
          </Button>
          <UniversalExportDialog 
            data={[...staffDataToShow, ...freelancerDataToShow]}
            config={salaryExportConfig}
            key={`export-${freelancerData?.length || 0}`}
          />
        </div>
      </div>

      {/* Salary Stats */}
      <div className="mb-4">
        <SalaryStats 
          stats={currentView === 'staff' ? totalStats : currentView === 'freelancers' ? {
            totalStaff: 0,
            totalFreelancers: freelancerStats?.totalFreelancers || 0,
            taskPaymentsTotal: freelancerData?.reduce((sum, f) => sum + f.task_earnings, 0) || 0,
            assignmentRatesTotal: freelancerData?.reduce((sum, f) => sum + f.assignment_earnings, 0) || 0,
            totalPaid: freelancerStats?.totalPaid || 0,
            totalPending: freelancerStats?.totalPending || 0,
            avgPerPerson: freelancerStats?.avgEarningsPerFreelancer || 0,
            totalEarnings: freelancerStats?.totalEarnings || 0,
          } : {
            totalStaff: totalStats?.totalStaff || 0,
            totalFreelancers: freelancerStats?.totalFreelancers || 0,
            taskPaymentsTotal: (totalStats?.taskPaymentsTotal || 0) + (freelancerData?.reduce((sum, f) => sum + f.task_earnings, 0) || 0),
            assignmentRatesTotal: (totalStats?.assignmentRatesTotal || 0) + (freelancerData?.reduce((sum, f) => sum + f.assignment_earnings, 0) || 0),
            totalPaid: (totalStats?.totalPaid || 0) + (freelancerStats?.totalPaid || 0),
            totalPending: (totalStats?.totalPending || 0) + (freelancerStats?.totalPending || 0),
            avgPerPerson: ((totalStats?.totalStaff || 0) + (freelancerStats?.totalFreelancers || 0)) > 0 ? 
              ((totalStats?.totalEarnings || 0) + (freelancerStats?.totalEarnings || 0)) / ((totalStats?.totalStaff || 0) + (freelancerStats?.totalFreelancers || 0)) : 0,
            totalEarnings: (totalStats?.totalEarnings || 0) + (freelancerStats?.totalEarnings || 0),
          }} 
          loading={false}
          mode={currentView}
        />
      </div>

      {/* Content based on current view */}
      {currentView === 'staff' ? (
        <div className="space-y-4">
          
          {/* Search, Sort & Filter for Staff */}
          <SearchSortFilter
            searchValue={staffSearchValue}
            onSearchChange={setStaffSearchValue}
            sortOptions={[
              { key: 'full_name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'total_earnings', label: 'Total Earnings' },
              { key: 'pending_amount', label: 'Pending Amount' }
            ]}
            currentSort={staffCurrentSort}
            sortDirection={staffSortDirection}
            onSortChange={handleStaffSortChange}
            onSortDirectionToggle={handleStaffSortDirectionToggle}
            filterOptions={[
              {
                key: 'role',
                label: 'Role',
                type: 'checkbox',
                options: getRoleOptions(false).map(role => ({ 
                  value: role.value.toLowerCase(), 
                  label: role.label 
                }))
              },
              {
                key: 'payment_status',
                label: 'Payment Status',
                type: 'select',
                options: [
                  { value: 'fully_paid', label: 'Fully Paid' },
                  { value: 'partial_paid', label: 'Partially Paid' },
                  { value: 'pending_payment', label: 'Payment Pending' },
                  { value: 'overpaid', label: 'Overpaid' },
                  { value: 'no_earnings', label: 'No Earnings' }
                ]
              },
              {
                key: 'earning_range',
                label: 'Earning Range',
                type: 'select',
                options: [
                  { value: 'under_10k', label: 'Under ₹10,000' },
                  { value: '10k_50k', label: '₹10,000 - ₹50,000' },
                  { value: '50k_100k', label: '₹50,000 - ₹1,00,000' },
                  { value: 'above_100k', label: 'Above ₹1,00,000' }
                ]
              },
              {
                key: 'assignment_count',
                label: 'Assignment Count',
                type: 'select',
                options: [
                  { value: 'no_assignments', label: 'No Assignments' },
                  { value: '1_5', label: '1-5 Assignments' },
                  { value: '6_15', label: '6-15 Assignments' },
                  { value: 'above_15', label: '15+ Assignments' }
                ]
              },
              {
                key: 'task_completion',
                label: 'Task Status',
                type: 'select',
                options: [
                  { value: 'all_completed', label: 'All Tasks Completed' },
                  { value: 'pending_tasks', label: 'Has Pending Tasks' },
                  { value: 'no_tasks', label: 'No Tasks Assigned' }
                ]
              }
            ]}
            activeFilters={staffActiveFilters}
            onFilterChange={handleStaffFilterChange}
            searchPlaceholder="Search staff..."
          />
          
          {isMobile ? (
          <SalaryCardView
            data={filteredStaffData || []}
            type="staff"
            onPaySalary={handlePaySalary}
            onViewHistory={handleViewHistory}
            onAssignmentRates={(staff) => { setSelectedForAssignment(staff); setAssignmentDialogOpen(true); }}
            onDetailedReport={handleViewStaffDetailedReport}
            loading={loading}
          />
        ) : (
          <>
            {filteredStaffData && filteredStaffData.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="text-center font-semibold">Staff</TableHead>
                         <TableHead className="text-center font-semibold">Role</TableHead>
                         <TableHead className="text-center font-semibold">Assignments</TableHead>
                         <TableHead className="text-center font-semibold">Tasks</TableHead>
                         <TableHead className="text-center font-semibold">Earnings</TableHead>
                         <TableHead className="text-center font-semibold">Paid</TableHead>
                         <TableHead className="text-center font-semibold">Pending</TableHead>
                         <TableHead className="text-center font-semibold">Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                        {filteredStaffData.map((staff) => (
                        <TableRow key={staff.id} className="hover:bg-muted/50">
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center space-x-3">
                               <Avatar className="h-10 w-10">
                                 <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                   {getInitials(staff.full_name)}
                                 </AvatarFallback>
                               </Avatar>
                               <div className="text-center">
                                 <p className="font-medium">{staff.full_name}</p>
                                 <p className="text-sm text-muted-foreground">{staff.mobile_number}</p>
                               </div>
                             </div>
                           </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-medium ${getRoleColor(staff.role)}`}>
                              {displayRole(staff.role)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Briefcase01Icon className="h-4 w-4 mr-1 text-muted-foreground" />
                              {staff.total_assignments}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-sm font-medium text-blue-600">
                                {staff.total_tasks}
                              </span>
                              <span className="text-sm text-muted-foreground">=</span>
                              <span className="text-sm font-medium text-green-600">
                                {staff.completed_tasks}
                              </span>
                              <span className="text-sm text-muted-foreground">+</span>
                              <span className="text-sm font-medium text-red-600">
                                {staff.total_tasks - staff.completed_tasks}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center space-y-1">
                              <span className="font-semibold">₹{staff.total_earnings.toLocaleString()}</span>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <TaskDone01Icon className="h-3 w-3" />
                                  <span>₹{staff.task_earnings.toLocaleString()}</span>
                                </div>
                                <span>+</span>
                                <div className="flex items-center space-x-1">
                                  <Briefcase01Icon className="h-3 w-3" />
                                  <span>₹{staff.assignment_earnings.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-blue-600">
                              ₹{staff.paid_amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span 
                              className={`text-sm font-medium ${staff.pending_amount > 0 
                                ? "text-orange-600" 
                                : "text-gray-600"
                              }`}
                            >
                              ₹{staff.pending_amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="action-edit"
                                size="sm"
                                onClick={() => handlePaySalary(staff)}
                                className={cn(
                                  "h-9 w-9 p-0 rounded-full",
                                  staff.pending_amount <= 0 
                                    ? "cursor-not-allowed opacity-50" 
                                    : "cursor-pointer"
                                )}
                                title={staff.pending_amount <= 0 ? "No pending payment" : "Pay salary"}
                                disabled={staff.pending_amount <= 0}
                              >
                                <DollarCircleIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="action-neutral"
                                size="sm"
                                onClick={() => { setSelectedForAssignment(staff); setAssignmentDialogOpen(true); }}
                                className="h-9 w-9 p-0 rounded-full"
                                title="Assignment rates"
                              >
                                <Settings02Icon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="action-report"
                                size="sm"
                                onClick={() => handleViewStaffDetailedReport(staff)}
                                className="h-9 w-9 p-0 rounded-full"
                                title="Detailed report"
                              >
                                <Download01Icon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="action-status"
                                size="sm"
                                onClick={() => handleViewHistory(staff)}
                                className="h-9 w-9 p-0 rounded-full"
                                title="View payment history"
                              >
                                <Calendar01Icon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                       ))}
                     </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
                  <p className="text-muted-foreground">No staff members found matching your criteria.</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : currentView === 'freelancers' ? (
        <div className="space-y-4">
          
          {/* Search, Sort & Filter for Freelancers */}
          <SearchSortFilter
            searchValue={freelancerSearchValue}
            onSearchChange={setFreelancerSearchValue}
            sortOptions={[
              { key: 'full_name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'total_earnings', label: 'Total Earnings' },
              { key: 'pending_amount', label: 'Pending Amount' }
            ]}
            currentSort={freelancerCurrentSort}
            sortDirection={freelancerSortDirection}
            onSortChange={handleFreelancerSortChange}
            onSortDirectionToggle={handleFreelancerSortDirectionToggle}
            filterOptions={[
              {
                key: 'role',
                label: 'Role',
                type: 'checkbox',
                options: getRoleOptions(true).map(role => ({ 
                  value: role.value.toLowerCase(), 
                  label: role.label 
                }))
              },
              {
                key: 'payment_status',
                label: 'Payment Status',
                type: 'select',
                options: [
                  { value: 'fully_paid', label: 'Fully Paid' },
                  { value: 'partial_paid', label: 'Partially Paid' },
                  { value: 'pending_payment', label: 'Payment Pending' },
                  { value: 'overpaid', label: 'Overpaid' },
                  { value: 'no_earnings', label: 'No Earnings' }
                ]
              },
              {
                key: 'earning_range',
                label: 'Earning Range',
                type: 'select',
                options: [
                  { value: 'under_5k', label: 'Under ₹5,000' },
                  { value: '5k_25k', label: '₹5,000 - ₹25,000' },
                  { value: '25k_75k', label: '₹25,000 - ₹75,000' },
                  { value: 'above_75k', label: 'Above ₹75,000' }
                ]
              },
              {
                key: 'assignment_count',
                label: 'Assignment Count',
                type: 'select',
                options: [
                  { value: 'no_assignments', label: 'No Assignments' },
                  { value: '1_3', label: '1-3 Assignments' },
                  { value: '4_10', label: '4-10 Assignments' },
                  { value: 'above_10', label: '10+ Assignments' }
                ]
              },
              {
                key: 'task_completion',
                label: 'Task Status',
                type: 'select',
                options: [
                  { value: 'all_completed', label: 'All Tasks Completed' },
                  { value: 'pending_tasks', label: 'Has Pending Tasks' },
                  { value: 'no_tasks', label: 'No Tasks Assigned' }
                ]
              }
            ]}
            activeFilters={freelancerActiveFilters}
            onFilterChange={handleFreelancerFilterChange}
            searchPlaceholder="Search freelancers..."
          />
          
          {isMobile ? (
          <SalaryCardView
            data={filteredFreelancerData || []}
            type="freelancer"
            onPaySalary={handlePayFreelancer}
            onViewHistory={handleViewFreelancerHistory}
            onAssignmentRates={handleAssignmentRates}
            onDetailedReport={handleViewDetailedReport}
            loading={freelancerLoading}
          />
        ) : (
          <>
            {filteredFreelancerData && filteredFreelancerData.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="text-center font-semibold">Freelancer</TableHead>
                         <TableHead className="text-center font-semibold">Role</TableHead>
                         <TableHead className="text-center font-semibold">Assignments</TableHead>
                         <TableHead className="text-center font-semibold">Tasks</TableHead>
                         <TableHead className="text-center font-semibold">Earnings</TableHead>
                         <TableHead className="text-center font-semibold">Paid</TableHead>
                         <TableHead className="text-center font-semibold">Pending</TableHead>
                         <TableHead className="text-center font-semibold">Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                        {filteredFreelancerData.map((freelancer) => (
                         <TableRow key={freelancer.id} className="hover:bg-muted/50">
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center space-x-3">
                               <Avatar className="h-10 w-10">
                                 <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                   {getInitials(freelancer.full_name)}
                                 </AvatarFallback>
                               </Avatar>
                               <div>
                                 <p className="font-medium">{freelancer.full_name}</p>
                                 <p className="text-sm text-muted-foreground">
                                   {freelancer.phone || freelancer.email || 'No contact'}
                                 </p>
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <span className={`text-sm font-medium ${getRoleColor(freelancer.role)}`}>
                               {freelancer.role}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center">
                               <Briefcase01Icon className="h-4 w-4 mr-1 text-muted-foreground" />
                               {freelancer.total_assignments}
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center space-x-1">
                               <span className="text-sm font-medium text-blue-600">
                                 {freelancer.total_tasks}
                               </span>
                               <span className="text-sm text-muted-foreground">=</span>
                               <span className="text-sm font-medium text-green-600">
                                 {freelancer.completed_tasks}
                               </span>
                               <span className="text-sm text-muted-foreground">+</span>
                               <span className="text-sm font-medium text-red-600">
                                 {freelancer.total_tasks - freelancer.completed_tasks}
                               </span>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex flex-col items-center space-y-1">
                               <span className="font-semibold">₹{freelancer.total_earnings.toLocaleString()}</span>
                               <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                 <div className="flex items-center space-x-1">
                                   <TaskDone01Icon className="h-3 w-3" />
                                   <span>₹{freelancer.task_earnings.toLocaleString()}</span>
                                 </div>
                                 <span>+</span>
                                 <div className="flex items-center space-x-1">
                                   <Briefcase01Icon className="h-3 w-3" />
                                   <span>₹{freelancer.assignment_earnings.toLocaleString()}</span>
                                 </div>
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <span className="text-sm font-medium text-blue-600">
                               ₹{freelancer.paid_amount.toLocaleString()}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <span 
                               className={`text-sm font-medium ${freelancer.pending_amount > 0 
                                 ? "text-orange-600" 
                                 : "text-gray-600"
                               }`}
                             >
                               ₹{freelancer.pending_amount.toLocaleString()}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center gap-2">
                               <Button
                                 variant="action-edit"
                                 size="sm"
                                 onClick={() => handlePayFreelancer(freelancer)}
                                 className={cn(
                                   "h-9 w-9 p-0 rounded-full",
                                   freelancer.pending_amount <= 0 
                                     ? "cursor-not-allowed opacity-50" 
                                     : "cursor-pointer"
                                 )}
                                 title={freelancer.pending_amount <= 0 ? "No pending payment" : "Pay salary"}
                                 disabled={freelancer.pending_amount <= 0}
                               >
                                 <DollarCircleIcon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-neutral"
                                 size="sm"
                                 onClick={() => handleAssignmentRates(freelancer)}
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="Assignment rates"
                               >
                                 <Settings02Icon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-report"
                                 size="sm"
                                 onClick={() => handleViewDetailedReport(freelancer)}
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="Detailed report"
                               >
                                 <Download01Icon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-status"
                                 size="sm"
                                 onClick={() => handleViewFreelancerHistory(freelancer)}
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="View payment history"
                               >
                                 <Calendar01Icon className="h-4 w-4" />
                               </Button>
                             </div>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Briefcase01Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Freelancers Found</h3>
                  <p className="text-muted-foreground">No freelancers found matching your criteria.</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Mix View - Single unified table with both staff and freelancers */
        <div className="space-y-4">
          {/* Search, Sort & Filter for Mix View */}
          <SearchSortFilter
            searchValue={mixSearchValue}
            onSearchChange={setMixSearchValue}
            sortOptions={[
              { key: 'full_name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'total_earnings', label: 'Total Earnings' },
              { key: 'pending_amount', label: 'Pending Amount' }
            ]}
            currentSort={mixCurrentSort}
            sortDirection={mixSortDirection}
            onSortChange={handleMixSortChange}
            onSortDirectionToggle={handleMixSortDirectionToggle}
            filterOptions={[
              {
                key: 'role',
                label: 'Role',
                type: 'checkbox',
                options: [...getRoleOptions(false), ...getRoleOptions(true)].reduce((unique, role) => {
                  if (!unique.find(r => r.value === role.value.toLowerCase())) {
                    unique.push({ value: role.value.toLowerCase(), label: role.label });
                  }
                  return unique;
                }, [] as Array<{ value: string; label: string }>)
              },
              {
                key: 'type',
                label: 'Type',
                type: 'select',
                options: [
                  { value: 'staff', label: 'Staff' },
                  { value: 'freelancer', label: 'Freelancer' }
                ]
              },
              {
                key: 'payment_status',
                label: 'Payment Status',
                type: 'select',
                options: [
                  { value: 'fully_paid', label: 'Fully Paid' },
                  { value: 'partial_paid', label: 'Partially Paid' },
                  { value: 'pending_payment', label: 'Payment Pending' },
                  { value: 'overpaid', label: 'Overpaid' },
                  { value: 'no_earnings', label: 'No Earnings' }
                ]
              },
              {
                key: 'earning_range',
                label: 'Earning Range',
                type: 'select',
                options: [
                  { value: 'under_10k', label: 'Under ₹10,000' },
                  { value: '10k_50k', label: '₹10,000 - ₹50,000' },
                  { value: '50k_100k', label: '₹50,000 - ₹1,00,000' },
                  { value: 'above_100k', label: 'Above ₹1,00,000' }
                ]
              },
              {
                key: 'assignment_count',
                label: 'Assignment Count',
                type: 'select',
                options: [
                  { value: 'no_assignments', label: 'No Assignments' },
                  { value: '1_5', label: '1-5 Assignments' },
                  { value: '6_15', label: '6-15 Assignments' },
                  { value: 'above_15', label: '15+ Assignments' }
                ]
              },
              {
                key: 'task_completion',
                label: 'Task Status',
                type: 'select',
                options: [
                  { value: 'all_completed', label: 'All Tasks Completed' },
                  { value: 'pending_tasks', label: 'Has Pending Tasks' },
                  { value: 'no_tasks', label: 'No Tasks Assigned' }
                ]
              }
            ]}
            activeFilters={mixActiveFilters}
            onFilterChange={handleMixFilterChange}
            searchPlaceholder="Search staff and freelancers..."
          />
          
          {isMobile ? (
            <SalaryCardView
              data={filteredMixData || []}
              type="mixed"
              onPaySalary={(person) => person.type === 'staff' ? handlePaySalary(person) : handlePayFreelancer(person)}
              onViewHistory={(person) => person.type === 'staff' ? handleViewHistory(person) : handleViewFreelancerHistory(person)}
              onAssignmentRates={(person) => person.type === 'staff' ? setSelectedForAssignment(person) : handleAssignmentRates(person)}
              onDetailedReport={(person) => person.type === 'staff' ? handleViewStaffDetailedReport(person) : handleViewDetailedReport(person)}
              loading={loading || freelancerLoading}
            />
          ) : (
            <>
              {(filteredMixData && filteredMixData.length > 0) ? (
                <div className="rounded-md border">
                  <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="text-center font-semibold">Type</TableHead>
                         <TableHead className="text-center font-semibold">Name</TableHead>
                         <TableHead className="text-center font-semibold">Role</TableHead>
                         <TableHead className="text-center font-semibold">Assignments</TableHead>
                         <TableHead className="text-center font-semibold">Tasks</TableHead>
                         <TableHead className="text-center font-semibold">Earnings</TableHead>
                         <TableHead className="text-center font-semibold">Paid</TableHead>
                         <TableHead className="text-center font-semibold">Pending</TableHead>
                         <TableHead className="text-center font-semibold">Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {/* Mix Mode - Filtered Data */}
                       {filteredMixData?.map((person) => (
                         <TableRow key={`${person.type}-${person.id}`} className="hover:bg-muted/50">
                           <TableCell className="text-center">
                             {person.type === 'staff' ? (
                               <UserIcon className="h-4 w-4 text-blue-600" />
                             ) : (
                               <Briefcase01Icon className="h-4 w-4 text-purple-600" />
                             )}
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center space-x-3">
                               <Avatar className="h-10 w-10">
                                 <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                   {getInitials(person.full_name)}
                                 </AvatarFallback>
                               </Avatar>
                               <div>
                                 <p className="font-medium">{person.full_name}</p>
                                 <p className="text-sm text-muted-foreground">
                                   {person.type === 'staff' ? person.mobile_number : (person.phone || person.email || 'No contact')}
                                 </p>
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <span className={`text-sm font-medium ${getRoleColor(person.role)}`}>
                               {person.type === 'staff' ? displayRole(person.role) : person.role}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center">
                               <Briefcase01Icon className="h-4 w-4 mr-1 text-muted-foreground" />
                               {person.total_assignments || 0}
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center space-x-1">
                               <span className="text-sm font-medium text-blue-600">
                                 {person.total_tasks || 0}
                               </span>
                               <span className="text-sm text-muted-foreground">=</span>
                               <span className="text-sm font-medium text-green-600">
                                 {person.completed_tasks || 0}
                               </span>
                               <span className="text-sm text-muted-foreground">+</span>
                               <span className="text-sm font-medium text-red-600">
                                 {(person.total_tasks || 0) - (person.completed_tasks || 0)}
                               </span>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex flex-col items-center space-y-1">
                               <span className="font-semibold">₹{person.total_earnings.toLocaleString()}</span>
                               <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                 <div className="flex items-center space-x-1">
                                   <TaskDone01Icon className="h-3 w-3" />
                                   <span>₹{person.task_earnings.toLocaleString()}</span>
                                 </div>
                                 <span>+</span>
                                 <div className="flex items-center space-x-1">
                                   <Briefcase01Icon className="h-3 w-3" />
                                   <span>₹{person.assignment_earnings.toLocaleString()}</span>
                                 </div>
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">
                             <span className="text-sm font-medium text-blue-600">
                               ₹{person.paid_amount.toLocaleString()}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <span 
                               className={`text-sm font-medium ${person.pending_amount > 0 
                                 ? "text-orange-600" 
                                 : "text-gray-600"
                               }`}
                             >
                               ₹{person.pending_amount.toLocaleString()}
                             </span>
                           </TableCell>
                           <TableCell className="text-center">
                             <div className="flex items-center justify-center gap-2">
                               <Button
                                 variant="action-edit"
                                 size="sm"
                                 onClick={() => person.type === 'staff' ? handlePaySalary(person) : handlePayFreelancer(person)}
                                 className={cn(
                                   "h-9 w-9 p-0 rounded-full",
                                   person.pending_amount <= 0 
                                     ? "cursor-not-allowed opacity-50" 
                                     : "cursor-pointer"
                                 )}
                                 title={person.pending_amount <= 0 ? "No pending payment" : "Pay salary"}
                                 disabled={person.pending_amount <= 0}
                               >
                                 <DollarCircleIcon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-neutral"
                                 size="sm"
                                 onClick={() => {
                                   if (person.type === 'staff') {
                                     setSelectedForAssignment(person);
                                     setAssignmentDialogOpen(true);
                                   } else {
                                     handleAssignmentRates(person);
                                   }
                                 }}
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="Assignment rates"
                               >
                                 <Settings02Icon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-report"
                                 size="sm"
                                 onClick={() => person.type === 'staff' 
                                   ? handleViewStaffDetailedReport(person) 
                                   : handleViewDetailedReport(person)
                                 }
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="Detailed report"
                               >
                                 <Download01Icon className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="action-status"
                                 size="sm"
                                 onClick={() => person.type === 'staff' 
                                   ? handleViewHistory(person) 
                                   : handleViewFreelancerHistory(person)
                                 }
                                 className="h-9 w-9 p-0 rounded-full"
                                 title="View payment history"
                               >
                                 <Calendar01Icon className="h-4 w-4" />
                               </Button>
                             </div>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserGroupIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                  <p className="text-muted-foreground">
                    No staff or freelancer data available.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      {payDialogOpen && selectedStaff && (
        <PaySalaryDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          staff={selectedStaff}
          onSuccess={onPaymentSuccess}
        />
      )}

      {historyDialogOpen && selectedStaff && (
        <SalaryHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          staff={selectedStaff}
        />
      )}

      {assignmentDialogOpen && selectedForAssignment && (
        <EventAssignmentRatesDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          staff={selectedForAssignment}
          onSuccess={() => {
            refetchAll();
            setAssignmentDialogOpen(false);
          }}
        />
      )}

      {detailedReportOpen && selectedForDetailedReport && (
        <FreelancerDetailedReportDialog
          open={detailedReportOpen}
          onOpenChange={setDetailedReportOpen}
          freelancer={selectedForDetailedReport}
        />
      )}

      {staffDetailedReportOpen && selectedStaffForDetailedReport && (
        <StaffDetailedReportDialog
          open={staffDetailedReportOpen}
          onOpenChange={setStaffDetailedReportOpen}
          staff={selectedStaffForDetailedReport}
        />
      )}
    </>
  );
};

export default SalaryManagement;
