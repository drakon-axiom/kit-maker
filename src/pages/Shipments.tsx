import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Plus, Pencil, Trash2, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          human_uid,
          customer:customers(name)
        `)
        .in('status', ['packed', 'in_packing', 'in_labeling'])
        .order('human_uid', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground mt-1">Track all shipped orders</p>
        </div>
        <div className="flex gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Shipments</CardTitle>
              <CardDescription>
                {filteredShipments.length} of {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
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
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Shipped Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.map((shipment) => {
                  const trackingUrl = getTrackingUrl(shipment.carrier, shipment.tracking_no);
                  return (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono">{shipment.sales_order.human_uid}</TableCell>
                      <TableCell>{shipment.sales_order.customer.name}</TableCell>
                      <TableCell>{shipment.carrier || '-'}</TableCell>
                      <TableCell className="font-mono">
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
                      <TableCell>
                        {shipment.shipped_at 
                          ? new Date(shipment.shipped_at).toLocaleDateString()
                          : 'Pending'}
                      </TableCell>
                      <TableCell>
                        {shipment.tracking_status ? (
                          <Badge variant="outline">{shipment.tracking_status}</Badge>
                        ) : (
                          <Badge className="bg-success">Shipped</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shipment.tracking_location || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shipment.last_tracking_update
                          ? new Date(shipment.last_tracking_update).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(shipment)}
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
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
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
    </div>
  );
};

export default Shipments;