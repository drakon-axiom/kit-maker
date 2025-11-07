import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PackageCheck, 
  ClipboardList, 
  Factory as FactoryIcon, 
  TruckIcon,
  AlertCircle 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Stats {
  totalOrders: number;
  inProduction: number;
  readyToShip: number;
  shipped: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    inProduction: 0,
    readyToShip: 0,
    shipped: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('status');

      if (error) throw error;

      const stats = {
        totalOrders: orders?.length || 0,
        inProduction: orders?.filter(o => 
          ['in_queue', 'in_production'].includes(o.status)
        ).length || 0,
        readyToShip: orders?.filter(o => o.status === 'ready_to_ship').length || 0,
        shipped: orders?.filter(o => o.status === 'shipped').length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ClipboardList,
      color: 'text-primary',
    },
    {
      title: 'In Production',
      value: stats.inProduction,
      icon: FactoryIcon,
      color: 'text-warning',
    },
    {
      title: 'Ready to Ship',
      value: stats.readyToShip,
      icon: PackageCheck,
      color: 'text-success',
    },
    {
      title: 'Shipped',
      value: stats.shipped,
      icon: TruckIcon,
      color: 'text-muted-foreground',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Production management overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalOrders === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Get started by creating your first order, or contact an admin to set up customers and products.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;