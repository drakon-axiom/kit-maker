import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Plus, Pencil, Trash2, Search, ExternalLink, RefreshCw, Clock, Filter, TrendingUp, Calendar, Download, CheckSquare, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

interface Shipment {
  id: string;
  so_id: string;
  carrier: string | null;
  tracking_no: string;
  shipped_at: string | null;
  notes: string | null;
  tracking_status: string | null;
  tracking_location: string | null;
  last_tracking_update: string | null;
  estimated_delivery: string | null;
  sales_order: {
    id: string;
    human_uid: string;
    customer: {
      name: string;
    };
  };
}

interface SalesOrder {
  id: string;
  human_uid: string;
  customer: {
    name: string;
  };
  shipments: Array<{ id: string }>;
}

const Shipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [nextUpdateTime, setNextUpdateTime] = useState<string>('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivered' | 'partial' | 'in-transit'>('all');
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'carrier' | 'notes'>('carrier');
  const [bulkCarrier, setBulkCarrier] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    so_id: '',
    carrier: '',
    tracking_no: '',
    shipped_at: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchShipments();
    fetchOrders();
    
    // Calculate next update time
    const updateNextUpdateTime = () => {
      const now = new Date();
      const hours = now.getUTCHours();
      const nextRun = new Date(now);
      
      // Cron runs at 00:00 and 12:00 UTC
      if (hours < 12) {
        nextRun.setUTCHours(12, 0, 0, 0);
      } else {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
        nextRun.setUTCHours(0, 0, 0, 0);
      }
      
      const diff = nextRun.getTime() - now.getTime();
      const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setNextUpdateTime(`${hoursLeft}h ${minutesLeft}m`);
    };
    
    updateNextUpdateTime();
    const interval = setInterval(updateNextUpdateTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const fetchShipments = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          sales_order:sales_orders(
            id,
            human_uid,
            customer:customers(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data as any || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          human_uid,
          customer:customers(name),
          shipments:shipments(id)
        `)
        .in('status', ['packed', 'in_packing', 'in_labeling', 'shipped'])
        .order('human_uid', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
    } catch {
      // Order fetch errors are non-critical
    }
  };

  const filteredShipments = shipments.filter(shipment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shipment.sales_order.human_uid.toLowerCase().includes(query) ||
      shipment.sales_order.customer.name.toLowerCase().includes(query) ||
      shipment.carrier?.toLowerCase().includes(query) ||
      shipment.tracking_no.toLowerCase().includes(query)
    );
  });

  // Group shipments by order
  const groupedShipments = filteredShipments.reduce((acc, shipment) => {
    const orderId = shipment.sales_order.id;
    if (!acc[orderId]) {
      acc[orderId] = {
        order: shipment.sales_order,
        shipments: [],
      };
    }
    acc[orderId].shipments.push(shipment);
    return acc;
  }, {} as Record<string, { order: Shipment['sales_order'], shipments: Shipment[] }>);

  // Apply delivery status filter
  const ordersWithShipments = Object.values(groupedShipments).filter(({ shipments: orderShipments }) => {
    const deliveredCount = orderShipments.filter(s => 
      s.tracking_status?.toLowerCase().includes('delivered')
    ).length;
    const totalCount = orderShipments.length;

    if (deliveryFilter === 'delivered') {
      return deliveredCount === totalCount;
    } else if (deliveryFilter === 'partial') {
      return deliveredCount > 0 && deliveredCount < totalCount;
    } else if (deliveryFilter === 'in-transit') {
      return deliveredCount === 0;
    }
    return true; // 'all'
  });

  const handleOpenDialog = (shipment?: Shipment) => {
    if (shipment) {
      setEditingShipment(shipment);
      setFormData({
        so_id: shipment.so_id,
        carrier: shipment.carrier || '',
        tracking_no: shipment.tracking_no,
        shipped_at: shipment.shipped_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        notes: shipment.notes || '',
      });
    } else {
      setEditingShipment(null);
      setFormData({
        so_id: '',
        carrier: '',
        tracking_no: '',
        shipped_at: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingShipment) {
        const { error } = await supabase
          .from('shipments')
          .update({
            carrier: formData.carrier || null,
            tracking_no: formData.tracking_no,
            shipped_at: formData.shipped_at ? new Date(formData.shipped_at).toISOString() : null,
            notes: formData.notes || null,
          })
          .eq('id', editingShipment.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Shipment updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('shipments')
          .insert({
            so_id: formData.so_id,
            carrier: formData.carrier || null,
            tracking_no: formData.tracking_no,
            shipped_at: formData.shipped_at ? new Date(formData.shipped_at).toISOString() : null,
            notes: formData.notes || null,
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Shipment created successfully',
        });
      }

      setDialogOpen(false);
      fetchShipments();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!shipmentToDelete) return;

    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', shipmentToDelete.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Shipment deleted successfully',
      });

      setDeleteDialogOpen(false);
      setShipmentToDelete(null);
      fetchShipments();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshTracking = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-tracking');

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Updated tracking for ${data.updated} shipment(s)`,
      });

      // Refresh the shipments list
      fetchShipments();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshSingle = async (id: string) => {
    setRefreshingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('update-tracking', {
        body: { shipmentId: id },
      });
      if (error) throw error;
      toast({ title: 'Tracking refreshed', description: `Updated ${data.updated} shipment(s)` });
      fetchShipments();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setRefreshingIds((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    }
  };

  const getTrackingUrl = (carrier: string | null, trackingNo: string) => {
    if (!carrier) return null;
    const lowerCarrier = carrier.toLowerCase();
    
    if (lowerCarrier.includes('ups')) {
      return `https://www.ups.com/track?tracknum=${trackingNo}`;
    } else if (lowerCarrier.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNo}`;
    } else if (lowerCarrier.includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNo}`;
    } else if (lowerCarrier.includes('dhl')) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNo}`;
    }
    return null;
  };

  const toggleShipmentSelection = (shipmentId: string) => {
    const newSelection = new Set(selectedShipments);
    if (newSelection.has(shipmentId)) {
      newSelection.delete(shipmentId);
    } else {
      newSelection.add(shipmentId);
    }
    setSelectedShipments(newSelection);
  };

  const toggleAllShipments = () => {
    if (selectedShipments.size === filteredShipments.length) {
      setSelectedShipments(new Set());
    } else {
      const allIds = filteredShipments.map(s => s.id);
      setSelectedShipments(new Set(allIds));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedShipments.size === 0) return;

    try {
      const updates: any = {};
      
      if (bulkAction === 'carrier' && bulkCarrier) {
        updates.carrier = bulkCarrier;
      } else if (bulkAction === 'notes' && bulkNotes) {
        updates.notes = bulkNotes;
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: 'Error',
          description: 'Please provide a value to update',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('shipments')
        .update(updates)
        .in('id', Array.from(selectedShipments));

      if (error) throw error;

      // Send notification for status changes if carrier was updated
      if (bulkAction === 'carrier') {
        for (const shipmentId of Array.from(selectedShipments)) {
          try {
            await supabase.functions.invoke('send-shipment-notification', {
              body: {
                shipmentId,
                status: 'In Transit',
              },
            });
          } catch {
            // Email notification errors are non-critical
          }
        }
      }

      toast({
        title: 'Success',
        description: `Updated ${selectedShipments.size} shipment(s)`,
      });

      setBulkDialogOpen(false);
      setBulkCarrier('');
      setBulkNotes('');
      setSelectedShipments(new Set());
      fetchShipments();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleExportToCSV = () => {
    // Flatten the grouped shipments for CSV export
    const exportData = ordersWithShipments.flatMap(({ order, shipments: orderShipments }) => 
      orderShipments.map(shipment => ({
        'Order ID': order.human_uid,
        'Customer': order.customer.name,
        'Carrier': shipment.carrier || '',
        'Tracking Number': shipment.tracking_no,
        'Tracking URL': getTrackingUrl(shipment.carrier, shipment.tracking_no) || '',
        'Shipped Date': shipment.shipped_at ? new Date(shipment.shipped_at).toLocaleDateString() : '',
        'Estimated Delivery': shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString() : '',
        'Tracking Status': shipment.tracking_status || 'Shipped',
        'Current Location': shipment.tracking_location || '',
        'Last Update': shipment.last_tracking_update ? new Date(shipment.last_tracking_update).toLocaleDateString() : '',
        'Notes': shipment.notes || '',
      }))
    );

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filterLabel = deliveryFilter === 'all' ? 'all' : 
                       deliveryFilter === 'delivered' ? 'fully-delivered' :
                       deliveryFilter === 'partial' ? 'partially-delivered' : 'in-transit';
    
    link.setAttribute('href', url);
    link.setAttribute('download', `shipments-${filterLabel}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export Successful',
      description: `Exported ${exportData.length} shipment(s) to CSV`,
    });
  };

  // Calculate statistics
  const fullyDeliveredCount = Object.values(groupedShipments).filter(({ shipments: orderShipments }) => {
    const deliveredCount = orderShipments.filter(s => s.tracking_status?.toLowerCase().includes('delivered')).length;
    return deliveredCount === orderShipments.length;
  }).length;

  const partiallyDeliveredCount = Object.values(groupedShipments).filter(({ shipments: orderShipments }) => {
    const deliveredCount = orderShipments.filter(s => s.tracking_status?.toLowerCase().includes('delivered')).length;
    return deliveredCount > 0 && deliveredCount < orderShipments.length;
  }).length;

  const inTransitCount = Object.values(groupedShipments).filter(({ shipments: orderShipments }) => {
    const deliveredCount = orderShipments.filter(s => s.tracking_status?.toLowerCase().includes('delivered')).length;
    return deliveredCount === 0;
  }).length;

  const statsData = [
    { name: 'Fully Delivered', value: fullyDeliveredCount, color: 'hsl(var(--success))' },
    { name: 'Partially Delivered', value: partiallyDeliveredCount, color: 'hsl(var(--warning))' },
    { name: 'In Transit', value: inTransitCount, color: 'hsl(var(--primary))' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground mt-1">Track all shipped orders</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
            <Clock className="h-4 w-4" />
            <span>Next auto-update: {nextUpdateTime}</span>
          </div>
          <Button
            variant="outline"
            onClick={handleRefreshTracking}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Tracking
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Shipment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingShipment ? 'Edit Shipment' : 'Create Shipment'}</DialogTitle>
              <DialogDescription>
                {editingShipment ? 'Update shipment details' : 'Create a new shipment for an order'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingShipment && (
                <div className="space-y-2">
                  <Label htmlFor="so_id">Order *</Label>
                  <Select value={formData.so_id} onValueChange={(value) => setFormData({ ...formData, so_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.human_uid} - {order.customer.name}
                          {order.shipments.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({order.shipments.length} shipment{order.shipments.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  placeholder="e.g., UPS, FedEx, USPS"
                  value={formData.carrier}
                  onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracking_no">Tracking Number *</Label>
                <Input
                  id="tracking_no"
                  placeholder="Enter tracking number"
                  value={formData.tracking_no}
                  onChange={(e) => setFormData({ ...formData, tracking_no: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipped_at">Shipped Date</Label>
                <Input
                  id="shipped_at"
                  type="date"
                  value={formData.shipped_at}
                  onChange={(e) => setFormData({ ...formData, shipped_at: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingShipment ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Delivery Statistics
            </CardTitle>
            <CardDescription>Overview of order delivery status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">{fullyDeliveredCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Fully Delivered</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-warning">{partiallyDeliveredCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Partially Delivered</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{inTransitCount}</div>
                <p className="text-xs text-muted-foreground mt-1">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Status Distribution</CardTitle>
            <CardDescription>Visual breakdown of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Shipments</CardTitle>
                <CardDescription>
                  {filteredShipments.length} shipment{filteredShipments.length !== 1 ? 's' : ''} across {ordersWithShipments.length} order{ordersWithShipments.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportToCSV}
                  disabled={ordersWithShipments.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order, customer, carrier, tracking..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-2">
                <Button
                  variant={deliveryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={deliveryFilter === 'delivered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('delivered')}
                >
                  Fully Delivered
                </Button>
                <Button
                  variant={deliveryFilter === 'partial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('partial')}
                >
                  Partially Delivered
                </Button>
                <Button
                  variant={deliveryFilter === 'in-transit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryFilter('in-transit')}
                >
                  In Transit
                </Button>
              </div>
            </div>
            {selectedShipments.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md">
                <span className="text-sm font-medium">
                  {selectedShipments.size} shipment{selectedShipments.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setBulkDialogOpen(true)}
                >
                  Bulk Update
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedShipments(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No shipments yet</p>
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shipments match your search "{searchQuery}"
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={toggleAllShipments}
                    >
                      {selectedShipments.size === filteredShipments.length && filteredShipments.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersWithShipments.map(({ order, shipments: orderShipments }) => {
                  const isExpanded = expandedOrders[order.id];
                  const deliveredCount = orderShipments.filter(s => 
                    s.tracking_status?.toLowerCase().includes('delivered')
                  ).length;
                  const totalCount = orderShipments.length;
                  const allDelivered = deliveredCount === totalCount;
                  const deliveryProgress = (deliveredCount / totalCount) * 100;
                  const latestUpdate = orderShipments.reduce((latest, s) => {
                    if (!s.last_tracking_update) return latest;
                    if (!latest) return s.last_tracking_update;
                    return new Date(s.last_tracking_update) > new Date(latest) ? s.last_tracking_update : latest;
                  }, null as string | null);

                  return (
                    <>
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? '−' : '+'}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono" onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          {order.human_uid}
                        </TableCell>
                        <TableCell onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          {order.customer.name}
                        </TableCell>
                        <TableCell onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          <div className="flex flex-wrap gap-1">
                            {orderShipments.map((shipment, idx) => {
                              const trackingUrl = getTrackingUrl(shipment.carrier, shipment.tracking_no);
                              return (
                                <Badge key={shipment.id} variant="secondary" className="font-mono text-xs">
                                  {trackingUrl ? (
                                    <a
                                      href={trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline inline-flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {shipment.tracking_no}
                                      <ExternalLink className="h-2 w-2" />
                                    </a>
                                  ) : (
                                    shipment.tracking_no
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {allDelivered ? (
                                <Badge className="bg-success">All Delivered</Badge>
                              ) : deliveredCount > 0 ? (
                                <Badge variant="outline">
                                  {deliveredCount} of {totalCount} Delivered
                                </Badge>
                              ) : (
                                <Badge variant="outline">In Transit ({totalCount})</Badge>
                              )}
                            </div>
                            {!allDelivered && totalCount > 1 && (
                              <div className="space-y-1">
                                <Progress 
                                  value={deliveryProgress} 
                                  className="h-1.5"
                                  indicatorClassName={
                                    deliveryProgress > 75 
                                      ? "bg-green-500" 
                                      : deliveryProgress >= 50 
                                      ? "bg-yellow-500" 
                                      : "bg-orange-500"
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  {deliveredCount} / {totalCount} packages delivered
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}>
                          {latestUpdate ? new Date(latestUpdate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              orderShipments.forEach(s => handleRefreshSingle(s.id));
                            }}
                            disabled={orderShipments.some(s => refreshingIds[s.id])}
                            aria-label="Refresh all tracking"
                          >
                            <RefreshCw className={`h-4 w-4 ${orderShipments.some(s => refreshingIds[s.id]) ? 'animate-spin' : ''}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && orderShipments.map((shipment) => {
                        const trackingUrl = getTrackingUrl(shipment.carrier, shipment.tracking_no);
                        const isSelected = selectedShipments.has(shipment.id);
                        return (
                          <TableRow key={`detail-${shipment.id}`} className="bg-muted/30">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleShipmentSelection(shipment.id)}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-primary" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.carrier || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {trackingUrl ? (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  {shipment.tracking_no}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                shipment.tracking_no
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="space-y-1">
                                <div>
                                  {shipment.shipped_at
                                    ? new Date(shipment.shipped_at).toLocaleDateString()
                                    : 'Pending'}
                                </div>
                                {shipment.estimated_delivery && !shipment.tracking_status?.toLowerCase().includes('delivered') && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>Est: {new Date(shipment.estimated_delivery).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {shipment.tracking_status ? (
                                <Badge variant="outline" className="text-xs">{shipment.tracking_status}</Badge>
                              ) : (
                                <Badge className="bg-success text-xs">Shipped</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.tracking_location || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRefreshSingle(shipment.id)}
                                  disabled={!!refreshingIds[shipment.id]}
                                  aria-label="Refresh tracking"
                                >
                                  <RefreshCw className={`h-4 w-4 ${refreshingIds[shipment.id] ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(shipment)}
                                  aria-label="Edit shipment"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setShipmentToDelete(shipment);
                                    setDeleteDialogOpen(true);
                                  }}
                                  aria-label="Delete shipment"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shipment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShipmentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Shipments</DialogTitle>
            <DialogDescription>
              Update {selectedShipments.size} selected shipment{selectedShipments.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={bulkAction} onValueChange={(value: 'carrier' | 'notes') => setBulkAction(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carrier">Update Carrier</SelectItem>
                  <SelectItem value="notes">Add Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkAction === 'carrier' ? (
              <div className="space-y-2">
                <Label htmlFor="bulk-carrier">Carrier</Label>
                <Select value={bulkCarrier} onValueChange={setBulkCarrier}>
                  <SelectTrigger id="bulk-carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPS">UPS</SelectItem>
                    <SelectItem value="FedEx">FedEx</SelectItem>
                    <SelectItem value="USPS">USPS</SelectItem>
                    <SelectItem value="DHL">DHL</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="bulk-notes">Notes</Label>
                <Textarea
                  id="bulk-notes"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Enter notes to add to selected shipments..."
                  rows={4}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate}>
              Update {selectedShipments.size} Shipment{selectedShipments.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shipments;