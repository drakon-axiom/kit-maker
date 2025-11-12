import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const WholesaleSignup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    business_type: '',
    website: '',
    message: '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_zip: '',
    shipping_country: 'USA',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_zip: '',
    billing_country: 'USA',
    billing_same_as_shipping: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.contact_name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate shipping address if any field is filled
    const hasShippingFields = formData.shipping_address_line1 || formData.shipping_city || 
                              formData.shipping_state || formData.shipping_zip;
    if (hasShippingFields && (!formData.shipping_address_line1 || !formData.shipping_city || 
                               !formData.shipping_state || !formData.shipping_zip)) {
      toast.error('Please fill in all required shipping address fields (Address Line 1, City, State, ZIP)');
      return;
    }

    // Validate billing address if not same as shipping and any field is filled
    if (!formData.billing_same_as_shipping) {
      const hasBillingFields = formData.billing_address_line1 || formData.billing_city || 
                               formData.billing_state || formData.billing_zip;
      if (hasBillingFields && (!formData.billing_address_line1 || !formData.billing_city || 
                                !formData.billing_state || !formData.billing_zip)) {
        toast.error('Please fill in all required billing address fields (Address Line 1, City, State, ZIP)');
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('wholesale_applications')
        .insert([formData]);

      if (error) throw error;

      toast.success('Application submitted successfully! We will review it shortly.');
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        business_type: '',
        website: '',
        message: '',
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_zip: '',
        shipping_country: 'USA',
        billing_address_line1: '',
        billing_address_line2: '',
        billing_city: '',
        billing_state: '',
        billing_zip: '',
        billing_country: 'USA',
        billing_same_as_shipping: true,
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Wholesale Account Application</CardTitle>
          <CardDescription className="text-center text-base">
            Join our wholesale program and get access to exclusive pricing and benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                  placeholder="Acme Corporation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name *</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="john@acme.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">Business Type</Label>
                <Input
                  id="business_type"
                  value={formData.business_type}
                  onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  placeholder="Retail, Distribution, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Additional Information</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Tell us about your business and why you'd like to become a wholesale customer..."
                rows={4}
              />
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Shipping Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="shipping_address_line1">Address Line 1</Label>
                  <Input
                    id="shipping_address_line1"
                    value={formData.shipping_address_line1}
                    onChange={(e) => setFormData({ ...formData, shipping_address_line1: e.target.value })}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="shipping_address_line2">Address Line 2</Label>
                  <Input
                    id="shipping_address_line2"
                    value={formData.shipping_address_line2}
                    onChange={(e) => setFormData({ ...formData, shipping_address_line2: e.target.value })}
                    placeholder="Suite 100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={formData.shipping_city}
                    onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_state">State</Label>
                  <Input
                    id="shipping_state"
                    value={formData.shipping_state}
                    onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                    placeholder="NY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_zip">ZIP Code</Label>
                  <Input
                    id="shipping_zip"
                    value={formData.shipping_zip}
                    onChange={(e) => setFormData({ ...formData, shipping_zip: e.target.value })}
                    placeholder="10001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_country">Country</Label>
                  <Input
                    id="shipping_country"
                    value={formData.shipping_country}
                    onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billing_same"
                  checked={formData.billing_same_as_shipping}
                  onCheckedChange={(checked) => setFormData({ ...formData, billing_same_as_shipping: checked as boolean })}
                />
                <Label htmlFor="billing_same" className="text-sm font-normal cursor-pointer">
                  Billing address is the same as shipping address
                </Label>
              </div>

              {!formData.billing_same_as_shipping && (
                <>
                  <h3 className="text-lg font-semibold">Billing Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="billing_address_line1">Address Line 1</Label>
                      <Input
                        id="billing_address_line1"
                        value={formData.billing_address_line1}
                        onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="billing_address_line2">Address Line 2</Label>
                      <Input
                        id="billing_address_line2"
                        value={formData.billing_address_line2}
                        onChange={(e) => setFormData({ ...formData, billing_address_line2: e.target.value })}
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_city">City</Label>
                      <Input
                        id="billing_city"
                        value={formData.billing_city}
                        onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                        placeholder="New York"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_state">State</Label>
                      <Input
                        id="billing_state"
                        value={formData.billing_state}
                        onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                        placeholder="NY"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_zip">ZIP Code</Label>
                      <Input
                        id="billing_zip"
                        value={formData.billing_zip}
                        onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
                        placeholder="10001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_country">Country</Label>
                      <Input
                        id="billing_country"
                        value={formData.billing_country}
                        onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default WholesaleSignup;
