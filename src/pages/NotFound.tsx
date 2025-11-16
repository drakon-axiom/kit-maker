import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoHome = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Check user role and redirect appropriately
    const { data: roles } = await import('@/integrations/supabase/client').then(m => 
      m.supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    );

    if (roles?.role === 'customer') {
      navigate('/customer');
    } else if (roles?.role === 'admin') {
      navigate('/');
    } else if (roles?.role === 'operator') {
      navigate('/operator');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Oops! Page not found</p>
        <Button onClick={handleGoHome}>
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
