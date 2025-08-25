
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  ClipboardList,
  Users,
  FileText,
  Download
} from 'lucide-react';
import StaffDetailedStatCard from './StaffDetailedStatCard';
import { generateStaffDashboardPDF } from './StaffDashboardPDF';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  reportedTasks: number;
  totalAssignments: number;
  completedEvents: number;
  upcomingEvents: number;
  totalEarnings: number;
  taskEarnings: number;
  assignmentEarnings: number;
  paidAmount: number;
  pendingAmount: number;
}

const StaffDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    reportedTasks: 0,
    totalAssignments: 0,
    completedEvents: 0,
    upcomingEvents: 0,
    totalEarnings: 0,
    taskEarnings: 0,
    assignmentEarnings: 0,
    paidAmount: 0,
    pendingAmount: 0
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
    }
  }, [profile?.id]);

  const fetchDashboardData = async () => {
    if (!profile?.id) return;

    try {
      // Fetch tasks assigned to this staff member (including freelancer tasks)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          event:events(title, event_date)
        `)
        .or(`assigned_to.eq.${profile.id},freelancer_id.eq.${profile.id}`);

      if (tasksError) throw tasksError;

      // Fetch staff payments
      const { data: payments, error: paymentsError } = await supabase
        .from('staff_payments')
        .select('amount, payment_date')
        .eq('staff_id', profile.id);

      if (paymentsError) throw paymentsError;

      // Fetch assignments for this staff member
      const { data: assignments, error: assignmentsError } = await supabase
        .from('event_staff_assignments')
        .select(`
          *,
          event:events(
            id, title, event_type, event_date,
            client:clients(name)
          )
        `)
        .eq('staff_id', profile.id);

      if (assignmentsError) throw assignmentsError;

      // Calculate task stats
      const completedTasks = tasks?.filter(t => t.status === 'Completed').length || 0;
      const pendingTasks = tasks?.filter(t => t.status === 'Pending' || t.status === 'In Progress' || t.status === 'Waiting for Response').length || 0;
      const reportedTasks = tasks?.filter(t => t.status === 'Reported').length || 0;

      // Calculate assignment stats
      const today = new Date();
      const completedEvents = assignments?.filter(a => 
        a.event && new Date(a.event.event_date) < today
      ).length || 0;
      const upcomingEvents = assignments?.filter(a => 
        a.event && new Date(a.event.event_date) >= today
      ).length || 0;

      // Calculate earnings
      const taskEarnings = tasks?.filter(t => t.amount && t.status === 'Completed')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const assignmentEarnings = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalEarnings = taskEarnings + assignmentEarnings;
      
      // For now, assuming all earnings are paid (can be enhanced later with payment tracking)
      const paidAmount = assignmentEarnings;
      const pendingAmount = taskEarnings; // Task earnings are typically pending

      setStats({
        totalTasks: tasks?.length || 0,
        completedTasks,
        pendingTasks,
        reportedTasks,
        totalAssignments: assignments?.length || 0,
        completedEvents,
        upcomingEvents,
        totalEarnings,
        taskEarnings,
        assignmentEarnings,
        paidAmount,
        pendingAmount
      });

      // Set recent data
      setRecentTasks(tasks?.slice(0, 5) || []);
      setRecentAssignments(assignments?.slice(0, 5) || []);

    } catch (error: any) {
      // Dashboard data loading error
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const dashboardData = {
        profile: {
          full_name: profile?.full_name || 'Unknown',
          role: profile?.role || 'Staff',
          mobile_number: profile?.mobile_number
        },
        stats,
        tasks: recentTasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority || 'Medium',
          due_date: task.due_date,
          amount: task.amount,
          event: task.event
        })),
        assignments: recentAssignments.map(assignment => ({
          id: assignment.id,
          event_title: assignment.event?.title || 'Unknown Event',
          event_type: assignment.event?.event_type || 'Unknown',
          event_date: assignment.event?.event_date || new Date().toISOString(),
          role: assignment.role,
          day_number: assignment.day_number,
          client_name: assignment.event?.client?.name
        }))
      };

      await generateStaffDashboardPDF(dashboardData);
      toast({
        title: "PDF Generated",
        description: "Your dashboard report has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-8 px-2 sm:px-6 py-6">
      {/* Header with PDF Export */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <Button 
          onClick={handleGeneratePDF}
          className="rounded-full px-6"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
        <StaffDetailedStatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={ClipboardList}
          colorClass="bg-primary/10 text-primary"
          metadata={[
            { label: "Completed", value: stats.completedTasks, colorClass: "text-success" },
            { label: "Pending", value: stats.pendingTasks, colorClass: "text-warning" },
            { label: "Reported", value: stats.reportedTasks, colorClass: "text-info" }
          ]}
        />
        
        <StaffDetailedStatCard
          title="Total Assignments"
          value={stats.totalAssignments}
          icon={Users}
          colorClass="bg-info/10 text-info"
          metadata={[
            { label: "Completed Events", value: stats.completedEvents, colorClass: "text-success" },
            { label: "Upcoming Events", value: stats.upcomingEvents, colorClass: "text-warning" },
            { label: "Active Status", value: stats.totalAssignments > 0 ? "Active" : "~", colorClass: "text-muted-foreground" }
          ]}
        />
        
        <StaffDetailedStatCard
          title="Total Earnings"
          value={`₹${stats.totalEarnings.toLocaleString()}`}
          icon={DollarSign}
          colorClass="bg-success/10 text-success"
          metadata={[
            { label: "Task Earnings", value: `₹${stats.taskEarnings.toLocaleString()}`, colorClass: "text-primary" },
            { label: "Assignment Earnings", value: `₹${stats.assignmentEarnings.toLocaleString()}`, colorClass: "text-primary" },
            { label: "Pending Amount", value: `₹${stats.pendingAmount.toLocaleString()}`, colorClass: "text-warning" }
          ]}
        />
      </div>

      {/* Recent Tasks and Assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tasks assigned yet</p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-full hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium truncate">{task.title}</h4>
                      {task.event && (
                        <p className="text-sm text-muted-foreground truncate">{task.event.title}</p>
                      )}
                      {task.amount && (
                        <p className="text-sm font-medium text-primary">₹{Number(task.amount).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`rounded-full ${
                          task.status === 'Completed' 
                            ? 'bg-status-completed-bg text-status-completed border-status-completed-border'
                            : task.status === 'In Progress'
                            ? 'bg-status-in-progress-bg text-status-in-progress border-status-in-progress-border'
                            : 'bg-status-pending-bg text-status-pending border-status-pending-border'
                        }`}
                      >
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Assignments */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAssignments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No assignments yet</p>
            ) : (
              <div className="space-y-3">
                {recentAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-full hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium truncate">{assignment.event?.title || 'Unknown Event'}</h4>
                      <p className="text-sm text-muted-foreground">{assignment.role} - Day {assignment.day_number}</p>
                      {assignment.event?.client?.name && (
                        <p className="text-sm text-muted-foreground">Client: {assignment.event.client.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {assignment.event?.event_date ? new Date(assignment.event.event_date).toLocaleDateString() : '~'}
                      </p>
                      <Badge variant="outline" className="rounded-full text-xs">
                        {assignment.event?.event_type || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffDashboard;
