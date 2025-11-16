import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from '@/components/CustomerLayout';

interface SavedAddress {
  id: string;
  address_type: string;
  label: string;
  is_default: boolean;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface NotificationPreferences {
  email_order_status: boolean;
  email_payment_received: boolean;
  email_shipment_updates: boolean;
  email_quote_approved: boolean;
  email_quote_expiring: boolean;
  email_marketing: boolean;
}

export default function CustomerAccountSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_order_status: true,
    email_payment_received: true,
    email_shipment_updates: true,
    email_quote_approved: true,
    email_quote_expiring: true,
    email_marketing: false,
  });
  
  // Address dialog state
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    address_type: 'shipping' as 'shipping' | 'billing' | 'both',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
    is_default: false,
  });

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      fetchAccountData();
    }
  }, [user]);

  const fetchAccountData = async () => {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customerData) return;
      setCustomerId(customerData.id);

      // Fetch saved addresses
      const { data: addressData } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('is_default', { ascending: false });

      setAddresses(addressData || []);

      // Fetch notification preferences
      const { data: prefsData } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('customer_id', customerData.id)
        .maybeSingle();

      if (prefsData) {
        setPreferences({
          email_order_status: prefsData.email_order_status,
          email_payment_received: prefsData.email_payment_received,
          email_shipment_updates: prefsData.email_shipment_updates,
          email_quote_approved: prefsData.email_quote_approved,
          email_quote_expiring: prefsData.email_quote_expiring,
          email_marketing: prefsData.email_marketing,
        });
      }
    } catch (error: any) {
      console.error('Error fetching account data:', error);
      toast.error('Failed to load account settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!customerId) return;

    try {
      if (editingAddress) {
        await supabase
          .from('saved_addresses')
          .update(addressForm)
          .eq('id', editingAddress.id);
        toast.success('Address updated successfully');
      } else {
        await supabase
          .from('saved_addresses')
          .insert({
            customer_id: customerId,
            ...addressForm,
          });
        toast.success('Address added successfully');
      }

      await fetchAccountData();
      setShowAddressDialog(false);
      setEditingAddress(null);
      resetAddressForm();
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await supabase.from('saved_addresses').delete().eq('id', id);
      toast.success('Address deleted');
      await fetchAccountData();
    } catch (error: any) {
      console.error('Error deleting address:', error);
      toast.error('Failed to delete address');
    }
  };

  const handleUpdatePreferences = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          customer_id: customerId,
          ...newPrefs,
        });

      if (error) throw error;
      toast.success('Preferences updated');
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
      setPreferences(preferences); // Revert on error
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      
      toast.success('Password updated successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      address_type: 'shipping',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
      is_default: false,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CustomerLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your addresses, notifications, and security
          </p>
        </div>

        {/* Saved Addresses */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Saved Addresses</CardTitle>
                <CardDescription>Manage your shipping and billing addresses</CardDescription>
              </div>
              <Button
                onClick={() => {
                  resetAddressForm();
                  setEditingAddress(null);
                  setShowAddressDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {addresses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No saved addresses yet
              </p>
            ) : (
              <div className="space-y-4">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="flex justify-between items-start p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{address.label}</span>
                        {address.is_default && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            <Check className="h-3 w-3 inline mr-1" />
                            Default
                          </span>
                        )}
                        <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                          {address.address_type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {address.address_line1}
                        {address.address_line2 && `, ${address.address_line2}`}
                        <br />
                        {address.city}, {address.state} {address.zip}
                        <br />
                        {address.country}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAddress(address);
                          setAddressForm({
                            label: address.label,
                            address_type: address.address_type as any,
                            address_line1: address.address_line1,
                            address_line2: address.address_line2 || '',
                            city: address.city,
                            state: address.state,
                            zip: address.zip,
                            country: address.country,
                            is_default: address.is_default,
                          });
                          setShowAddressDialog(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAddress(address.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose which emails you'd like to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries({
              email_order_status: 'Order status updates',
              email_payment_received: 'Payment confirmations',
              email_shipment_updates: 'Shipping notifications',
              email_quote_approved: 'Quote approvals',
              email_quote_expiring: 'Quote expiration reminders',
              email_marketing: 'Marketing and promotions',
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="cursor-pointer">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={preferences[key as keyof NotificationPreferences]}
                  onCheckedChange={(checked) =>
                    handleUpdatePreferences(key as keyof NotificationPreferences, checked)
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowPasswordDialog(true)}>
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Address Dialog */}
        <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </DialogTitle>
              <DialogDescription>
                Enter your address details below
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Address Label *</Label>
                  <Input
                    id="label"
                    placeholder="e.g., Home, Office"
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_type">Address Type *</Label>
                  <Select
                    value={addressForm.address_type}
                    onValueChange={(value: any) => setAddressForm({ ...addressForm, address_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipping">Shipping</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  value={addressForm.address_line1}
                  onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={addressForm.address_line2}
                  onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code *</Label>
                  <Input
                    id="zip"
                    value={addressForm.zip}
                    onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={addressForm.is_default}
                  onCheckedChange={(checked) => setAddressForm({ ...addressForm, is_default: checked })}
                />
                <Label htmlFor="is_default">Set as default address</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddressDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAddress}>
                {editingAddress ? 'Update Address' : 'Add Address'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your new password below
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword}>
                Change Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerLayout>
  );
}
