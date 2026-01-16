import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country: string;
  billing_same_as_shipping: boolean;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  billing_country: string;
}

export default function CustomerProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, setValue, reset } = useForm<CustomerFormData>({
    defaultValues: {
      shipping_country: 'USA',
      billing_country: 'USA',
      billing_same_as_shipping: true
    }
  });

  const billingSameAsShipping = watch('billing_same_as_shipping');

  const fetchCustomerData = useCallback(async () => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (customer) {
        setCustomerId(customer.id);
        reset({
          name: customer.name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          shipping_address_line1: customer.shipping_address_line1 || '',
          shipping_address_line2: customer.shipping_address_line2 || '',
          shipping_city: customer.shipping_city || '',
          shipping_state: customer.shipping_state || '',
          shipping_zip: customer.shipping_zip || '',
          shipping_country: customer.shipping_country || 'USA',
          billing_same_as_shipping: customer.billing_same_as_shipping ?? true,
          billing_address_line1: customer.billing_address_line1 || '',
          billing_address_line2: customer.billing_address_line2 || '',
          billing_city: customer.billing_city || '',
          billing_state: customer.billing_state || '',
          billing_zip: customer.billing_zip || '',
          billing_country: customer.billing_country || 'USA',
        });
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user, reset]);

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user, fetchCustomerData]);

  const onSubmit = async (data: CustomerFormData) => {
    setSaving(true);
    try {
      const customerData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        shipping_address_line1: data.shipping_address_line1,
        shipping_address_line2: data.shipping_address_line2,
        shipping_city: data.shipping_city,
        shipping_state: data.shipping_state,
        shipping_zip: data.shipping_zip,
        shipping_country: data.shipping_country,
        billing_same_as_shipping: data.billing_same_as_shipping,
        billing_address_line1: data.billing_same_as_shipping ? data.shipping_address_line1 : data.billing_address_line1,
        billing_address_line2: data.billing_same_as_shipping ? data.shipping_address_line2 : data.billing_address_line2,
        billing_city: data.billing_same_as_shipping ? data.shipping_city : data.billing_city,
        billing_state: data.billing_same_as_shipping ? data.shipping_state : data.billing_state,
        billing_zip: data.billing_same_as_shipping ? data.shipping_zip : data.billing_zip,
        billing_country: data.billing_same_as_shipping ? data.shipping_country : data.billing_country,
        user_id: user?.id
      };

      if (customerId) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId);

        if (error) throw error;
      } else {
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        if (error) throw error;
        if (newCustomer) {
          setCustomerId(newCustomer.id);
        }
      }

      toast.success('Profile saved successfully');
      navigate('/customer/orders/new');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/customer">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Profile</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and addresses</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Contact Information</CardTitle>
            <CardDescription className="text-sm">Your basic contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Company/Name</Label>
                <Input id="name" {...register('name')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input id="email" type="email" {...register('email')} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">Phone</Label>
              <Input id="phone" type="tel" {...register('phone')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Shipping Address</CardTitle>
            <CardDescription className="text-sm">Where we'll send your orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shipping_address_line1" className="text-sm">Address Line 1</Label>
              <Input id="shipping_address_line1" {...register('shipping_address_line1')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_address_line2" className="text-sm">Address Line 2</Label>
              <Input id="shipping_address_line2" {...register('shipping_address_line2')} />
            </div>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="shipping_city" className="text-sm">City</Label>
                <Input id="shipping_city" {...register('shipping_city')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_state" className="text-sm">State</Label>
                <Input id="shipping_state" {...register('shipping_state')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_zip" className="text-sm">ZIP Code</Label>
                <Input id="shipping_zip" {...register('shipping_zip')} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_country" className="text-sm">Country</Label>
              <Input id="shipping_country" {...register('shipping_country')} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Billing Address</CardTitle>
            <CardDescription className="text-sm">Address for invoices and payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="billing_same_as_shipping"
                checked={billingSameAsShipping}
                onCheckedChange={(checked) => setValue('billing_same_as_shipping', checked as boolean)}
              />
              <Label htmlFor="billing_same_as_shipping" className="cursor-pointer text-sm">
                Same as shipping address
              </Label>
            </div>

            {!billingSameAsShipping && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label htmlFor="billing_address_line1" className="text-sm">Address Line 1</Label>
                  <Input id="billing_address_line1" {...register('billing_address_line1')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_address_line2" className="text-sm">Address Line 2</Label>
                  <Input id="billing_address_line2" {...register('billing_address_line2')} />
                </div>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="billing_city" className="text-sm">City</Label>
                    <Input id="billing_city" {...register('billing_city')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_state" className="text-sm">State</Label>
                    <Input id="billing_state" {...register('billing_state')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_zip" className="text-sm">ZIP Code</Label>
                    <Input id="billing_zip" {...register('billing_zip')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_country" className="text-sm">Country</Label>
                  <Input id="billing_country" {...register('billing_country')} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/customer')} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
