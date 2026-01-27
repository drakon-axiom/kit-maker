import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Palette } from 'lucide-react';
import axiomLogo from '@/assets/axiom-logo.png';

const Auth = () => {
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
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showBrandSwitcher, setShowBrandSwitcher] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(!!resetToken);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const { signIn, user } = useAuth();
  const { currentBrand, allBrands, setCurrentBrandById } = useBrand();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Listen for password recovery event from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        } catch {
          navigate('/');
        }
      } else if (!user) {
        setIsRedirecting(false);
      }
    };
    checkUserRole();
  }, [user, navigate, isRedirecting, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Error signing in',
        description: error instanceof Error ? error.message : 'An error occurred',
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
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

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
      const { error } = await supabase.auth.updateUser({
        password: resetNewPassword
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password updated successfully! You can now sign in.'
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      setIsResettingPassword(false);
      setIsRecoveryMode(false);
      setResetNewPassword('');
      setResetConfirmPassword('');
      navigate('/auth', { replace: true });
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
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Password change failed',
        variant: 'destructive'
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleBrandChange = (brandId: string) => {
    setCurrentBrandById(brandId);
    toast({
      title: 'Brand Changed',
      description: 'Preview updated with new brand styling'
    });
  };

  // Show password reset form if in recovery mode or token is present
  if (isRecoveryMode || (isResettingPassword && resetToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md border-primary/10 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={currentBrand?.logo_url || axiomLogo} alt={currentBrand?.name || "Company"} className="h-12" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Reset Your Password
            </CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="pr-10 border-primary/20 focus:border-primary"
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
                <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                <Input
                  id="reset-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={passwordChangeLoading}>
                {passwordChangeLoading ? 'Resetting Password...' : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsResettingPassword(false);
                  navigate('/auth', { replace: true });
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

  // Show password change form if required
  if (requiresPasswordChange && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md border-primary/10 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={currentBrand?.logo_url || axiomLogo} alt={currentBrand?.name || "Company"} className="h-12" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Set New Password
            </CardTitle>
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
                    className="pr-10 border-primary/20 focus:border-primary"
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
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={passwordChangeLoading}>
                {passwordChangeLoading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md border-primary/10 shadow-xl relative">
        {/* Brand Switcher Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-8 w-8"
          onClick={() => setShowBrandSwitcher(!showBrandSwitcher)}
          title="Test different brands"
        >
          <Palette className="h-4 w-4" />
        </Button>

        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={currentBrand?.logo_url || axiomLogo} alt={currentBrand?.name || "Company"} className="h-12" />
          </div>
          
          {/* Brand Switcher Dropdown */}
          {showBrandSwitcher && allBrands && allBrands.length > 1 && (
            <div className="mb-4">
              <Select value={currentBrand?.id} onValueChange={handleBrandChange}>
                <SelectTrigger className="w-full border-primary/20">
                  <SelectValue placeholder="Select a brand to preview" />
                </SelectTrigger>
                <SelectContent>
                  {allBrands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Wholesale Customer Portal
          </CardTitle>
          <CardDescription>
            Sign in to view your orders, quotes, and account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input 
                id="signin-email" 
                type="email" 
                placeholder="you@company.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="border-primary/20 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <div className="relative">
                <Input 
                  id="signin-password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  className="pr-10 border-primary/20 focus:border-primary" 
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
            <div className="flex justify-end">
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="link" className="px-0 text-sm text-primary" type="button">
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
                      <Input 
                        id="reset-email" 
                        type="email" 
                        placeholder="you@company.com" 
                        value={resetEmail} 
                        onChange={e => setResetEmail(e.target.value)} 
                        required 
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={resetLoading}>
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="space-y-3 pt-4 border-t border-border mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  New wholesale customer?{' '}
                  <Button 
                    variant="link" 
                    className="px-0 text-sm font-semibold text-primary hover:text-primary/80" 
                    type="button"
                    onClick={() => navigate('/wholesale-signup')}
                  >
                    Apply for wholesale account
                  </Button>
                </p>
              </div>
              <div className="text-center pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Administrator?{' '}
                  <Button 
                    variant="link" 
                    className="px-0 text-sm font-semibold text-muted-foreground hover:text-foreground" 
                    type="button"
                    onClick={() => navigate('/admin-login')}
                  >
                    Admin portal
                  </Button>
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
