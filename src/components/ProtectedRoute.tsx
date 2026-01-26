import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'operator' | 'customer';
}

// Role hierarchy: admin > operator > customer
// Higher roles can access pages requiring lower roles
const roleHierarchy: Record<string, number> = {
  admin: 3,
  operator: 2,
  customer: 1,
};

const hasRequiredRole = (
  userRole: string | null,
  requiredRole: string | undefined
): boolean => {
  if (!requiredRole) return true; // No role required
  if (!userRole) return false; // No user role but role is required

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    // Redirect customers away from admin/operator routes to customer portal
    if (!loading && user && userRole === 'customer') {
      const isCustomerRoute = location.pathname.startsWith('/customer');
      const isPublicRoute = ['/auth', '/wholesale-signup', '/quote-approval'].includes(location.pathname);
      
      if (!isCustomerRoute && !isPublicRoute) {
        navigate('/customer');
      }
    }
  }, [user, userRole, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If customer trying to access non-customer route, show nothing while redirecting
  if (userRole === 'customer' && !location.pathname.startsWith('/customer')) {
    return null;
  }

  if (!hasRequiredRole(userRole, requiredRole)) {
    const homeRoute = userRole === 'customer' ? '/customer' : '/';
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => navigate(homeRoute)}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
