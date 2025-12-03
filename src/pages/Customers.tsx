import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Loader2, Trash2, Upload, AlertCircle, Search, Shield } from 'lucide-react';
import { CustomerAccessManager } from '@/components/CustomerAccessManager';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  default_terms: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  billing_same_as_shipping: boolean | null;
  notes: string | null;
  quote_expiration_days: number | null;
  created_at: string;
}

interface ImportRow {
  name: string;
  email: string;
  phone: string;
  default_terms: string;
  errors?: string[];
  action?: 'create' | 'update';
  existingId?: string;
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessCustomerId, setAccessCustomerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    default_terms: '',
    quote_expiration_days: '',
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
    notes: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      // Fetch all customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (customersError) throw customersError;

      // Fetch user roles for admin and operator
      const { data: internalRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'operator']);

      if (rolesError) throw rolesError;

      // Filter out customers who have admin or operator roles
      const internalUserIds = new Set(internalRoles?.map(r => r.user_id) || []);
      const filteredCustomers = (customersData || []).filter(
        customer => !customer.user_id || !internalUserIds.has(customer.user_id)
      );

      setCustomers(filteredCustomers as any);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate shipping address if any field is filled
    const hasShippingFields = formData.shipping_address_line1 || formData.shipping_city || 
                              formData.shipping_state || formData.shipping_zip;
    if (hasShippingFields && (!formData.shipping_address_line1 || !formData.shipping_city || 
                               !formData.shipping_state || !formData.shipping_zip)) {
      toast({
        title: 'Incomplete Shipping Address',
        description: 'Please fill in all required shipping address fields (Address Line 1, City, State, ZIP)',
        variant: 'destructive',
      });
      return;
    }

    // Validate billing address if not same as shipping and any field is filled
    if (!formData.billing_same_as_shipping) {
      const hasBillingFields = formData.billing_address_line1 || formData.billing_city || 
                               formData.billing_state || formData.billing_zip;
      if (hasBillingFields && (!formData.billing_address_line1 || !formData.billing_city || 
                                !formData.billing_state || !formData.billing_zip)) {
        toast({
          title: 'Incomplete Billing Address',
          description: 'Please fill in all required billing address fields (Address Line 1, City, State, ZIP)',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const customerData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        default_terms: formData.default_terms || null,
        quote_expiration_days: formData.quote_expiration_days ? parseInt(formData.quote_expiration_days) : null,
        shipping_address_line1: formData.shipping_address_line1 || null,
        shipping_address_line2: formData.shipping_address_line2 || null,
        shipping_city: formData.shipping_city || null,
        shipping_state: formData.shipping_state || null,
        shipping_zip: formData.shipping_zip || null,
        shipping_country: formData.shipping_country || null,
        billing_address_line1: formData.billing_same_as_shipping ? null : (formData.billing_address_line1 || null),
        billing_address_line2: formData.billing_same_as_shipping ? null : (formData.billing_address_line2 || null),
        billing_city: formData.billing_same_as_shipping ? null : (formData.billing_city || null),
        billing_state: formData.billing_same_as_shipping ? null : (formData.billing_state || null),
        billing_zip: formData.billing_same_as_shipping ? null : (formData.billing_zip || null),
        billing_country: formData.billing_same_as_shipping ? null : (formData.billing_country || null),
        billing_same_as_shipping: formData.billing_same_as_shipping,
        notes: formData.notes || null,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Customer updated successfully' });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) throw error;
        toast({ title: 'Success', description: 'Customer created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      default_terms: '',
      quote_expiration_days: '',
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
      notes: '',
    });
    setEditingCustomer(null);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      default_terms: customer.default_terms || '',
      quote_expiration_days: customer.quote_expiration_days?.toString() || '',
      shipping_address_line1: customer.shipping_address_line1 || '',
      shipping_address_line2: customer.shipping_address_line2 || '',
      shipping_city: customer.shipping_city || '',
      shipping_state: customer.shipping_state || '',
      shipping_zip: customer.shipping_zip || '',
      shipping_country: customer.shipping_country || 'USA',
      billing_address_line1: customer.billing_address_line1 || '',
      billing_address_line2: customer.billing_address_line2 || '',
      billing_city: customer.billing_city || '',
      billing_state: customer.billing_state || '',
      billing_zip: customer.billing_zip || '',
      billing_country: customer.billing_country || 'USA',
      billing_same_as_shipping: customer.billing_same_as_shipping ?? true,
      notes: customer.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Customer deleted successfully',
      });

      fetchCustomers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  const validateImportRow = (row: any): ImportRow => {
    const errors: string[] = [];
    
    if (!row.name || row.name.trim() === '') {
      errors.push('Name is required');
    }
    
    if (row.email && row.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        errors.push('Invalid email format');
      }
    }
    
    return {
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      default_terms: row.default_terms || '',
      errors: errors.length > 0 ? errors : undefined,
    };
  };

  const checkExistingCustomers = async (rows: ImportRow[]) => {
    try {
      const { data: existingCustomers, error } = await supabase
        .from('customers')
        .select('id, name, email');

      if (error) throw error;

      const existingMap = new Map(
        existingCustomers?.map(c => [c.email?.toLowerCase() || c.name.toLowerCase(), c.id]) || []
      );

      return rows.map(row => {
        const key = row.email.trim().toLowerCase() || row.name.trim().toLowerCase();
        const existingId = existingMap.get(key);
        return {
          ...row,
          action: existingId ? 'update' as const : 'create' as const,
          existingId,
        };
      });
    } catch (error: any) {
      toast({
        title: 'Error checking existing customers',
        description: error.message,
        variant: 'destructive',
      });
      return rows;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = async (data: any[]) => {
      const validatedData = data.map(row => validateImportRow(row));
      const dataWithActions = await checkExistingCustomers(validatedData);
      setImportData(dataWithActions);
      setImportOpen(true);
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (error) => {
          toast({
            title: 'Error parsing CSV',
            description: error.message,
            variant: 'destructive',
          });
        },
      });
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          processData(jsonData);
        } catch (error: any) {
          toast({
            title: 'Error parsing Excel file',
            description: error.message,
            variant: 'destructive',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: 'Unsupported file format',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    const validRows = importData.filter(row => !row.errors);
    
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix all errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);

    try {
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      validRows.forEach(row => {
        const customerData = {
          name: row.name.trim(),
          email: row.email.trim() || null,
          phone: row.phone.trim() || null,
          default_terms: row.default_terms.trim() || null,
        };

        if (row.action === 'update' && row.existingId) {
          toUpdate.push({ id: row.existingId, ...customerData });
        } else {
          toInsert.push(customerData);
        }
      });

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('customers')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      for (const customer of toUpdate) {
        const { id, ...updateData } = customer;
        const { error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', id);

        if (updateError) throw updateError;
      }

      toast({
        title: 'Success',
        description: `Created ${toInsert.length} new customer(s), updated ${toUpdate.length} existing customer(s)`,
      });

      setImportOpen(false);
      setImportData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: 'Error importing customers',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Example Customer 1',
        email: 'customer1@example.com',
        phone: '555-0001',
        default_terms: 'Net 30',
      },
      {
        name: 'Example Customer 2',
        email: 'customer2@example.com',
        phone: '555-0002',
        default_terms: '50% deposit required, Net 15',
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.default_terms?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none">
            <Upload className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Customer</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
              <DialogDescription>
                {editingCustomer ? 'Update customer information' : 'Add a new customer to your database'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terms">Default Terms</Label>
                    <Input
                      id="terms"
                      value={formData.default_terms}
                      onChange={(e) => setFormData({ ...formData, default_terms: e.target.value })}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_expiration">Quote Expiration (Days)</Label>
                    <Input
                      id="quote_expiration"
                      type="number"
                      min="1"
                      max="365"
                      value={formData.quote_expiration_days}
                      onChange={(e) => setFormData({ ...formData, quote_expiration_days: e.target.value })}
                      placeholder="Leave empty for default"
                    />
                    <p className="text-xs text-muted-foreground">
                      Override default quote expiration for this customer
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Shipping Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="shipping_address_line1">Address Line 1</Label>
                    <Input
                      id="shipping_address_line1"
                      value={formData.shipping_address_line1}
                      onChange={(e) => setFormData({ ...formData, shipping_address_line1: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="shipping_address_line2">Address Line 2</Label>
                    <Input
                      id="shipping_address_line2"
                      value={formData.shipping_address_line2}
                      onChange={(e) => setFormData({ ...formData, shipping_address_line2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipping_city">City</Label>
                    <Input
                      id="shipping_city"
                      value={formData.shipping_city}
                      onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipping_state">State</Label>
                    <Input
                      id="shipping_state"
                      value={formData.shipping_state}
                      onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipping_zip">ZIP Code</Label>
                    <Input
                      id="shipping_zip"
                      value={formData.shipping_zip}
                      onChange={(e) => setFormData({ ...formData, shipping_zip: e.target.value })}
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
                    <h3 className="text-sm font-semibold">Billing Address</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="billing_address_line1">Address Line 1</Label>
                        <Input
                          id="billing_address_line1"
                          value={formData.billing_address_line1}
                          onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="billing_address_line2">Address Line 2</Label>
                        <Input
                          id="billing_address_line2"
                          value={formData.billing_address_line2}
                          onChange={(e) => setFormData({ ...formData, billing_address_line2: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_city">City</Label>
                        <Input
                          id="billing_city"
                          value={formData.billing_city}
                          onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_state">State</Label>
                        <Input
                          id="billing_state"
                          value={formData.billing_state}
                          onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_zip">ZIP Code</Label>
                        <Input
                          id="billing_zip"
                          value={formData.billing_zip}
                          onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
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

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes about this customer..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCustomer ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">All Customers</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {filteredCustomers.length} of {customers.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              No customers yet. Tap "Add Customer" to get started.
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              No customers match "{searchQuery}"
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 md:mx-0">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Terms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{customer.email || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{customer.phone || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs truncate">{customer.default_terms || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAccessCustomerId(customer.id);
                            setAccessDialogOpen(true);
                          }}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCustomerToDelete(customer);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{customerToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Customers from CSV</DialogTitle>
            <DialogDescription>
              Review the data before importing. Existing customers (matched by email or name) will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {importData.length} row(s) found • {importData.filter(r => !r.errors).length} valid • {importData.filter(r => r.errors).length} with errors
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                Download Template
              </Button>
            </div>
            {importData.some(row => row.errors) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  Some rows have errors and will be skipped during import. Please fix them in your file and re-upload.
                </AlertDescription>
              </Alert>
            )}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Default Terms</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((row, idx) => (
                    <TableRow key={idx} className={row.errors ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {row.action === 'create' ? (
                          <span className="text-xs bg-success/20 text-success-foreground px-2 py-1 rounded">CREATE</span>
                        ) : (
                          <span className="text-xs bg-warning/20 text-warning-foreground px-2 py-1 rounded">UPDATE</span>
                        )}
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.email || '-'}</TableCell>
                      <TableCell>{row.phone || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.default_terms || '-'}</TableCell>
                      <TableCell>
                        {row.errors ? (
                          <div className="text-xs text-destructive">
                            {row.errors.map((err, i) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-success">Valid</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing || importData.filter(r => !r.errors).length === 0}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${importData.filter(r => !r.errors).length} Customer(s)`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Customer Access</DialogTitle>
            <DialogDescription>
              Grant or revoke access to categories and products for this customer
            </DialogDescription>
          </DialogHeader>
          <CustomerAccessManager initialCustomerId={accessCustomerId || undefined} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;