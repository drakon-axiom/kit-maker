import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, DollarSign, Package, Pencil, Trash2, Plus, Factory, Printer, Calendar as CalendarIcon, Split, Eye, Truck } from 'lucide-react';
import { OrderAddOnsList } from '@/components/OrderAddOnsList';
import { AddOnCreator } from '@/components/AddOnCreator';
import { canCreateAddon } from '@/utils/orderAddons';
import { AddOnOverrideDialog } from '@/components/AddOnOverrideDialog';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import BatchLabel from '@/components/BatchLabel';
import BatchScheduler from '@/components/BatchScheduler';
import BatchSplitMerge from '@/components/BatchSplitMerge';
import QuotePreview from '@/components/QuotePreview';
import BatchPlanner from '@/components/BatchPlanner';
import QuoteCountdown from '@/components/QuoteCountdown';
import { ProductionPhotoUpload } from '@/components/ProductionPhotoUpload';
import { ProductionPhotosGallery } from '@/components/ProductionPhotosGallery';
import { SendCustomSMS } from '@/components/SendCustomSMS';
import { StatusChangeDialog } from '@/components/StatusChangeDialog';
import { InvoiceManagement } from '@/components/InvoiceManagement';
import { ShipStationLabelDialog } from '@/components/ShipStationLabelDialog';
import { ManualTrackingDialog } from '@/components/ManualTrackingDialog';
import { PackingDetails } from '@/components/PackingDetails';
import { ConsolidatedOrderSummary } from '@/components/ConsolidatedOrderSummary';
import { ConsolidatedLineItems } from '@/components/ConsolidatedLineItems';
import { shouldShowConsolidatedView } from '@/utils/consolidatedOrder';
import { Database } from '@/integrations/supabase/types';
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
  consolidated_total?: number | null;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_status: string;
  label_required: boolean;
  eta_date: string | null;
  promised_date: string | null;
  quote_expiration_days: number | null;
  quote_expires_at: string | null;
  created_at: string;
  is_internal: boolean;
  notes: string | null;
  brand_id: string | null;
  brand?: {
    name: string;
    slug: string;
  } | null;
  customer?: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  customer_id: string | null;
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
      batch_prefix?: string;
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
  queued: 'bg-purple-500',
  wip: 'bg-primary',
  complete: 'bg-success',
};

const InlineNotes = ({ orderId, initialNotes, onUpdate }: { orderId: string; initialNotes: string | null; onUpdate: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ notes: notes.trim() || null })
        .eq('id', orderId);
      if (error) throw error;
      setEditing(false);
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px]"
          placeholder="Add notes..."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setNotes(initialNotes || ''); setEditing(false); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p
      className="font-medium cursor-pointer hover:text-primary transition-colors"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {initialNotes || <span className="text-muted-foreground italic">Click to add notes...</span>}
    </p>
  );
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
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [splitMergeOpen, setSplitMergeOpen] = useState(false);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [batchPlannerOpen, setBatchPlannerOpen] = useState(false);
  const [batchAllocations, setBatchAllocations] = useState<Record<string, number>>({});
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<Database["public"]["Enums"]["order_status"] | null>(null);
  const [shipStationDialogOpen, setShipStationDialogOpen] = useState(false);
  const [manualTrackingDialogOpen, setManualTrackingDialogOpen] = useState(false);
  const [addOnCreatorOpen, setAddOnCreatorOpen] = useState(false);
  const [addOnOverrideDialogOpen, setAddOnOverrideDialogOpen] = useState(false);
  const [addOnOverrideNote, setAddOnOverrideNote] = useState('');
  const [addOnIsOverride, setAddOnIsOverride] = useState(false);
  const [addOnsKey, setAddOnsKey] = useState(0);
  const labelRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: labelRef,
  });

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email, phone),
          brand:brands(name, slug),
          sales_order_lines(
            *,
            sku:skus(code, description, batch_prefix)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load order',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchBatches = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('*')
        .eq('so_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch {
      // Batch fetch errors are non-critical
    }
  }, [id]);

  const fetchBatchAllocations = useCallback(async () => {
    if (!id) return;
    try {
      // 1) Get all batch ids for this order
      const { data: batchRows, error: batchesErr } = await supabase
        .from('production_batches')
        .select('id, human_uid, qty_bottle_planned')
        .eq('so_id', id);

      if (batchesErr) throw batchesErr;

      const batchIds = (batchRows || []).map((b) => b.id);

      // Build a map of planned bottles per SKU prefix from existing batches
      const plannedByPrefix: Record<string, number> = {};
      (batchRows || []).forEach((b) => {
        const prefix = (b.human_uid || '').split('-')[0];
        if (!prefix) return;
        plannedByPrefix[prefix] = (plannedByPrefix[prefix] || 0) + (b.qty_bottle_planned || 0);
      });

      // Start with allocations from explicit batch items if present
      const allocations: Record<string, number> = {};

      if (batchIds.length > 0) {
        const { data: itemsRows, error: itemsErr } = await supabase
          .from('production_batch_items')
          .select('so_line_id, bottle_qty_allocated, batch_id')
          .in('batch_id', batchIds);

        if (itemsErr) throw itemsErr;

        (itemsRows || []).forEach((item) => {
          const lineId = item.so_line_id;
          allocations[lineId] = (allocations[lineId] || 0) + (item.bottle_qty_allocated || 0);
        });
      }

      // Fallback: if no explicit allocations for a line, infer from batch prefixes
      if (order?.sales_order_lines) {
        for (const line of order.sales_order_lines) {
          const current = allocations[line.id] || 0;
          if (current > 0) continue; // already has explicit allocation

          const key = line.sku.batch_prefix || line.sku.code;
          const plannedForKey = plannedByPrefix[key] || 0;
          if (plannedForKey > 0) {
            // Cap by line requirement (keeps parity with bottom summary logic)
            allocations[line.id] = Math.min(line.bottle_qty, plannedForKey);
          }
        }
      }

      setBatchAllocations(allocations);
    } catch {
      setBatchAllocations({});
    }
  }, [id, order]);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchBatches();
      fetchBatchAllocations();
    }
  }, [id, fetchOrder, fetchBatches, fetchBatchAllocations]);

  // Subscribe to realtime status updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-status-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales_orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;

          if (newStatus && oldStatus && newStatus !== oldStatus) {
            // Update local state
            setOrder((prev) => prev ? { ...prev, status: newStatus } : prev);

            // Show toast notification
            toast({
              title: 'Status Updated',
              description: `Order status changed from ${formatStatus(oldStatus)} to ${formatStatus(newStatus)}`,
            });

            // Refetch to get any related data changes
            fetchBatches();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast, fetchBatches]);

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
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Delete failed',
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

  const handleStatusChange = async (newStatus: string, overrideNote?: string) => {
    if (!order || newStatus === order.status) return;
    
    const oldStatus = order.status;
    setUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ status: newStatus as any })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log the status change with override note if provided
      await supabase.from('audit_log').insert({
        entity: 'sales_order',
        entity_id: id,
        action: overrideNote ? 'status_changed_override' : 'status_changed',
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        before: { status: oldStatus },
        after: { 
          status: newStatus,
          override_note: overrideNote || null
        },
      });

      // Send email notification (fire and forget - errors logged but not blocking)
      supabase.functions.invoke('send-order-notification', {
        body: {
          orderId: order.id,
          newStatus: newStatus,
          oldStatus: oldStatus,
        },
      }).then(({ error }) => {
        if (error) console.error('Email notification failed:', error);
      });

      // Send SMS notification if customer has phone and SMS enabled
      if (order.customer?.phone) {
        supabase.functions.invoke('send-sms-notification', {
          body: {
            orderId: order.id,
            newStatus: newStatus,
            phoneNumber: order.customer.phone,
            eventType: 'order_status',
          },
        }).then(({ error }) => {
          if (error) console.error('SMS notification failed:', error);
        });
      }

      toast({
        title: 'Status Updated',
        description: `Order status changed to ${formatStatus(newStatus)}`,
      });

      fetchOrder();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Status update failed',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const initiateStatusChange = (newStatus: string) => {
    setPendingStatusChange(newStatus as Database["public"]["Enums"]["order_status"]);
    setStatusChangeDialogOpen(true);
  };

  const handleApproval = async (approved: boolean) => {
    if (!order) return;
    
    setProcessingApproval(true);
    try {
      // Determine next status
      let nextStatus = 'in_queue';
      if (approved) {
        nextStatus = order.deposit_required ? 'deposit_due' : 'in_queue';
      } else {
        nextStatus = 'cancelled';
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ status: nextStatus as any })
        .eq('id', id);

      if (updateError) throw updateError;

      // Send notification email
      const { error: emailError } = await supabase.functions.invoke('send-order-approval', {
        body: {
          orderId: order.id,
          approved,
          rejectionReason: approved ? undefined : rejectionReason,
        },
      });

      // Email errors are logged but not shown to user

      // Log the action
      await supabase.from('audit_log').insert({
        entity: 'sales_order',
        entity_id: id,
        action: approved ? 'order_approved' : 'order_rejected',
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        before: { status: order.status },
        after: { status: nextStatus, reason: approved ? undefined : rejectionReason },
      });

      toast({
        title: approved ? 'Order Approved' : 'Order Rejected',
        description: approved 
          ? `Order ${order.human_uid} has been approved and customer notified`
          : `Order ${order.human_uid} has been rejected and customer notified`,
      });

      setApprovalDialogOpen(false);
      setRejectionDialogOpen(false);
      setRejectionReason('');
      fetchOrder();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Approval failed',
        variant: 'destructive',
      });
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setDeletingBatch(true);
    try {
      // Delete workflow steps
      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .delete()
        .eq('batch_id', batchToDelete.id);

      if (stepsError) throw stepsError;

      // Delete batch items
      const { error: itemsError } = await supabase
        .from('production_batch_items')
        .delete()
        .eq('batch_id', batchToDelete.id);

      if (itemsError) throw itemsError;

      // Delete batch
      const { error: batchError } = await supabase
        .from('production_batches')
        .delete()
        .eq('id', batchToDelete.id);

      if (batchError) throw batchError;

      // Log deletion
      await supabase.from('audit_log').insert({
        entity: 'production_batch',
        entity_id: batchToDelete.id,
        action: 'deleted',
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        before: { uid: batchToDelete.human_uid, qty: batchToDelete.qty_bottle_planned },
      });

      toast({
        title: 'Batch Deleted',
        description: `Batch ${batchToDelete.human_uid} has been deleted`,
      });

      await fetchBatches();
      await fetchBatchAllocations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Delete failed',
        variant: 'destructive',
      });
    } finally {
      setDeletingBatch(false);
      setDeleteBatchDialogOpen(false);
      setBatchToDelete(null);
    }
  };

  const createBatchesFromPlans = async (plans: Array<{ lineId: string; quantity: number; plannedStart?: Date }>) => {
    if (!order) return;

    try {
      for (const plan of plans) {
        // Get the SKU code for this line
        const orderLine = order.sales_order_lines.find(l => l.id === plan.lineId);
        if (!orderLine) throw new Error('Order line not found');

        // Generate batch number based on SKU code (e.g., GTB-2511-001)
        const { data: batchNumber, error: batchNumError } = await supabase
          .rpc('generate_batch_number', { sku_code: orderLine.sku.code });

        if (batchNumError) throw batchNumError;

        // Create batch
        const { data: batchData, error: batchError } = await supabase
          .from('production_batches')
          .insert({
            so_id: order.id,
            uid: batchNumber,
            human_uid: batchNumber,
            status: 'queued',
            qty_bottle_planned: plan.quantity,
            qty_bottle_good: 0,
            qty_bottle_scrap: 0,
            priority_index: 0,
            planned_start: plan.plannedStart ? plan.plannedStart.toISOString() : null,
          })
          .select()
          .single();

        if (batchError) throw batchError;

        // Create batch item linking to order line
        const { error: itemError } = await supabase
          .from('production_batch_items')
          .insert({
            batch_id: batchData.id,
            so_line_id: plan.lineId,
            bottle_qty_allocated: plan.quantity,
          });

        if (itemError) throw itemError;

        // Create workflow steps
        const workflowSteps = order.label_required ? [
          { step: 'produce' as const, batch_id: batchData.id, status: 'pending' as const },
          { step: 'bottle_cap' as const, batch_id: batchData.id, status: 'pending' as const },
          { step: 'label' as const, batch_id: batchData.id, status: 'pending' as const },
          { step: 'pack' as const, batch_id: batchData.id, status: 'pending' as const },
        ] : [
          { step: 'produce' as const, batch_id: batchData.id, status: 'pending' as const },
          { step: 'bottle_cap' as const, batch_id: batchData.id, status: 'pending' as const },
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
          after: { uid: batchNumber, qty: plan.quantity, line_id: plan.lineId },
        });
      }

      toast({
        title: 'Batches Created',
        description: `${plans.length} batch${plans.length !== 1 ? 'es' : ''} created successfully`,
      });

      // Refresh data
      await fetchBatches();
      await fetchBatchAllocations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Batch creation failed',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleScheduleBatch = async (date: Date) => {
    if (!selectedBatch) return;

    try {
      const { error } = await supabase
        .from('production_batches')
        .update({ planned_start: date.toISOString() })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      toast({
        title: 'Batch Scheduled',
        description: `Batch ${selectedBatch.human_uid} scheduled for ${date.toLocaleDateString()}`,
      });

      fetchBatches();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Scheduling failed',
        variant: 'destructive',
      });
    }
  };

  const handleSplitBatch = async (quantities: number[]) => {
    if (!selectedBatch || !order) return;

    try {
      // Get batch items to preserve SKU information
      const { data: batchItems, error: itemsError } = await supabase
        .from('production_batch_items')
        .select(`
          *,
          sales_order_lines!inner(
            sku:skus(code)
          )
        `)
        .eq('batch_id', selectedBatch.id);

      if (itemsError) throw itemsError;
      
      // Get the SKU code from the batch item
      const skuCode = (batchItems?.[0] as any)?.sales_order_lines?.sku?.code;
      if (!skuCode) throw new Error('Could not determine SKU for batch');

      // Delete old batch workflow steps
      await supabase
        .from('workflow_steps')
        .delete()
        .eq('batch_id', selectedBatch.id);

      // Delete old batch items
      await supabase
        .from('production_batch_items')
        .delete()
        .eq('batch_id', selectedBatch.id);

      // Delete old batch
      await supabase
        .from('production_batches')
        .delete()
        .eq('id', selectedBatch.id);

      // Create new batches with proper batch numbers
      for (let i = 0; i < quantities.length; i++) {
        // Generate batch number based on SKU
        const { data: batchNumber, error: batchNumError } = await supabase
          .rpc('generate_batch_number', { sku_code: skuCode });

        if (batchNumError) throw batchNumError;
        
        const { data: newBatch, error: batchError } = await supabase
          .from('production_batches')
          .insert({
            so_id: order.id,
            uid: batchNumber,
            human_uid: batchNumber,
            status: 'queued',
            qty_bottle_planned: quantities[i],
            qty_bottle_good: 0,
            qty_bottle_scrap: 0,
            priority_index: 0,
          })
          .select()
          .single();

        if (batchError) throw batchError;

        // Recreate batch items for new batch
        if (batchItems && batchItems.length > 0) {
          const { error: newItemError } = await supabase
            .from('production_batch_items')
            .insert({
              batch_id: newBatch.id,
              so_line_id: batchItems[0].so_line_id,
              bottle_qty_allocated: quantities[i],
            });

          if (newItemError) throw newItemError;
        }

        // Create workflow steps for new batch
        const workflowSteps = order.label_required ? [
          { step: 'produce' as const, batch_id: newBatch.id, status: 'pending' as const },
          { step: 'bottle_cap' as const, batch_id: newBatch.id, status: 'pending' as const },
          { step: 'label' as const, batch_id: newBatch.id, status: 'pending' as const },
          { step: 'pack' as const, batch_id: newBatch.id, status: 'pending' as const },
        ] : [
          { step: 'produce' as const, batch_id: newBatch.id, status: 'pending' as const },
          { step: 'bottle_cap' as const, batch_id: newBatch.id, status: 'pending' as const },
          { step: 'pack' as const, batch_id: newBatch.id, status: 'pending' as const },
        ];

        await supabase.from('workflow_steps').insert(workflowSteps);
      }

      toast({
        title: 'Batch Split',
        description: `Split into ${quantities.length} batches`,
      });

      fetchBatches();
      fetchBatchAllocations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Split failed',
        variant: 'destructive',
      });
    }
  };

  const handleMergeBatches = async (batchIds: string[]) => {
    if (!selectedBatch) return;

    try {
      // Calculate total quantity
      const batchesToMerge = batches.filter(b => batchIds.includes(b.id));
      const totalQty = batchesToMerge.reduce((sum, b) => sum + b.qty_bottle_planned, 0);

      // Update main batch quantity
      await supabase
        .from('production_batches')
        .update({ qty_bottle_planned: selectedBatch.qty_bottle_planned + totalQty })
        .eq('id', selectedBatch.id);

      // Delete workflow steps for merged batches
      for (const batchId of batchIds) {
        await supabase
          .from('workflow_steps')
          .delete()
          .eq('batch_id', batchId);
      }

      // Delete merged batches
      await supabase
        .from('production_batches')
        .delete()
        .in('id', batchIds);

      toast({
        title: 'Batches Merged',
        description: `Merged ${batchIds.length} batch(es) into ${selectedBatch.human_uid}`,
      });

      fetchBatches();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Merge failed',
        variant: 'destructive',
      });
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
      <div className="p-4 md:p-6">
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-mono truncate">{order.human_uid}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 truncate">
            {order.is_internal 
              ? `Internal Order - ${order.brand?.name || 'No Brand'}`
              : order.customer?.name || 'No Customer'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {userRole === 'admin' && order.status === 'awaiting_approval' && (
            <>
              <Button onClick={() => setApprovalDialogOpen(true)} className="bg-success hover:bg-success/90">
                Approve Order
              </Button>
              <Button variant="destructive" onClick={() => setRejectionDialogOpen(true)}>
                Reject Order
              </Button>
            </>
          )}
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
                onValueChange={initiateStatusChange}
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
                  <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="deposit_due">Deposit Due</SelectItem>
                  <SelectItem value="in_queue">In Queue</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
                  <SelectItem value="in_labeling">In Labeling</SelectItem>
                  <SelectItem value="awaiting_invoice">Awaiting Invoice</SelectItem>
                  <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                  <SelectItem value="in_packing">In Packing</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {/* Shipping Options - show when ready to ship */}
              {(order.status === 'ready_to_ship' || order.status === 'packed') && !order.is_internal && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default">
                      <Truck className="h-4 w-4 mr-2" />
                      Ship Order
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShipStationDialogOpen(true)}>
                      Create ShipStation Label
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setManualTrackingDialogOpen(true)}>
                      Add Tracking Manually
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
        {order.is_internal ? (
          <Card>
            <CardHeader>
              <CardTitle>Internal Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">Internal Production Run</p>
              </div>
              {order.brand && (
                <div>
                  <p className="text-sm text-muted-foreground">Brand</p>
                  <p className="font-medium">{order.brand.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Purpose</p>
                <p className="font-medium">Retail Stock</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <InlineNotes orderId={order.id} initialNotes={order.notes} onUpdate={fetchOrder} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Customer Information</CardTitle>
                {userRole === 'admin' && order.customer && (
                  <SendCustomSMS
                    orderId={order.id}
                    orderNumber={order.human_uid}
                    customerName={order.customer.name}
                    customerId={order.customer_id!}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.customer ? (
                <>
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No customer assigned</p>
              )}
            </CardContent>
          </Card>
        )}

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
            
            {/* Deposit Configuration - editable for admin on awaiting_approval orders */}
            {userRole === 'admin' && order.status === 'awaiting_approval' && (
              <>
                <Separator />
                <div className="space-y-3 py-2 px-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deposit-toggle" className="text-sm font-medium">Require Deposit</Label>
                    <input
                      id="deposit-toggle"
                      type="checkbox"
                      checked={order.deposit_required}
                      className="h-4 w-4 rounded border-gray-300"
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        try {
                          const depositAmount = newValue ? order.subtotal * 0.5 : 0;
                          const { error } = await supabase
                            .from('sales_orders')
                            .update({ 
                              deposit_required: newValue,
                              deposit_amount: depositAmount
                            })
                            .eq('id', id);
                          if (error) throw error;
                          fetchOrder();
                          toast({
                            title: 'Deposit Updated',
                            description: newValue ? 'Deposit requirement enabled' : 'Deposit requirement disabled',
                          });
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: error instanceof Error ? error.message : 'Failed to update deposit',
                            variant: 'destructive',
                          });
                        }
                      }}
                    />
                  </div>
                  {order.deposit_required && (
                    <div className="space-y-2">
                      <Label htmlFor="deposit-percent" className="text-sm text-muted-foreground">Deposit Percentage</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="deposit-percent"
                          type="number"
                          min="1"
                          max="100"
                          defaultValue={order.deposit_amount > 0 ? Math.round((order.deposit_amount / order.subtotal) * 100) : 50}
                          className="h-8 w-20"
                          onBlur={async (e) => {
                            const percent = parseInt(e.target.value) || 50;
                            const clampedPercent = Math.min(100, Math.max(1, percent));
                            const newDepositAmount = (order.subtotal * clampedPercent) / 100;
                            try {
                              const { error } = await supabase
                                .from('sales_orders')
                                .update({ deposit_amount: newDepositAmount })
                                .eq('id', id);
                              if (error) throw error;
                              fetchOrder();
                              toast({
                                title: 'Deposit Amount Updated',
                                description: `Deposit set to ${clampedPercent}% ($${newDepositAmount.toFixed(2)})`,
                              });
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Failed to update deposit',
                                variant: 'destructive',
                              });
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <span className="text-sm font-medium ml-auto">${order.deposit_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* Display deposit info for non-awaiting_approval orders */}
            {order.deposit_required && order.status !== 'awaiting_approval' && (
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
            
            {/* Also show deposit in awaiting_approval if set */}
            {order.deposit_required && order.status === 'awaiting_approval' && userRole !== 'admin' && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Deposit</span>
                  <div className="text-right">
                    <div className="font-medium">${order.deposit_amount.toFixed(2)}</div>
                  </div>
                </div>
              </>
            )}
            
            <Separator />
            <div className="flex justify-between text-lg font-bold pt-2">
              <span>Order Total</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            {(order.status === 'quoted' || order.status === 'draft') && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Quote Expiration</span>
                  </div>
                  
                  <QuoteCountdown 
                    expiresAt={order.quote_expires_at}
                    createdAt={order.created_at}
                    expirationDays={order.quote_expiration_days}
                  />
                  
                  {userRole === 'admin' && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          placeholder="Days"
                          defaultValue={order.quote_expiration_days || ''}
                          className="h-8"
                          onBlur={async (e) => {
                            const days = e.target.value ? parseInt(e.target.value) : null;
                            try {
                              const { error } = await supabase
                                .from('sales_orders')
                                .update({ quote_expiration_days: days } as any)
                                .eq('id', order.id);
                              
                              if (error) throw error;
                              
                              toast({
                                title: 'Updated',
                                description: 'Quote expiration days updated',
                              });
                              
                              fetchOrder();
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Update failed',
                                variant: 'destructive',
                              });
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
                      </div>
                      {order.quote_expires_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.functions.invoke('renew-quote', {
                                body: { orderId: order.id }
                              });

                              if (error) throw error;

                              toast({
                                title: 'Quote Renewed',
                                description: 'Quote expiration extended and customer notified',
                              });

                              fetchOrder();
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Renewal failed',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          Renew & Notify Customer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consolidated Order Summary - Show in fulfillment phase for parent orders with add-ons */}
      {order && !order.is_internal && shouldShowConsolidatedView(order.status) && (
        <ConsolidatedOrderSummary
          orderId={order.id}
          orderUid={order.human_uid}
          orderStatus={order.status}
          orderSubtotal={order.subtotal}
          parentLineItems={order.sales_order_lines}
        />
      )}

      {/* Packing Details - Show when order is in packing or later (including shipped for edits) */}
      {userRole === 'admin' && order && ['in_packing', 'packed', 'ready_to_ship', 'awaiting_invoice', 'awaiting_payment', 'shipped'].includes(order.status) && (
        <PackingDetails
          orderId={order.id}
          totalItems={totalBottles}
          parentLineItems={order.sales_order_lines}
          orderSubtotal={order.subtotal}
        />
      )}

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

      {/* Order Add-Ons */}
      {order && !order.is_internal && (
        <OrderAddOnsList
          key={addOnsKey}
          orderId={order.id}
          orderStatus={order.status}
          isAdmin={userRole === 'admin'}
          onCreateAddOn={() => {
            setAddOnIsOverride(false);
            setAddOnOverrideNote('');
            setAddOnCreatorOpen(true);
          }}
          onOverrideAddOn={() => setAddOnOverrideDialogOpen(true)}
        />
      )}

      {/* Consolidated Line Items - Show in fulfillment phase for parent orders with add-ons */}
      {order && !order.is_internal && shouldShowConsolidatedView(order.status) && (
        <ConsolidatedLineItems
          orderId={order.id}
          orderUid={order.human_uid}
          orderStatus={order.status}
          parentLineItems={order.sales_order_lines}
        />
      )}

      {/* Invoice Management */}
      {order && userRole === 'admin' && order.status !== 'draft' && order.status !== 'cancelled' && (
        <InvoiceManagement
          orderId={order.id}
          orderTotal={order.subtotal}
          consolidatedTotalStored={order.consolidated_total ?? null}
          orderUid={order.human_uid}
          depositAmount={order.deposit_amount || 0}
          depositRequired={order.deposit_required}
          customerEmail={order.customer?.email || null}
          orderStatus={order.status}
          onStatusChange={fetchOrder}
        />
      )}

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
              {userRole === 'admin' && remainingBottles > 0 && 
               order.status !== 'draft' && order.status !== 'quoted' && (
                <Button onClick={async () => {
                  await fetchBatchAllocations();
                  setBatchPlannerOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Plan Batches
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
                    <div className="flex-1">
                      <div className="font-mono font-medium">{batch.human_uid}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Created {new Date(batch.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge className={statusColors[batch.status] || 'bg-muted'}>
                          {formatStatus(batch.status)}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">
                          {batch.qty_bottle_good} / {batch.qty_bottle_planned} bottles
                        </div>
                      </div>
                      {userRole === 'admin' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedBatch(batch);
                              handlePrint();
                            }}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print Label
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBatch(batch);
                              setSchedulerOpen(true);
                            }}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              Schedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setSelectedBatch(batch);
                              setSplitMergeOpen(true);
                            }}>
                              <Split className="mr-2 h-4 w-4" />
                              Split/Merge
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setBatchToDelete(batch);
                                setDeleteBatchDialogOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Batch
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => setQuotePreviewOpen(true)}
              disabled={!order}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview & Send Quote
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Production Photos */}
      {order && (
        <Card>
          <CardHeader>
            <CardTitle>Production Photos</CardTitle>
            <CardDescription>Upload and view production photos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {userRole === 'admin' && (
              <ProductionPhotoUpload 
                orderId={order.id}
                onUploadComplete={() => {
                  // Trigger refresh of gallery
                  window.location.reload();
                }}
              />
            )}
            <ProductionPhotosGallery orderId={order.id} />
          </CardContent>
        </Card>
      )}

      {/* Packing Details section moved up - now shown inline after order summary */}

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

      {/* Delete Batch Confirmation */}
      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete batch <span className="font-mono font-semibold">{batchToDelete?.human_uid}</span> and all associated workflow steps. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBatch}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              disabled={deletingBatch}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingBatch ? 'Deleting...' : 'Delete Batch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Planner */}
      {order && (
        <BatchPlanner
          open={batchPlannerOpen}
          onOpenChange={setBatchPlannerOpen}
          orderLines={order.sales_order_lines}
          existingAllocations={batchAllocations}
          onCreateBatches={createBatchesFromPlans}
        />
      )}

      {/* Hidden label for printing */}
      <div className="hidden">
        {selectedBatch && order && (
          <BatchLabel
            ref={labelRef}
            batchUid={selectedBatch.uid}
            humanUid={selectedBatch.human_uid}
            orderUid={order.human_uid}
            customerName={order.is_internal 
              ? `Internal - ${order.brand?.name || 'No Brand'}` 
              : order.customer?.name || 'No Customer'}
            quantity={selectedBatch.qty_bottle_planned}
            createdDate={selectedBatch.created_at}
          />
        )}
      </div>

      {/* Batch Scheduler */}
      {selectedBatch && (
        <BatchScheduler
          open={schedulerOpen}
          onOpenChange={setSchedulerOpen}
          onSchedule={handleScheduleBatch}
          currentDate={null}
          batchUid={selectedBatch.human_uid}
        />
      )}

      {/* Order Approval Dialog */}
      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve order {order?.human_uid}? The customer will be notified via email.
              {order?.deposit_required && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  This order requires a deposit of ${order.deposit_amount?.toFixed(2)}. The order status will be set to "Deposit Due".
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingApproval}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleApproval(true)}
              disabled={processingApproval}
              className="bg-success hover:bg-success/90"
            >
              {processingApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting order {order?.human_uid}. The customer will be notified via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Product unavailable, pricing needs revision..."
                disabled={processingApproval}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)} disabled={processingApproval}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleApproval(false)}
              disabled={processingApproval || !rejectionReason.trim()}
            >
              {processingApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Split/Merge */}
      {selectedBatch && (
        <BatchSplitMerge
          open={splitMergeOpen}
          onOpenChange={setSplitMergeOpen}
          currentBatch={selectedBatch}
          availableBatches={batches.filter(b => b.id !== selectedBatch.id && b.status === 'queued')}
          onSplit={handleSplitBatch}
          onMerge={handleMergeBatches}
        />
      )}

      {/* Quote Preview Dialog */}
      {order && (
        <QuotePreview
          open={quotePreviewOpen}
          onOpenChange={setQuotePreviewOpen}
          order={order}
          sending={updatingStatus}
          onSend={async () => {
            try {
              setUpdatingStatus(true);
              const { error } = await supabase.functions.invoke('generate-quote', {
                body: { orderId: id }
              });
              
              if (error) throw error;
              
              toast({
                title: "Quote Sent",
                description: "Quote has been generated and sent via email",
              });
              setQuotePreviewOpen(false);
              fetchOrder();
            } catch (error) {
              toast({
                title: "Error",
                description: error instanceof Error ? `Failed to generate quote: ${error.message}` : "Failed to generate quote",
                variant: "destructive",
              });
            } finally {
              setUpdatingStatus(false);
            }
          }}
        />
      )}

      {/* Status Change Dialog with Validation */}
      {order && pendingStatusChange && (
        <StatusChangeDialog
          open={statusChangeDialogOpen}
          onOpenChange={setStatusChangeDialogOpen}
          orderId={order.id}
          currentStatus={order.status as Database["public"]["Enums"]["order_status"]}
          newStatus={pendingStatusChange}
          onConfirm={async (overrideNote) => {
            await handleStatusChange(pendingStatusChange, overrideNote);
            setPendingStatusChange(null);
          }}
        />
      )}

      {/* ShipStation Label Dialog */}
      {order && (
        <ShipStationLabelDialog
          open={shipStationDialogOpen}
          onOpenChange={setShipStationDialogOpen}
          orderId={order.id}
          orderNumber={order.human_uid}
          onSuccess={fetchOrder}
        />
      )}

      {/* Manual Tracking Dialog */}
      {order && (
        <ManualTrackingDialog
          open={manualTrackingDialogOpen}
          onOpenChange={setManualTrackingDialogOpen}
          orderId={order.id}
          orderNumber={order.human_uid}
          onSuccess={fetchOrder}
        />
      )}

      {/* Add-On Creator Dialog */}
      {order && !order.is_internal && (
        <AddOnCreator
          open={addOnCreatorOpen}
          onOpenChange={(open) => {
            setAddOnCreatorOpen(open);
            if (!open) {
              setAddOnIsOverride(false);
              setAddOnOverrideNote('');
            }
          }}
          parentOrderId={order.id}
          parentOrderNumber={order.human_uid}
          parentOrderTotal={order.subtotal}
          parentOrderStatus={order.status}
          customerId={order.customer_id}
          brandId={order.brand_id}
          isOverride={addOnIsOverride}
          overrideNote={addOnOverrideNote}
          onSuccess={() => {
            setAddOnsKey(prev => prev + 1);
            setAddOnIsOverride(false);
            setAddOnOverrideNote('');
            fetchOrder();
          }}
        />
      )}

      {/* Add-On Override Confirmation Dialog */}
      {order && !order.is_internal && (
        <AddOnOverrideDialog
          open={addOnOverrideDialogOpen}
          onOpenChange={setAddOnOverrideDialogOpen}
          orderStatus={order.status}
          onConfirm={(justification) => {
            setAddOnOverrideNote(justification);
            setAddOnIsOverride(true);
            setAddOnOverrideDialogOpen(false);
            setAddOnCreatorOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default OrderDetail;