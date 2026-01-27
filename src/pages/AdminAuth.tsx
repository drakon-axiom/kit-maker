import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

const AdminAuth = () => {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('reset_token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(!!resetToken);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const checkUserRole = useCallback(async () => {
    if (user && !isRedirecting) {
      try {
        setIsRedirecting(true);

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        // Only allow admin and operator roles
        if (roleData?.role === 'admin' || roleData?.role === 'operator') {
          navigate('/');
        } else {
          // Not an admin/operator, sign them out
          await supabase.auth.signOut();
          toast({
            title: 'Access Denied',
            description: 'This portal is for administrators only. Please use the wholesale customer portal.',
            variant: 'destructive'
          });
          setIsRedirecting(false);
        }
      } catch (error) {
        // Error handled silently
        setIsRedirecting(false);
      }
    } else if (!user) {
      setIsRedirecting(false);
    }
  }, [user, isRedirecting, navigate, toast]);

  useEffect(() => {
    checkUserRole();
  }, [checkUserRole]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: 'Error signing in',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
      setLoading(false);
    } else {
      // Role check will happen in useEffect
      toast({
        title: 'Success',
        description: 'Signed in successfully'
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email before making request
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive'
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    setResetLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: {
          email: trimmedEmail,
          redirectTo: `${window.location.origin}/admin-login`
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Success',
        description: 'Password reset email sent! Check your inbox.'
      });
      setResetDialogOpen(false);
      setResetEmail('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reset email',
        variant: 'destructive'
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetNewPassword !== resetConfirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (resetNewPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive'
      });
      return;
    }

    setPasswordChangeLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-password-reset', {
        body: {
          token: resetToken,
          newPassword: resetNewPassword
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Success',
        description: 'Password updated successfully! You can now sign in.'
      });

      // Clear the token from URL and reset state
      setIsResettingPassword(false);
      setResetNewPassword('');
      setResetConfirmPassword('');
      navigate('/admin-login', { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Show password reset form if token is present
  if (isResettingPassword && resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-4 bg-slate-700/50 rounded-full">
                <ShieldCheck className="h-12 w-12 text-blue-400" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-100">
                Reset Your Password
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Enter your new password below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-new-password" className="text-slate-200">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="pr-10 bg-slate-900/50 border-slate-600 text-slate-100 focus:border-blue-500"
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-slate-700/50 text-slate-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password" className="text-slate-200">Confirm Password</Label>
                <Input
                  id="reset-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                  className="bg-slate-900/50 border-slate-600 text-slate-100 focus:border-blue-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={passwordChangeLoading}
              >
                {passwordChangeLoading ? 'Resetting Password...' : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  setIsResettingPassword(false);
                  navigate('/admin-login', { replace: true });
                }}
              >
                Back to Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-4 bg-slate-700/50 rounded-full">
              <ShieldCheck className="h-12 w-12 text-blue-400" />
            </div>
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold text-slate-100">
              Administrator Portal
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Secure access for system administrators and operators
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-slate-200">Email</Label>
              <Input 
                id="admin-email" 
                type="email" 
                placeholder="admin@company.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-slate-900/50 border-slate-600 text-slate-100 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-200">Password</Label>
              <div className="relative">
                <Input 
                  id="admin-password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  className="pr-10 bg-slate-900/50 border-slate-600 text-slate-100 focus:border-blue-500" 
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-0 top-0 h-full px-3 hover:bg-slate-700/50 text-slate-400" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="link" className="px-0 text-sm text-blue-400 hover:text-blue-300" type="button">
                    Forgot Password?
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Reset Password</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Enter your admin email address and we'll send you a link to reset your password.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-slate-200">Email</Label>
                      <Input 
                        id="reset-email" 
                        type="email" 
                        placeholder="admin@company.com" 
                        value={resetEmail} 
                        onChange={e => setResetEmail(e.target.value)} 
                        required 
                        className="bg-slate-900/50 border-slate-600 text-slate-100 focus:border-blue-500"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                      disabled={resetLoading}
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In as Administrator'}
            </Button>
            
            <div className="text-center pt-4 border-t border-slate-700 mt-4">
              <p className="text-sm text-slate-400">
                Wholesale customer?{' '}
                <Button 
                  variant="link" 
                  className="px-0 text-sm font-semibold text-blue-400 hover:text-blue-300" 
                  type="button"
                  onClick={() => navigate('/auth')}
                >
                  Sign in here
                </Button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;
