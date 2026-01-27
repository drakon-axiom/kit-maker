import React, { useState, useEffect } from 'react';
import axiomLogo from '@/assets/axiom-logo.png';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu, X, Factory, ClipboardList, Package, Boxes, PackageSearch, Monitor, TruckIcon, Users, ShieldCheck, MessageSquare, UserCog, Palette, UserPlus, Mail, History, DollarSign, Clock, Tags, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSMSQuotaMonitor } from '@/hooks/useSMSQuotaMonitor';
import MobileBottomNav from '@/components/MobileBottomNav';
import { NavLink } from '@/components/NavLink';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, userRole, signOut } = useAuth();
  const { currentBrand } = useBrand();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  // Monitor SMS quota for admins and show browser notifications
  useSMSQuotaMonitor();

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPendingRequestsCount();
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
    { title: 'Dashboard', url: '/dashboard', icon: Factory },
    { title: 'Orders', url: '/orders', icon: ClipboardList },
    { title: 'Internal Orders', url: '/orders/internal/new', icon: Package },
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
    { title: 'Manual Payments', url: '/manual-payment', icon: DollarSign, badge: null },
    { title: 'Label Settings', url: '/label-settings', icon: Tags, badge: null },
    { title: 'Settings', url: '/settings', icon: Settings, badge: null },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen min-h-[100dvh] flex w-full bg-background">
        {/* Sidebar hidden on mobile - uses bottom nav instead */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4 sticky top-0 z-20 safe-area-top">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Mobile hamburger menu */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 flex-shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
              <SidebarTrigger className="h-9 w-9 hidden md:flex flex-shrink-0" />
            </div>
            
            {/* Centered logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img 
                src={currentBrand?.logo_url || axiomLogo} 
                alt={currentBrand?.name || 'Logo'} 
                className="h-8 object-contain" 
              />
            </div>
            
            <div className="flex-1 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 flex-shrink-0 touch-target">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] md:max-w-none truncate">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      Role: {userRole || 'No role assigned'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="touch-target">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </header>
          <SidebarInset className="flex-1 overflow-auto scroll-smooth-touch pb-20 md:pb-0">
            {children || <Outlet />}
          </SidebarInset>
        </div>
        {/* Mobile bottom nav inside the container for proper stacking */}
        <MobileBottomNav />
      </div>

      {/* Mobile slide-out drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="text-left">
              {currentBrand?.name || 'Production Manager'}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-65px)]">
            <div className="p-4 space-y-6">
              {/* Main Navigation */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Main</p>
                {mainItems.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted transition-colors"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </div>

              {/* Admin Navigation */}
              {userRole === 'admin' && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Admin</p>
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                      {item.badge !== null && item.badge > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}

              {/* Sign Out */}
              <div className="pt-4 border-t">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
};

export default Layout;