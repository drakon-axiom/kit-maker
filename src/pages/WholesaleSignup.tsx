import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Palette } from 'lucide-react';
import axiomLogo from '@/assets/axiom-logo.png';

const WholesaleSignup = () => {
  const navigate = useNavigate();
  const { currentBrand, allBrands, setCurrentBrandById } = useBrand();
  const [loading, setLoading] = useState(false);
  const [showBrandSwitcher, setShowBrandSwitcher] = useState(false);
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
    } catch (error) {
      // Error handled silently
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBrandChange = (brandId: string) => {
    setCurrentBrandById(brandId);
    toast.success('Brand preview updated');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-primary/10 shadow-xl relative">
        {/* Brand Switcher Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-8 w-8 z-10"
          onClick={() => setShowBrandSwitcher(!showBrandSwitcher)}
          title="Test different brands"
        >
          <Palette className="h-4 w-4" />
        </Button>

        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={currentBrand?.logo_url || axiomLogo} 
              alt={currentBrand?.name || "Company"} 
              className="h-16 object-contain" 
            />
          </div>
          
          {/* Brand Switcher Dropdown */}
          {showBrandSwitcher && allBrands && allBrands.length > 1 && (
            <div className="mb-4 max-w-xs mx-auto">
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

          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {currentBrand?.name || "Wholesale"} Partner Application
            </CardTitle>
            <CardDescription className="text-center text-base mt-2">
              Join our wholesale program and get access to exclusive pricing, priority service, and dedicated support
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                    placeholder="Acme Corporation"
                    className="border-primary/20 focus:border-primary"
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
                    className="border-primary/20 focus:border-primary"
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
                    className="border-primary/20 focus:border-primary"
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
                    className="border-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_type">Business Type</Label>
                  <Input
                    id="business_type"
                    value={formData.business_type}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                    placeholder="Retail, Distribution, etc."
                    className="border-primary/20 focus:border-primary"
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
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Tell us about your business</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Share details about your business, target market, and why you'd like to partner with us..."
                  rows={4}
                  className="border-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground">Shipping Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="shipping_address_line1">Address Line 1</Label>
                  <Input
                    id="shipping_address_line1"
                    value={formData.shipping_address_line1}
                    onChange={(e) => setFormData({ ...formData, shipping_address_line1: e.target.value })}
                    placeholder="123 Main Street"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="shipping_address_line2">Address Line 2</Label>
                  <Input
                    id="shipping_address_line2"
                    value={formData.shipping_address_line2}
                    onChange={(e) => setFormData({ ...formData, shipping_address_line2: e.target.value })}
                    placeholder="Suite 100"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={formData.shipping_city}
                    onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                    placeholder="New York"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_state">State</Label>
                  <Input
                    id="shipping_state"
                    value={formData.shipping_state}
                    onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                    placeholder="NY"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_zip">ZIP Code</Label>
                  <Input
                    id="shipping_zip"
                    value={formData.shipping_zip}
                    onChange={(e) => setFormData({ ...formData, shipping_zip: e.target.value })}
                    placeholder="10001"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_country">Country</Label>
                  <Input
                    id="shipping_country"
                    value={formData.shipping_country}
                    onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg">
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
                  <h3 className="text-lg font-semibold text-foreground">Billing Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="billing_address_line1">Address Line 1</Label>
                      <Input
                        id="billing_address_line1"
                        value={formData.billing_address_line1}
                        onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
                        placeholder="123 Main Street"
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="billing_address_line2">Address Line 2</Label>
                      <Input
                        id="billing_address_line2"
                        value={formData.billing_address_line2}
                        onChange={(e) => setFormData({ ...formData, billing_address_line2: e.target.value })}
                        placeholder="Suite 100"
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_city">City</Label>
                      <Input
                        id="billing_city"
                        value={formData.billing_city}
                        onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                        placeholder="New York"
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_state">State</Label>
                      <Input
                        id="billing_state"
                        value={formData.billing_state}
                        onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                        placeholder="NY"
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_zip">ZIP Code</Label>
                      <Input
                        id="billing_zip"
                        value={formData.billing_zip}
                        onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
                        placeholder="10001"
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_country">Country</Label>
                      <Input
                        id="billing_country"
                        value={formData.billing_country}
                        onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="border-primary/20"
              >
                Back to Sign In
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default WholesaleSignup;
