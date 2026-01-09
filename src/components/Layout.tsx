import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSMSQuotaMonitor } from '@/hooks/useSMSQuotaMonitor';
import MobileBottomNav from '@/components/MobileBottomNav';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, userRole, signOut } = useAuth();
  const { currentBrand } = useBrand();
  
  // Monitor SMS quota for admins and show browser notifications
  useSMSQuotaMonitor();

  return (
    <SidebarProvider>
      <div className="min-h-screen min-h-[100dvh] flex w-full bg-background">
        {/* Sidebar hidden on mobile - uses bottom nav instead */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4 sticky top-0 z-20 safe-area-top">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="h-9 w-9 hidden md:flex flex-shrink-0" />
              {currentBrand?.logo_url ? (
                <img src={currentBrand.logo_url} alt={currentBrand.name} className="h-7 md:h-8 flex-shrink-0" />
              ) : (
                <h1 className="text-base md:text-lg font-semibold truncate">{currentBrand?.name || 'Production Manager'}</h1>
              )}
            </div>
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
          </header>
          <SidebarInset className="flex-1 overflow-auto scroll-smooth-touch pb-20 md:pb-0">
            {children}
          </SidebarInset>
        </div>
        {/* Mobile bottom nav inside the container for proper stacking */}
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
};

export default Layout;