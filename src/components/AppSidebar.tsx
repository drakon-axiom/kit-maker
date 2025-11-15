import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import axiomLogo from '@/assets/axiom-logo.png';
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

  const isActive = (path: string) => location.pathname === path;

  const mainItems = [
    { title: 'Dashboard', url: '/', icon: Factory },
    { title: 'Orders', url: '/orders', icon: ClipboardList },
    { title: 'Production Queue', url: '/queue', icon: Boxes },
    { title: 'Operator Console', url: '/operator', icon: PackageSearch },
    { title: 'Production Display', url: '/production-display', icon: Monitor },
    { title: 'Shipments', url: '/shipments', icon: TruckIcon },
  ];

  const adminItems = [
    { title: 'Customers', url: '/customers', icon: Users },
    { title: 'Customer Access', url: '/customer-access', icon: ShieldCheck },
    { title: 'User Management', url: '/user-management', icon: UserCog },
    { title: 'Products (SKUs)', url: '/skus', icon: Package },
    { title: 'Wholesale Applications', url: '/wholesale-applications', icon: UserPlus },
    { title: 'Notifications', url: '/notifications', icon: Mail },
    { title: 'Label Settings', url: '/label-settings', icon: Tags },
    { title: 'Settings', url: '/settings', icon: Settings },
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}