import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PackageCheck, 
  ClipboardList, 
  Factory as FactoryIcon, 
  TruckIcon,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ExpiringQuotesWidget from '@/components/ExpiringQuotesWidget';
import InternalOrdersWidget from '@/components/InternalOrdersWidget';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';

interface Stats {
  totalOrders: number;
  inProduction: number;
  readyToShip: number;
  shipped: number;
}

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    inProduction: 0,
    readyToShip: 0,
    shipped: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Wait for auth session to be ready
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('Dashboard: No session found, waiting...');
        setLoading(false);
        return;
      }

      const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('status');

      if (error) {
        console.error('Dashboard fetch error:', error);
        throw error;
      }

      console.log('Dashboard: Fetched orders count:', orders?.length);

      const stats = {
        totalOrders: orders?.filter(o => o.status !== 'cancelled').length || 0,
        inProduction: orders?.filter(o => 
          ['in_queue', 'in_production'].includes(o.status)
        ).length || 0,
        readyToShip: orders?.filter(o => o.status === 'ready_to_ship').length || 0,
        shipped: orders?.filter(o => o.status === 'shipped').length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Listen for auth state changes and refetch
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchStats();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchStats]);

  const handleRefresh = async () => {
    await fetchStats();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs md:text-base text-muted-foreground mt-1">
          Production management overview
        </p>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="touch-target">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalOrders === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <AlertCircle className="h-10 md:h-12 w-10 md:w-12 text-muted-foreground mb-4" />
            <h3 className="text-base md:text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-xs md:text-sm text-muted-foreground text-center max-w-md px-4">
              Get started by creating your first order, or contact an admin to set up customers and products.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <ExpiringQuotesWidget />
        <InternalOrdersWidget />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        {content}
      </PullToRefresh>
    );
  }

  return content;
};

export default Dashboard;