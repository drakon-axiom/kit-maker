import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, X, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Customer {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface SKU {
  id: string;
  code: string;
  description: string;
}

interface Access {
  id: string;
  category?: Category;
  sku?: SKU;
}

export const CustomerAccessManager = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [categoryAccess, setCategoryAccess] = useState<Access[]>([]);
  const [productAccess, setProductAccess] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerAccess();
    }
  }, [selectedCustomer]);

  const fetchData = async () => {
    try {
      const [customersRes, categoriesRes, skusRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('skus').select('id, code, description').eq('active', true).order('code'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (skusRes.error) throw skusRes.error;

      setCustomers(customersRes.data || []);
      setCategories(categoriesRes.data || []);
      setSKUs(skusRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerAccess = async () => {
    if (!selectedCustomer) return;

    try {
      const [categoryRes, productRes] = await Promise.all([
        supabase
          .from('customer_category_access')
          .select('id, category:categories(id, name)')
          .eq('customer_id', selectedCustomer),
        supabase
          .from('customer_product_access')
          .select('id, sku:skus(id, code, description)')
          .eq('customer_id', selectedCustomer),
      ]);

      if (categoryRes.error) throw categoryRes.error;
      if (productRes.error) throw productRes.error;

      setCategoryAccess(categoryRes.data || []);
      setProductAccess(productRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addCategoryAccess = async (categoryId: string) => {
    if (!selectedCustomer) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_category_access')
        .insert([{ customer_id: selectedCustomer, category_id: categoryId }]);

      if (error) throw error;
      toast({ title: 'Success', description: 'Category access granted' });
      fetchCustomerAccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addProductAccess = async (skuId: string) => {
    if (!selectedCustomer) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_product_access')
        .insert([{ customer_id: selectedCustomer, sku_id: skuId }]);

      if (error) throw error;
      toast({ title: 'Success', description: 'Product access granted' });
      fetchCustomerAccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeAccess = async (type: 'category' | 'product', id: string) => {
    try {
      const table = type === 'category' ? 'customer_category_access' : 'customer_product_access';
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Access removed' });
      fetchCustomerAccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Wholesale Customer Access</CardTitle>
        </div>
        <CardDescription>
          Control which categories and products wholesale customers can see
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Select Customer</label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCustomer && (
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="categories">Category Access</TabsTrigger>
              <TabsTrigger value="products">Product Access</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Grant Category Access</label>
                <Select onValueChange={addCategoryAccess} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((cat) => !categoryAccess.some((a) => a.category?.id === cat.id))
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Current Category Access</p>
                {categoryAccess.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category access granted</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categoryAccess.map((access) => (
                      <Badge key={access.id} variant="secondary" className="gap-2">
                        {access.category?.name}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => removeAccess('category', access.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Grant Product Access</label>
                <Select onValueChange={addProductAccess} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {skus
                      .filter((sku) => !productAccess.some((a) => a.sku?.id === sku.id))
                      .map((sku) => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.code} - {sku.description}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Current Product Access</p>
                {productAccess.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No product access granted</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {productAccess.map((access) => (
                      <Badge key={access.id} variant="secondary" className="gap-2">
                        {access.sku?.code}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => removeAccess('product', access.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
