import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { CustomerSidebar } from '@/components/CustomerSidebar';
import CustomerMobileBottomNav from '@/components/CustomerMobileBottomNav';
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

interface CustomerLayoutProps {
  children?: React.ReactNode;
}

export const CustomerLayout = ({ children }: CustomerLayoutProps) => {
  const { user, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen min-h-[100dvh] flex w-full bg-background">
        {/* Sidebar hidden on mobile - uses bottom nav instead */}
        <div className="hidden md:block">
          <CustomerSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4 sticky top-0 z-20 safe-area-top">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="hidden md:flex flex-shrink-0" />
              <h1 className="text-base md:text-lg font-semibold truncate">Customer Portal</h1>
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
            {children || <Outlet />}
          </SidebarInset>
        </div>
        <CustomerMobileBottomNav />
      </div>
    </SidebarProvider>
  );
};
