import StatsGrid from '@/components/ui/stats-grid';
import { Users, Mail, MapPin, Calendar } from 'lucide-react';
import { Client } from '@/types/studio';

interface ClientStatsProps {
  clients: Client[];
  loading?: boolean;
}

const ClientStats: React.FC<ClientStatsProps> = ({ clients, loading }) => {
  const stats = {
    total: clients.length,
    withEmail: clients.filter(client => client.email && client.email.trim() !== '').length,
    withAddress: clients.filter(client => client.address && client.address.trim() !== '').length,
    recentlyAdded: clients.filter(client => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return new Date(client.created_at) >= oneWeekAgo;
    }).length
  };

  if (loading) {
    return (
      <div className="flex gap-1 sm:gap-3 md:gap-4 w-full">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex-1 bg-card rounded-lg border p-4 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </div>
            <div className="h-8 bg-muted rounded w-16 mb-1"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <StatsGrid stats={[
      {
        title: "Total Clients",
        value: stats.total,
        icon: <Users className="h-4 w-4" />,
        colorClass: "bg-primary/20 text-primary"
      },
      {
        title: "With Email",
        value: `${stats.withEmail} (${stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) : 0}%)`,
        icon: <Mail className="h-4 w-4" />,
        colorClass: "bg-primary/15 text-primary"
      },
      {
        title: "With Address", 
        value: `${stats.withAddress} (${stats.total > 0 ? Math.round((stats.withAddress / stats.total) * 100) : 0}%)`,
        icon: <MapPin className="h-4 w-4" />,
        colorClass: "bg-primary/25 text-primary"
      },
      {
        title: "Recent",
        value: stats.recentlyAdded,
        icon: <Calendar className="h-4 w-4" />,
        colorClass: "bg-primary/10 text-primary"
      }
    ]} />
  );
};

export default ClientStats;