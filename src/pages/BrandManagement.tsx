import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Save, Trash2, TestTube, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string;
  primary_foreground: string;
  is_default: boolean;
  active: boolean;
}

const BrandManagement = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBrand, setEditingBrand] = useState<Partial<Brand> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{ brand: Brand | null; method: string } | null>(null);

  const fetchBrands = async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) {
      toast.error('Failed to load brands');
      return;
    }
    setBrands(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleSaveBrand = async () => {
    if (!editingBrand?.name || !editingBrand?.slug) {
      toast.error('Name and slug are required');
      return;
    }

    const brandData = {
      name: editingBrand.name,
      slug: editingBrand.slug,
      domain: editingBrand.domain || null,
      logo_url: editingBrand.logo_url || null,
      primary_color: editingBrand.primary_color || '222.2 84% 4.9%',
      primary_foreground: editingBrand.primary_foreground || '210 40% 98%',
      is_default: editingBrand.is_default || false,
      active: editingBrand.active !== false,
    };

    if (editingBrand.id) {
      const { error } = await supabase
        .from('brands')
        .update(brandData)
        .eq('id', editingBrand.id);

      if (error) {
        toast.error('Failed to update brand');
        return;
      }
      toast.success('Brand updated successfully');
    } else {
      const { error } = await supabase
        .from('brands')
        .insert([brandData]);

      if (error) {
        toast.error('Failed to create brand');
        return;
      }
      toast.success('Brand created successfully');
    }

    setDialogOpen(false);
    setEditingBrand(null);
    fetchBrands();
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete brand');
      return;
    }

    toast.success('Brand deleted successfully');
    fetchBrands();
  };

  const handleTestUrl = () => {
    if (!testUrl) {
      toast.error('Please enter a URL to test');
      return;
    }

    try {
      const url = new URL(testUrl.startsWith('http') ? testUrl : `https://${testUrl}`);
      const hostname = url.hostname;
      const pathname = url.pathname;

      let detectedBrand: Brand | null = null;
      let detectionMethod = '';

      // 1. Try exact domain match
      detectedBrand = brands.find(b => b.domain === hostname) || null;
      if (detectedBrand) {
        detectionMethod = 'Exact domain match';
      }

      // 2. Try subdomain match
      if (!detectedBrand) {
        detectedBrand = brands.find(b => {
          if (!b.domain) return false;
          const cleanHostname = hostname.replace(/^www\./, '');
          const cleanDomain = b.domain.replace(/^www\./, '');
          return cleanHostname === cleanDomain || cleanHostname.endsWith('.' + cleanDomain);
        }) || null;
        
        if (detectedBrand) {
          detectionMethod = 'Subdomain match';
        }
      }

      // 3. Try path-based detection
      if (!detectedBrand) {
        const pathSegments = pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const potentialSlug = pathSegments[0].toLowerCase().replace(/_/g, '-');
          detectedBrand = brands.find(b => b.slug.toLowerCase() === potentialSlug) || null;
          
          if (detectedBrand) {
            detectionMethod = `Path-based match (/${pathSegments[0]})`;
          }
        }
      }

      // 4. Fallback to default
      if (!detectedBrand) {
        detectedBrand = brands.find(b => b.is_default) || brands[0] || null;
        detectionMethod = 'Default brand (fallback)';
      }

      setTestResult({ brand: detectedBrand, method: detectionMethod });
    } catch (error) {
      toast.error('Invalid URL format');
      setTestResult(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading brands...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Brand Management</h1>
          <p className="text-muted-foreground">Manage your business brands and their visual identity</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBrand({})}>
              <Plus className="h-4 w-4 mr-2" />
              Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBrand?.id ? 'Edit Brand' : 'Create New Brand'}</DialogTitle>
              <DialogDescription>
                Configure the brand identity including colors and logo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Brand Name</Label>
                <Input
                  id="name"
                  value={editingBrand?.name || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                  placeholder="Axiom Collective"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={editingBrand?.slug || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, slug: e.target.value })}
                  placeholder="axiom-collective"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain">Custom Domain</Label>
                <Input
                  id="domain"
                  value={editingBrand?.domain || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, domain: e.target.value })}
                  placeholder="nexusaminos.com"
                />
                <p className="text-xs text-muted-foreground">
                  Custom domain for this brand (optional). Set up CNAME record to point to portal.axc.llc
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={editingBrand?.logo_url || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primary">Primary Color (HSL)</Label>
                  <Input
                    id="primary"
                    value={editingBrand?.primary_color || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, primary_color: e.target.value })}
                    placeholder="222.2 84% 4.9%"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="primary-fg">Primary Foreground (HSL)</Label>
                  <Input
                    id="primary-fg"
                    value={editingBrand?.primary_foreground || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, primary_foreground: e.target.value })}
                    placeholder="210 40% 98%"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="default"
                  checked={editingBrand?.is_default || false}
                  onCheckedChange={(checked) => setEditingBrand({ ...editingBrand, is_default: checked })}
                />
                <Label htmlFor="default">Set as Default Brand</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={editingBrand?.active !== false}
                  onCheckedChange={(checked) => setEditingBrand({ ...editingBrand, active: checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBrand}>
                <Save className="h-4 w-4 mr-2" />
                Save Brand
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domain Tester Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            <CardTitle>Domain Tester</CardTitle>
          </div>
          <CardDescription>
            Test which brand will be detected for a given URL before setting up DNS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter URL (e.g., b2b.nexusaminos.com or portal.axc.llc/nexus_aminos)"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestUrl()}
            />
            <Button onClick={handleTestUrl}>
              <TestTube className="h-4 w-4 mr-2" />
              Test
            </Button>
          </div>

          {testResult && (
            <Alert className={testResult.brand ? 'border-green-500' : 'border-yellow-500'}>
              <div className="flex items-start gap-3">
                {testResult.brand ? (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <AlertTitle className="font-semibold">
                    {testResult.brand ? `Brand Detected: ${testResult.brand.name}` : 'No Brand Detected'}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Detection Method:</span> {testResult.method}
                    </p>
                    {testResult.brand && (
                      <>
                        <p className="text-sm">
                          <span className="font-medium">Slug:</span> {testResult.brand.slug}
                        </p>
                        {testResult.brand.domain && (
                          <p className="text-sm">
                            <span className="font-medium">Configured Domain:</span> {testResult.brand.domain}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <div 
                            className="w-8 h-8 rounded border"
                            style={{ backgroundColor: `hsl(${testResult.brand.primary_color})` }}
                          />
                          <span className="text-xs text-muted-foreground">Primary color preview</span>
                        </div>
                      </>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Detection Priority:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Exact domain match (e.g., nexusaminos.com)</li>
              <li>Subdomain match (e.g., b2b.nexusaminos.com)</li>
              <li>URL path match (e.g., portal.axc.llc/nexus_aminos)</li>
              <li>User's assigned brand (when logged in)</li>
              <li>Cookie from previous visit</li>
              <li>Default brand (fallback)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <Card key={brand.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{brand.name}</CardTitle>
                  <CardDescription>/{brand.slug}</CardDescription>
                </div>
                {brand.is_default && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    Default
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {brand.logo_url && (
                <img src={brand.logo_url} alt={brand.name} className="h-12 mb-4 object-contain" />
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditingBrand(brand);
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                {!brand.is_default && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteBrand(brand.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BrandManagement;