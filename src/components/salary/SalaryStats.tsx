import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import StatCard from '@/components/ui/stat-card';
import { 
  MoneyBag02Icon, 
  DollarCircleIcon, 
  UserIcon, 
  ChartBarLineIcon,
  Alert01Icon,
  Calendar01Icon
} from 'hugeicons-react';

interface SalaryStatsProps {
  stats: {
    totalStaff: number;
    totalFreelancers: number;
    taskPaymentsTotal: number;
    assignmentRatesTotal: number;
    totalPaid: number;
    totalPending: number;
    avgPerPerson: number;
    totalEarnings: number;
  } | null;
  loading: boolean;
  mode: 'staff' | 'freelancers' | 'mix';
}

const SalaryStats = ({ stats, loading, mode }: SalaryStatsProps) => {
  const { profile, currentFirmId } = useAuth();
  const [paymentBreakdowns, setPaymentBreakdowns] = useState<any>({});

  useEffect(() => {
    if (currentFirmId && stats) {
      fetchPaymentBreakdowns();
    }
  }, [currentFirmId, stats, mode]);

  const fetchPaymentBreakdowns = async () => {
    if (!currentFirmId) return;

    try {
      // 🚀 Mode-aware breakdowns for salary-specific data (no date filtering needed)
      const [staffPaymentsResult, freelancerPaymentsResult, taskPaymentsResult] = await Promise.all([
        supabase.from('staff_payments').select('amount, payment_method').eq('firm_id', currentFirmId),
        supabase.from('freelancer_payments').select('amount, payment_method').eq('firm_id', currentFirmId),
        supabase.from('tasks')
          .select('amount, salary_details, assigned_to, freelancer_id')
          .eq('firm_id', currentFirmId)
          .not('amount', 'is', null)
          .gt('amount', 0)
      ]);

      const calculateBreakdown = (data: any[]) =>
        data?.reduce((acc, item) => {
          if (item.payment_method === 'Cash') {
            acc.cash += Number(item.amount) || 0;
          } else {
            acc.digital += Number(item.amount) || 0;
          }
          return acc;
        }, { cash: 0, digital: 0 }) || { cash: 0, digital: 0 };

      // Base payment method breakdowns
      const staffBreakdown = calculateBreakdown(staffPaymentsResult.data || []);
      const freelancerBreakdown = calculateBreakdown(freelancerPaymentsResult.data || []);

      // Task payment breakdowns (from salary details) split by assignment type
      const tasks = (taskPaymentsResult.data || []) as any[];
      const reduceTasks = (predicate: (t: any) => boolean) =>
        tasks.reduce((acc, task) => {
          if (!predicate(task)) return acc;
          const salaryDetails = task.salary_details as any;
          const paymentMethod = salaryDetails?.payment_method || 'Cash';
          const amt = Number(task.amount) || 0;
          if (paymentMethod === 'Cash') acc.cash += amt; else acc.digital += amt;
          return acc;
        }, { cash: 0, digital: 0 });

      const taskBreakdownStaff = reduceTasks(t => !!t.assigned_to && !t.freelancer_id);
      const taskBreakdownFreelancer = reduceTasks(t => !!t.freelancer_id);
      const taskBreakdownAll = reduceTasks(() => true);

      // Select breakdowns per mode
      const selectedTaskBreakdown = mode === 'staff' 
        ? taskBreakdownStaff 
        : mode === 'freelancers' 
          ? taskBreakdownFreelancer 
          : taskBreakdownAll;

      const selectedPaidBreakdown = mode === 'staff'
        ? staffBreakdown
        : mode === 'freelancers'
          ? freelancerBreakdown
          : {
              cash: staffBreakdown.cash + freelancerBreakdown.cash,
              digital: staffBreakdown.digital + freelancerBreakdown.digital,
            };

      // Calculate assignment payments = total paid - task payments
      const assignmentPaymentsBreakdown = {
        cash: Math.max(0, selectedPaidBreakdown.cash - selectedTaskBreakdown.cash),
        digital: Math.max(0, selectedPaidBreakdown.digital - selectedTaskBreakdown.digital),
      };

      // Total earnings = paid + task payments (assignment rates have no payment method)
      const selectedTotalEarningsBreakdown = {
        cash: selectedPaidBreakdown.cash + selectedTaskBreakdown.cash,
        digital: selectedPaidBreakdown.digital + selectedTaskBreakdown.digital,
      };

      setPaymentBreakdowns({
        totalEarnings: selectedTotalEarningsBreakdown,
        totalPaid: selectedPaidBreakdown,
        taskPayments: selectedTaskBreakdown,
        assignmentRates: assignmentPaymentsBreakdown, // Assignment payments = total paid - task payments
      });
    } catch (error) {
      console.error('Error fetching payment breakdowns:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-1 sm:gap-3 md:gap-4 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 h-[80px] sm:h-[150px] flex flex-col items-center justify-center bg-white border-2 border-primary/30 rounded-full shadow-sm animate-pulse">
            <div className="flex flex-col items-center justify-center space-y-0 p-1 sm:pb-1 md:pb-1 sm:px-2 md:px-3 sm:pt-1 md:pt-2">
              <div className="hidden sm:block p-1 md:p-2 rounded-full bg-primary/10 mb-1 md:mb-1">
                <div className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 rounded-full bg-gray-300 animate-pulse" />
              </div>
              <div className="h-2 sm:h-3 md:h-4 w-12 sm:w-16 md:w-20 rounded bg-gray-300 animate-pulse" />
            </div>
            <div className="flex items-center justify-center pt-0 pb-1 sm:pb-1 md:pb-2 px-1 sm:px-2 md:px-3">
              <div className="h-3 sm:h-4 md:h-6 w-6 sm:w-8 md:w-12 rounded bg-gray-300 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 🚀 OPTIMIZED: Using the StatCard component consistently
  const statItems = [
    // Top row (4 cards)
    {
      title: "Total Staff",
      value: stats?.totalStaff || 0,
      icon: <UserIcon className="h-4 w-4" />,
      colorClass: "bg-primary/10 text-primary"
    },
    {
      title: "Total Freelancer",
      value: stats?.totalFreelancers || 0,
      icon: <UserIcon className="h-4 w-4" />,
      colorClass: "bg-primary/10 text-primary"
    },
    {
      title: "Total People",
      value: (stats?.totalStaff || 0) + (stats?.totalFreelancers || 0),
      icon: <UserIcon className="h-4 w-4" />,
      colorClass: "bg-primary/10 text-primary"
    },
    {
      title: "Avg per Person",
      value: `₹${Math.round(stats?.avgPerPerson || 0).toLocaleString()}`,
      icon: <ChartBarLineIcon className="h-4 w-4" />,
      colorClass: "bg-primary/10 text-primary"
    },
    // Bottom row (4 cards)
    {
      title: "Task Payments Total",
      value: `₹${(stats?.taskPaymentsTotal || 0).toLocaleString()}`,
      icon: <MoneyBag02Icon className="h-4 w-4" />,
      colorClass: "bg-success/10 text-success"
    },
    {
      title: "Assignment Rate Total",
      value: `₹${(stats?.assignmentRatesTotal || 0).toLocaleString()}`,
      icon: <DollarCircleIcon className="h-4 w-4" />,
      colorClass: "bg-info/10 text-info"
    },
    {
      title: "Total Paid",
      value: `₹${(stats?.totalPaid || 0).toLocaleString()}`,
      icon: <Calendar01Icon className="h-4 w-4" />,
      colorClass: "bg-success/10 text-success"
    },
    {
      title: "Total Pending",
      value: `₹${(stats?.totalPending || 0).toLocaleString()}`,
      icon: <Alert01Icon className="h-4 w-4" />,
      colorClass: stats?.totalPending && stats.totalPending > 0 ? "bg-warning/10 text-warning" : "bg-gray-100 text-gray-600"
    }
  ];

  return (
    <div className="flex gap-1 sm:gap-3 md:gap-4 w-full">
      <StatCard
        title="Total Earnings"
        value={`₹${(stats?.totalEarnings || 0).toLocaleString()}`}
        icon={<MoneyBag02Icon className="h-4 w-4" />}
        colorClass="bg-primary/20 text-primary"
      />
      <StatCard
        title="Total Paid"
        value={`₹${(stats?.totalPaid || 0).toLocaleString()}`}
        icon={<Calendar01Icon className="h-4 w-4" />}
        colorClass="bg-primary/20 text-primary"
        paymentBreakdown={paymentBreakdowns.totalPaid}
      />
      <StatCard
        title="Task Payments"
        value={`₹${(stats?.taskPaymentsTotal || 0).toLocaleString()}`}
        icon={<DollarCircleIcon className="h-4 w-4" />}
        colorClass="bg-primary/20 text-primary"
        paymentBreakdown={paymentBreakdowns.taskPayments}
      />
      <StatCard
        title="Assignment Rates"
        value={`₹${(stats?.assignmentRatesTotal || 0).toLocaleString()}`}
        icon={<ChartBarLineIcon className="h-4 w-4" />}
        colorClass="bg-primary/20 text-primary"
      />
    </div>
  );
};

export default SalaryStats;
