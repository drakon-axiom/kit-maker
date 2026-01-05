import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Eye, Search, Download, Edit, ArrowUpDown, ChevronLeft, ChevronRight, Filter, X, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useReactToPrint } from 'react-to-print';
import Papa from 'papaparse';
import OrderLabel from '@/components/OrderLabel';
import ShippingLabel from '@/components/ShippingLabel';
import BatchLabel from '@/components/BatchLabel';
import { OrderCard } from '@/components/mobile/OrderCard';
import { SwipeableOrderCard } from '@/components/mobile/SwipeableOrderCard';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';

interface Order {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  customer_id: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  subtotal: number;
  deposit_required: boolean;
  deposit_status: string;
  created_at: string;
}

interface Batch {
  uid: string;
  human_uid: string;
  qty_bottle_planned: number;
  created_at: string;
}

interface OrderWithDetails extends Order {
  totalBottles?: number;
  batches?: Batch[];
  shipment?: {
    tracking_no: string;
    carrier: string;
  };
}

interface LabelSettings {
  size_width: number;
  size_height: number;
  show_qr_code: boolean;
  show_logo: boolean;
  logo_url: string | null;
  logo_position: string;
  show_customer_email: boolean;
  show_customer_phone: boolean;
  show_status: boolean;
  show_total_bottles: boolean;
  show_date: boolean;
  show_tracking_number: boolean;
  show_carrier: boolean;
  show_batch_quantity: boolean;
  show_order_reference: boolean;
  custom_html: string | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted',
  awaiting_approval: 'bg-orange-500',
  quoted: 'bg-blue-500',
  deposit_due: 'bg-warning',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  in_labeling: 'bg-indigo-500',
  awaiting_invoice: 'bg-pink-500',
  awaiting_payment: 'bg-rose-500',
  in_packing: 'bg-cyan-500',
  packed: 'bg-success',
  shipped: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
  on_hold: 'bg-amber-600',
};

type SortField = 'created_at' | 'subtotal' | 'status' | 'customer_name' | 'human_uid';
type SortDirection = 'asc' | 'desc';

const Orders = () => {
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Advanced Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepositStatus, setFilterDepositStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Print state
  const [printOrder, setPrintOrder] = useState<OrderWithDetails | null>(null);
  const [printType, setPrintType] = useState<'order' | 'shipping' | 'batch' | null>(null);
  const [bulkPrintOrders, setBulkPrintOrders] = useState<OrderWithDetails[]>([]);
  const [bulkPrintDialogOpen, setBulkPrintDialogOpen] = useState(false);
  const [bulkPrintType, setBulkPrintType] = useState<'order' | 'shipping' | 'batch'>('order');
  const [labelSettings, setLabelSettings] = useState<{
    order?: LabelSettings;
    shipping?: LabelSettings;
    batch?: LabelSettings;
  }>({});
  const orderLabelRef = useRef<HTMLDivElement>(null);
  const shippingLabelRef = useRef<HTMLDivElement>(null);
  const batchLabelsRef = useRef<HTMLDivElement>(null);
  const bulkPrintRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePrint = useReactToPrint({
    contentRef: orderLabelRef,
  });

  const handlePrintShipping = useReactToPrint({
    contentRef: shippingLabelRef,
  });

  const handlePrintBatch = useReactToPrint({
    contentRef: batchLabelsRef,
  });

  const handlePrintBulk = useReactToPrint({
    contentRef: bulkPrintRef,
  });

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchLabelSettings();
  }, []);

  const fetchLabelSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('label_settings')
        .select('*');

      if (error) throw error;

      const settings: any = {};
      data?.forEach(setting => {
        settings[setting.label_type] = setting;
      });
      setLabelSettings(settings);
    } catch {
      // Label settings fetch errors are non-critical
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch {
      // Customer fetch errors are non-critical
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchOrders(), fetchCustomers()]);
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      // Fetch order with customer and line items
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email, phone),
          lines:sales_order_lines(bottle_qty)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Calculate total bottles
      const totalBottles = orderData.lines?.reduce((sum: number, line: any) => sum + line.bottle_qty, 0) || 0;

      // Fetch batches
      const { data: batches, error: batchError } = await supabase
        .from('production_batches')
        .select('uid, human_uid, qty_bottle_planned, created_at')
        .eq('so_id', orderId);

      if (batchError) throw batchError;

      // Fetch shipment
      const { data: shipment } = await supabase
        .from('shipments')
        .select('tracking_no, carrier')
        .eq('so_id', orderId)
        .single();

      return {
        ...orderData,
        totalBottles,
        batches: batches || [],
        shipment: shipment || undefined,
      } as OrderWithDetails;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      return null;
    }
  };

  const formatStatus = (status: string) => {
    if (status === 'on_hold_customer') return 'On Hold (Customer Hold)';
    if (status === 'on_hold_internal') return 'On Hold (Internal Hold)';
    if (status === 'on_hold_materials') return 'On Hold (Materials Hold)';
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedOrders.size === 0 || !bulkStatus) {
      toast({
        title: 'Invalid selection',
        description: 'Please select orders and a status',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId =>
        supabase.from('sales_orders').update({ status: bulkStatus as any }).eq('id', orderId)
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} order(s)`);
      }

      toast({
        title: 'Success',
        description: `Updated ${selectedOrders.size} order(s) successfully`,
      });

      setBulkEditOpen(false);
      setSelectedOrders(new Set());
      setBulkStatus('');
      fetchOrders();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    const csvData = filteredOrders.map(order => ({
      'Order ID': order.human_uid,
      'Customer': order.customer?.name,
      'Status': formatStatus(order.status),
      'Deposit Required': order.deposit_required ? 'Yes' : 'No',
      'Deposit Status': order.deposit_status,
      'Subtotal': order.subtotal,
      'Created': new Date(order.created_at).toLocaleDateString(),
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterDepositStatus('');
    setFilterCustomer('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = !!(filterStatus || filterDepositStatus || filterCustomer || filterDateFrom || filterDateTo);

  const filteredOrders = orders.filter(order => {
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        order.human_uid.toLowerCase().includes(query) ||
        order.customer?.name.toLowerCase().includes(query) ||
        formatStatus(order.status).toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus && order.status !== filterStatus) return false;

    // Deposit status filter
    if (filterDepositStatus && order.deposit_status !== filterDepositStatus) return false;

    // Customer filter
    if (filterCustomer && order.customer_id !== filterCustomer) return false;

    // Date range filter
    if (filterDateFrom) {
      const orderDate = new Date(order.created_at);
      const fromDate = new Date(filterDateFrom);
      if (orderDate < fromDate) return false;
    }
    if (filterDateTo) {
      const orderDate = new Date(order.created_at);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (orderDate > toDate) return false;
    }

    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortField) {
      case 'created_at':
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case 'subtotal':
        aVal = a.subtotal;
        bVal = b.subtotal;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'customer_name':
        aVal = a.customer?.name || '';
        bVal = b.customer?.name || '';
        break;
      case 'human_uid':
        aVal = a.human_uid;
        bVal = b.human_uid;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const handlePrintLabel = async (order: Order, type: 'order' | 'shipping' | 'batch') => {
    const orderDetails = await fetchOrderDetails(order.id);
    if (!orderDetails) return;

    setPrintOrder(orderDetails);
    setPrintType(type);
    
    setTimeout(() => {
      if (type === 'order') handlePrint();
      else if (type === 'shipping') handlePrintShipping();
      else if (type === 'batch') handlePrintBatch();
    }, 100);
  };

  const handleBulkPrintSetup = async () => {
    if (selectedOrders.size === 0) {
      toast({
        title: 'No orders selected',
        description: 'Please select at least one order to print labels',
        variant: 'destructive',
      });
      return;
    }

    setBulkPrintDialogOpen(true);
  };

  const handleBulkPrintExecute = async () => {
    const orderIds = Array.from(selectedOrders);
    const orders: OrderWithDetails[] = [];

    for (const orderId of orderIds) {
      const orderDetails = await fetchOrderDetails(orderId);
      if (orderDetails) {
        orders.push(orderDetails);
      }
    }

    if (orders.length === 0) {
      toast({
        title: 'Error',
        description: 'Failed to load order details',
        variant: 'destructive',
      });
      return;
    }

    setBulkPrintOrders(orders);
    setBulkPrintDialogOpen(false);
    
    setTimeout(() => {
      handlePrintBulk();
    }, 100);
  };

  const pageContent = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage sales orders and track progress</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {selectedOrders.size > 0 && (
            <>
              <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <Edit className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Bulk Update</span> ({selectedOrders.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Update Orders</DialogTitle>
                    <DialogDescription>
                      Update status for {selectedOrders.size} selected order(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-status">New Status</Label>
                      <Select value={bulkStatus} onValueChange={setBulkStatus}>
                        <SelectTrigger id="bulk-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="quoted">Quoted</SelectItem>
                          <SelectItem value="deposit_due">Deposit Due</SelectItem>
                          <SelectItem value="in_queue">In Queue</SelectItem>
                          <SelectItem value="in_production">In Production</SelectItem>
                          <SelectItem value="in_labeling">In Labeling</SelectItem>
                          <SelectItem value="in_packing">In Packing</SelectItem>
                          <SelectItem value="packed">Packed</SelectItem>
                          <SelectItem value="invoiced">Invoiced</SelectItem>
                          <SelectItem value="payment_due">Payment Due</SelectItem>
                          <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="on_hold_customer">On Hold (Customer)</SelectItem>
                          <SelectItem value="on_hold_internal">On Hold (Internal)</SelectItem>
                          <SelectItem value="on_hold_materials">On Hold (Materials)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setBulkEditOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkUpdate} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Update Orders
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={bulkPrintDialogOpen} onOpenChange={setBulkPrintDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleBulkPrintSetup} className="flex-1 sm:flex-none">
                    <Printer className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Print</span> ({selectedOrders.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Print Labels</DialogTitle>
                    <DialogDescription>
                      Print labels for {selectedOrders.size} selected order(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-print-type">Label Type</Label>
                      <Select value={bulkPrintType} onValueChange={(value: any) => setBulkPrintType(value)}>
                        <SelectTrigger id="bulk-print-type">
                          <SelectValue placeholder="Select label type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="order">Order Labels</SelectItem>
                          <SelectItem value="shipping">Shipping Labels</SelectItem>
                          <SelectItem value="batch">Batch Labels</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setBulkPrintDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkPrintExecute}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print Labels
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={() => navigate('/orders/new')} className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">New Order</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg md:text-xl">All Orders</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {paginatedOrders.length} of {sortedOrders.length} filtered ({orders.length} total)
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {hasActiveFilters && (
                        <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                          !
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-background border shadow-lg z-50" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Advanced Filters</h4>
                        {hasActiveFilters && (
                          <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="">All statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="quoted">Quoted</SelectItem>
                            <SelectItem value="deposit_due">Deposit Due</SelectItem>
                            <SelectItem value="in_queue">In Queue</SelectItem>
                            <SelectItem value="in_production">In Production</SelectItem>
                            <SelectItem value="in_labeling">In Labeling</SelectItem>
                            <SelectItem value="in_packing">In Packing</SelectItem>
                            <SelectItem value="packed">Packed</SelectItem>
                            <SelectItem value="invoiced">Invoiced</SelectItem>
                            <SelectItem value="payment_due">Payment Due</SelectItem>
                            <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="on_hold_customer">On Hold (Customer)</SelectItem>
                            <SelectItem value="on_hold_internal">On Hold (Internal)</SelectItem>
                            <SelectItem value="on_hold_materials">On Hold (Materials)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Deposit Status</Label>
                        <Select value={filterDepositStatus} onValueChange={setFilterDepositStatus}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="All deposit statuses" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="">All deposit statuses</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="All customers" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="">All customers</SelectItem>
                            {customers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Date From</Label>
                        <Input
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => setFilterDateFrom(e.target.value)}
                          className="bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Date To</Label>
                        <Input
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => setFilterDateTo(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              {orders.length === 0 
                ? "No orders yet. Tap \"New Order\" to create your first one."
                : "No orders match your filters."}
            </div>
          ) : (
            <>
              {/* Mobile Card View with Swipeable Cards */}
              <div className="md:hidden px-2">
                {paginatedOrders.map((order) => (
                  <SwipeableOrderCard
                    key={order.id}
                    order={order}
                    statusColors={statusColors}
                    formatStatus={formatStatus}
                    onPrintLabel={handlePrintLabel}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.size === paginatedOrders.length && paginatedOrders.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('human_uid')}
                        className="flex items-center gap-1 hover:bg-transparent"
                      >
                        Order ID
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('customer_name')}
                        className="flex items-center gap-1 hover:bg-transparent"
                      >
                        Customer
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 hover:bg-transparent"
                      >
                        Status
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('subtotal')}
                        className="flex items-center gap-1 hover:bg-transparent"
                      >
                        Subtotal
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('created_at')}
                        className="flex items-center gap-1 hover:bg-transparent"
                      >
                        Created
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{order.human_uid}</TableCell>
                      <TableCell>{order.customer?.name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || 'bg-muted'}>
                          {formatStatus(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.deposit_required ? (
                          <Badge variant={order.deposit_status === 'paid' ? 'default' : 'outline'}>
                            {order.deposit_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>${order.subtotal.toFixed(2)}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePrintLabel(order, 'order')}>
                                Order Label
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintLabel(order, 'shipping')}>
                                Shipping Label
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintLabel(order, 'batch')}>
                                Batch Labels
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 md:px-6 py-4 border-t">
                  <div className="text-xs md:text-sm text-muted-foreground">
                    {startIndex + 1}-{Math.min(endIndex, sortedOrders.length)} of {sortedOrders.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="w-8 md:w-9"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Hidden print components */}
      {printOrder && printType === 'order' && (
        <div className="hidden">
          <OrderLabel
            ref={orderLabelRef}
            orderUid={printOrder.uid}
            humanUid={printOrder.human_uid}
            customerName={printOrder.customer.name}
            customerEmail={printOrder.customer.email}
            customerPhone={printOrder.customer.phone}
            subtotal={printOrder.subtotal}
            totalBottles={printOrder.totalBottles || 0}
            createdDate={printOrder.created_at}
            status={formatStatus(printOrder.status)}
            settings={labelSettings.order}
          />
        </div>
      )}

      {printOrder && printType === 'shipping' && (
        <div className="hidden">
          <ShippingLabel
            ref={shippingLabelRef}
            orderUid={printOrder.uid}
            humanUid={printOrder.human_uid}
            customerName={printOrder.customer.name}
            customerEmail={printOrder.customer.email}
            customerPhone={printOrder.customer.phone}
            trackingNumber={printOrder.shipment?.tracking_no}
            carrier={printOrder.shipment?.carrier}
            totalBottles={printOrder.totalBottles || 0}
            createdDate={printOrder.created_at}
            settings={labelSettings.shipping}
          />
        </div>
      )}

      {printOrder && printType === 'batch' && printOrder.batches && printOrder.batches.length > 0 && (
        <div className="hidden">
          <div ref={batchLabelsRef}>
            {printOrder.batches.map((batch) => (
              <div key={batch.uid} className="page-break-after">
                <BatchLabel
                  batchUid={batch.uid}
                  humanUid={batch.human_uid}
                  orderUid={printOrder.human_uid}
                  customerName={printOrder.customer.name}
                  quantity={batch.qty_bottle_planned}
                  createdDate={batch.created_at}
                  settings={labelSettings.batch}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk print components */}
      {bulkPrintOrders.length > 0 && (
        <div className="hidden">
          <div ref={bulkPrintRef}>
            {bulkPrintType === 'order' && bulkPrintOrders.map((order) => (
              <div key={order.uid} className="page-break-after">
                <OrderLabel
                  orderUid={order.uid}
                  humanUid={order.human_uid}
                  customerName={order.customer.name}
                  customerEmail={order.customer.email}
                  customerPhone={order.customer.phone}
                  subtotal={order.subtotal}
                  totalBottles={order.totalBottles || 0}
                  createdDate={order.created_at}
                  status={formatStatus(order.status)}
                  settings={labelSettings.order}
                />
              </div>
            ))}
            
            {bulkPrintType === 'shipping' && bulkPrintOrders.map((order) => (
              <div key={order.uid} className="page-break-after">
                <ShippingLabel
                  orderUid={order.uid}
                  humanUid={order.human_uid}
                  customerName={order.customer.name}
                  customerEmail={order.customer.email}
                  customerPhone={order.customer.phone}
                  trackingNumber={order.shipment?.tracking_no}
                  carrier={order.shipment?.carrier}
                  totalBottles={order.totalBottles || 0}
                  createdDate={order.created_at}
                  settings={labelSettings.shipping}
                />
              </div>
            ))}
            
            {bulkPrintType === 'batch' && bulkPrintOrders.map((order) => (
              order.batches?.map((batch) => (
                <div key={batch.uid} className="page-break-after">
                  <BatchLabel
                    batchUid={batch.uid}
                    humanUid={batch.human_uid}
                    orderUid={order.human_uid}
                    customerName={order.customer.name}
                    quantity={batch.qty_bottle_planned}
                    createdDate={batch.created_at}
                    settings={labelSettings.batch}
                  />
                </div>
              ))
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        {pageContent}
      </PullToRefresh>
    );
  }

  return pageContent;
};

export default Orders;