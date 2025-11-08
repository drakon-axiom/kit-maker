import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, DollarSign, Package, Pencil, Trash2, Plus, Factory } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OrderDetail {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  subtotal: number;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_status: string;
  label_required: boolean;
  eta_date: string | null;
  promised_date: string | null;
  created_at: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  sales_order_lines: Array<{
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: {
      code: string;
      description: string;
    };
  }>;
}

interface Batch {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  qty_bottle_planned: number;
  qty_bottle_good: number;
  qty_bottle_scrap: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted',
  quoted: 'bg-blue-500',
  deposit_due: 'bg-warning',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  in_labeling: 'bg-indigo-500',
  in_packing: 'bg-cyan-500',
  packed: 'bg-success',
  invoiced: 'bg-orange-500',
  payment_due: 'bg-warning',
  ready_to_ship: 'bg-success',
  shipped: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
  on_hold_customer: 'bg-amber-500',
  on_hold_internal: 'bg-amber-600',
  on_hold_materials: 'bg-amber-700',
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [createBatchDialogOpen, setCreateBatchDialogOpen] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchBatches();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email, phone),
          sales_order_lines(
            *,
            sku:skus(code, description)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);
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

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('*')
        .eq('so_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      console.error('Error fetching batches:', error);
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

  const handleDelete = async () => {
    if (!order) return;
    
    setDeleting(true);
    try {
      if (deleteMode === 'soft') {
        // Soft delete: Update status to cancelled
        const { error } = await supabase
          .from('sales_orders')
          .update({ status: 'cancelled' })
          .eq('id', id);

        if (error) throw error;

        // Audit log
        await supabase.from('audit_log').insert([{
          action: 'update',
          entity: 'sales_order',
          entity_id: id,
          after: { status: 'cancelled' },
        }]);

        toast({
          title: 'Order Cancelled',
          description: `Order ${order.human_uid} has been cancelled`,
        });

        // Refresh the order
        fetchOrder();
      } else {
        // Hard delete: Delete order and related records
        // First delete order lines
        const { error: linesError } = await supabase
          .from('sales_order_lines')
          .delete()
          .eq('so_id', id);

        if (linesError) throw linesError;

        // Delete order
        const { error: orderError } = await supabase
          .from('sales_orders')
          .delete()
          .eq('id', id);

        if (orderError) throw orderError;

        // Audit log
        await supabase.from('audit_log').insert([{
          action: 'delete',
          entity: 'sales_order',
          entity_id: id,
          before: { order_uid: order.human_uid },
        }]);

        toast({
          title: 'Order Deleted',
          description: `Order ${order.human_uid} has been permanently deleted`,
        });

        navigate('/orders');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = (mode: 'soft' | 'hard') => {
    setDeleteMode(mode);
    setDeleteDialogOpen(true);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order || newStatus === order.status) return;
    
    setUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ status: newStatus as any })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log the status change
      await supabase.from('audit_log').insert({
        entity: 'sales_order',
        entity_id: id,
        action: 'status_changed',
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        before: { status: order.status },
        after: { status: newStatus },
      });

      toast({
        title: 'Status Updated',
        description: `Order status changed to ${formatStatus(newStatus)}`,
      });

      fetchOrder();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const generateBatchUid = async () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get count of batches created today
    const { data, error } = await supabase
      .from('production_batches')
      .select('uid')
      .like('uid', `BAT-${dateStr}%`)
      .order('uid', { ascending: false })
      .limit(1);

    if (error) throw error;

    let sequence = 1;
    if (data && data.length > 0) {
      const lastUid = data[0].uid;
      const lastSeq = parseInt(lastUid.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    const uid = `BAT-${dateStr}-${sequence.toString().padStart(2, '0')}`;
    const humanUid = `BAT-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${sequence.toString().padStart(2, '0')}`;
    
    return { uid, humanUid };
  };

  const createBatch = async () => {
    if (!order || !batchQuantity) return;

    const qty = parseInt(batchQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    setCreatingBatch(true);
    try {
      // Generate BAT number
      const { uid, humanUid } = await generateBatchUid();

      // Create batch
      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .insert({
          so_id: order.id,
          uid,
          human_uid: humanUid,
          status: 'queued',
          qty_bottle_planned: qty,
          qty_bottle_good: 0,
          qty_bottle_scrap: 0,
          priority_index: 0,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create workflow steps
      const workflowSteps = [
        { step: 'produce' as const, batch_id: batchData.id, status: 'pending' as const },
        { step: 'bottle_cap' as const, batch_id: batchData.id, status: 'pending' as const },
        { step: 'label' as const, batch_id: batchData.id, status: 'pending' as const },
        { step: 'pack' as const, batch_id: batchData.id, status: 'pending' as const },
      ];

      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(workflowSteps);

      if (stepsError) throw stepsError;

      // Log batch creation
      await supabase.from('audit_log').insert({
        entity: 'production_batch',
        entity_id: batchData.id,
        action: 'created',
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        after: { uid: humanUid, qty: qty },
      });

      toast({
        title: 'Batch Created',
        description: `Batch ${humanUid} created successfully`,
      });

      // Refresh batches and close dialog
      fetchBatches();
      setCreateBatchDialogOpen(false);
      setBatchQuantity('');
    } catch (error: any) {
      console.error('Error creating batch:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingBatch(false);
    }
  };

  const totalBottles = order?.sales_order_lines.reduce((sum, line) => sum + line.bottle_qty, 0) || 0;
  const totalBatchedBottles = batches.reduce((sum, batch) => sum + batch.qty_bottle_planned, 0);
  const remainingBottles = totalBottles - totalBatchedBottles;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
          <Button className="mt-4" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight font-mono">{order.human_uid}</h1>
          <p className="text-muted-foreground mt-1">{order.customer.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (order.status === 'draft' || order.status === 'quoted') && (
            <Button variant="outline" onClick={() => navigate(`/orders/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Order
            </Button>
          )}
          {userRole === 'admin' && (
            <>
              <Select 
                value={order.status} 
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue>
                    <Badge className={statusColors[order.status] || 'bg-muted'}>
                      {formatStatus(order.status)}
                    </Badge>
                  </SelectValue>
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
                  <SelectItem value="on_hold_customer">On Hold (Customer Hold)</SelectItem>
                  <SelectItem value="on_hold_internal">On Hold (Internal Hold)</SelectItem>
                  <SelectItem value="on_hold_materials">On Hold (Materials Hold)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openDeleteDialog('soft')}>
                    <span className="text-warning">Cancel Order</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openDeleteDialog('hard')}>
                    <span className="text-destructive">Delete Permanently</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {userRole !== 'admin' && (
            <Badge className={statusColors[order.status] || 'bg-muted'}>
              {formatStatus(order.status)}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{order.customer.name}</p>
            </div>
            {order.customer.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.customer.email}</p>
              </div>
            )}
            {order.customer.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{order.customer.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Bottles</span>
              <span className="font-mono font-medium">{totalBottles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Labels Required</span>
              <Badge variant={order.label_required ? 'default' : 'outline'}>
                {order.label_required ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium">${order.subtotal.toFixed(2)}</span>
            </div>
            {order.deposit_required && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Deposit</span>
                  <div className="text-right">
                    <div className="font-medium">${order.deposit_amount.toFixed(2)}</div>
                    <Badge variant={order.deposit_status === 'paid' ? 'default' : 'outline'} className="text-xs">
                      {order.deposit_status}
                    </Badge>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold pt-2">
              <span>Order Total</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>{order.sales_order_lines.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Bottles</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.sales_order_lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono">{line.sku.code}</TableCell>
                  <TableCell>{line.sku.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {line.sell_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{line.qty_entered}</TableCell>
                  <TableCell className="font-mono">{line.bottle_qty}</TableCell>
                  <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${line.line_subtotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production Batches */}
      {(order.status === 'in_queue' || order.status === 'in_production' || order.status === 'in_labeling' || order.status === 'in_packing' || batches.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Production Batches</CardTitle>
                <CardDescription>
                  {batches.length} batch(es) • {totalBatchedBottles} / {totalBottles} bottles batched
                </CardDescription>
              </div>
              {userRole === 'admin' && remainingBottles > 0 && (
                <Button onClick={() => {
                  setBatchQuantity(remainingBottles.toString());
                  setCreateBatchDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Batch
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Factory className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No production batches yet</p>
                <p className="text-sm mt-1">Create batches to start production</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-mono font-medium">{batch.human_uid}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Created {new Date(batch.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={statusColors[batch.status] || 'bg-muted'}>
                        {formatStatus(batch.status)}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        {batch.qty_bottle_good} / {batch.qty_bottle_planned} bottles
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {remainingBottles > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">{remainingBottles} bottles</span> remaining to be batched
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userRole === 'admin' && order.status === 'draft' && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Actions available for this order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="outline">
              <DollarSign className="mr-2 h-4 w-4" />
              Generate Quote
            </Button>
            <Button className="w-full" variant="outline">
              <Package className="mr-2 h-4 w-4" />
              Plan Batches
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === 'soft' ? 'Cancel Order?' : 'Delete Order Permanently?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'soft' ? (
                <>
                  This will mark order <span className="font-mono font-semibold">{order?.human_uid}</span> as cancelled. 
                  The order will remain in the system for record keeping.
                </>
              ) : (
                <>
                  This will permanently delete order <span className="font-mono font-semibold">{order?.human_uid}</span> and 
                  all its line items. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={deleteMode === 'hard' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {deleting ? 'Processing...' : deleteMode === 'soft' ? 'Cancel Order' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createBatchDialogOpen} onOpenChange={setCreateBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Production Batch</DialogTitle>
            <DialogDescription>
              Create a new production batch for order {order?.human_uid}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-qty">Bottle Quantity</Label>
              <Input
                id="batch-qty"
                type="number"
                min="1"
                max={remainingBottles}
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
              <p className="text-xs text-muted-foreground">
                {remainingBottles} bottles remaining to be batched
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="text-sm font-medium">Batch will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Auto-generated BAT number</li>
                <li>• 4 workflow steps (produce, bottle/cap, label, pack)</li>
                <li>• Added to production queue</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBatchDialogOpen(false)} disabled={creatingBatch}>
              Cancel
            </Button>
            <Button onClick={createBatch} disabled={creatingBatch}>
              {creatingBatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Factory className="mr-2 h-4 w-4" />
                  Create Batch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetail;