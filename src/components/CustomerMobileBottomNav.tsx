import { NavLink } from '@/components/NavLink';
import { Home, ShoppingCart, FileText, CreditCard, Settings } from 'lucide-react';

const CustomerMobileBottomNav = () => {
  const navItems = [
    { to: '/customer', icon: Home, label: 'Orders' },
    { to: '/customer/new-order', icon: ShoppingCart, label: 'New' },
    { to: '/customer/quotes', icon: FileText, label: 'Quotes' },
    { to: '/customer/payments', icon: CreditCard, label: 'Pay' },
    { to: '/customer/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/customer'}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 text-muted-foreground transition-colors active:scale-95 touch-target"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default CustomerMobileBottomNav;
