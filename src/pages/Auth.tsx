import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import axiomLogo from '@/assets/axiom-logo.png';
const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    const checkUserRole = async () => {
      if (user && !isRedirecting) {
        try {
          setIsRedirecting(true);
          
          // Check if password change is required
          const metadata = user.user_metadata;
          if (metadata?.requires_password_change === true) {
            setRequiresPasswordChange(true);
            setIsRedirecting(false);
            toast({
              title: 'Password Change Required',
              description: 'Please set a new password for your account.',
              variant: 'default'
            });
            return;
          }
          
          const {
            data: roleData
          } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
          if (roleData?.role === 'customer') {
            navigate('/customer');
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error('Error checking role:', error);
          navigate('/');
        }
      } else if (!user) {
        setIsRedirecting(false);
      }
    };
    checkUserRole();
  }, [user, navigate]);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Error signing in',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      // Role-based redirect handled in useEffect
      toast({
        title: 'Success',
        description: 'Signed in successfully'
      });
    }
    setLoading(false);
  };
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const {
      error
    } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`
    });
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Password reset email sent! Check your inbox.'
      });
      setResetDialogOpen(false);
      setResetEmail('');
    }
    setResetLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive'
      });
      return;
    }

    setPasswordChangeLoading(true);
    
    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (passwordError) throw passwordError;

      // Update metadata to remove password change requirement
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { requires_password_change: false }
      });

      if (metadataError) throw metadataError;

      toast({
        title: 'Success',
        description: 'Password changed successfully! Redirecting...'
      });

      setRequiresPasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
      
      // Trigger role check and redirect
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (roleData?.role === 'customer') {
          navigate('/customer');
        } else {
          navigate('/');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Show password change form if required
  if (requiresPasswordChange && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={axiomLogo} alt="Axiom Collective LLC" className="h-12" />
            </div>
            <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
            <CardDescription>
              For security, please change your temporary password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input 
                    id="new-password" 
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required 
                    className="pr-10"
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input 
                  id="confirm-password" 
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required 
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={passwordChangeLoading}>
                {passwordChangeLoading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={axiomLogo} alt="Axiom Collective LLC" className="h-12" />
          </div>
          <CardTitle className="text-2xl font-bold">Wholesale Manager        </CardTitle>
          <CardDescription>
            Sign in to manage wholesale orders and workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input id="signin-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="px-0 text-sm" type="button">
                        Forgot Password?
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                          Enter your email address and we'll send you a link to reset your password.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handlePasswordReset} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <Input id="reset-email" type="email" placeholder="you@company.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="text-center pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    New wholesale customer?{' '}
                    <Button 
                      variant="link" 
                      className="px-0 text-sm font-semibold" 
                      type="button"
                      onClick={() => navigate('/wholesale-signup')}
                    >
                      Apply for wholesale account
                    </Button>
                  </p>
                </div>
            </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;