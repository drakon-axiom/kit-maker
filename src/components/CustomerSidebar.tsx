import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import axiomLogo from '@/assets/axiom-logo.png';
import {
  Home,
  FileText,
  CreditCard,
  Settings,
  User,
  ShoppingCart,
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

export function CustomerSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  const items = [
    { title: 'Orders', url: '/customer', icon: Home },
    { title: 'New Order', url: '/customer/new-order', icon: ShoppingCart },
    { title: 'Quotes', url: '/customer/quotes', icon: FileText },
    { title: 'Payments', url: '/customer/payments', icon: CreditCard },
    { title: 'Profile', url: '/customer/profile', icon: User },
    { title: 'Settings', url: '/customer/settings', icon: Settings },
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
          <SidebarGroupLabel>Customer Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
