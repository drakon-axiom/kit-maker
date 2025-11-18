import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import axiomLogo from '@/assets/axiom-logo.png';
import { Badge } from '@/components/ui/badge';
import {
  Factory,
  PackageSearch,
  ClipboardList,
  Users,
  Package,
  Settings,
  Boxes,
  TruckIcon,
  Mail,
  Tags,
  UserPlus,
  Monitor,
  ShieldCheck,
  UserCog,
  History,
  MessageSquare,
  Palette,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { state } = useSidebar();
  const { userRole } = useAuth();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPendingRequestsCount();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('order_comments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_comments'
          },
          () => {
            fetchPendingRequestsCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole]);

  const fetchPendingRequestsCount = async () => {
    const { count } = await supabase
      .from('order_comments')
      .select('*', { count: 'exact', head: true })
      .in('comment_type', ['cancellation_request', 'modification_request'])
      .eq('request_status', 'pending');
    
    setPendingRequestsCount(count || 0);
  };

  const mainItems = [
    { title: 'Dashboard', url: '/', icon: Factory },
    { title: 'Orders', url: '/orders', icon: ClipboardList },
    { title: 'Production Queue', url: '/queue', icon: Boxes },
    { title: 'Operator Console', url: '/operator', icon: PackageSearch },
    { title: 'Production Display', url: '/production-display', icon: Monitor },
    { title: 'Shipments', url: '/shipments', icon: TruckIcon },
  ];

  const adminItems = [
    { title: 'Customers', url: '/customers', icon: Users, badge: null },
    { title: 'Customer Access', url: '/customer-access', icon: ShieldCheck, badge: null },
    { title: 'Order Requests', url: '/order-requests', icon: MessageSquare, badge: pendingRequestsCount },
    { title: 'User Management', url: '/user-management', icon: UserCog, badge: null },
    { title: 'Brand Management', url: '/brand-management', icon: Palette, badge: null },
    { title: 'Products (SKUs)', url: '/skus', icon: Package, badge: null },
    { title: 'Wholesale Applications', url: '/wholesale-applications', icon: UserPlus, badge: null },
    { title: 'Notifications', url: '/notifications', icon: Mail, badge: null },
    { title: 'Email History', url: '/email-history', icon: History, badge: null },
    { title: 'Label Settings', url: '/label-settings', icon: Tags, badge: null },
    { title: 'Settings', url: '/settings', icon: Settings, badge: null },
  ];

  return (
    <Sidebar collapsible="icon" className="transition-[left,right,width] duration-300 ease-in-out">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-center">
          {collapsed ? (
            <img src={axiomLogo} alt="Axiom Collective" className="h-6 w-6 object-contain" />
          ) : (
            <img src={axiomLogo} alt="Axiom Collective" className="h-8 object-contain" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {userRole === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50 flex items-center justify-between w-full"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </div>
                      {!collapsed && item.badge !== null && item.badge > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                      {collapsed && item.badge !== null && item.badge > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}