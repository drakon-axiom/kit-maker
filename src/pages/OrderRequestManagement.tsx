import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OrderRequest {
  id: string;
  so_id: string;
  comment: string;
  comment_type: string;
  request_status: string;
  created_at: string;
  user_id: string;
  admin_response: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  sales_orders: {
    human_uid: string;
    status: string;
    customer: {
      name: string;
      email: string;
    };
  };
}

export default function OrderRequestManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<OrderRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'pending' ? 'pending' : ['approved', 'rejected'];
      
      const { data, error } = await supabase
        .from('order_comments')
        .select(`
          *,
          sales_orders (
            human_uid,
            status,
            customer:customers (
              name,
              email
            )
          )
        `)
        .in('comment_type', ['cancellation_request', 'modification_request'])
        .in('request_status', Array.isArray(status) ? status : [status])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      toast.error('Failed to load requests');
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = (request: OrderRequest) => {
    setSelectedRequest(request);
    setAdminResponse('');
    setDialogOpen(true);
  };

  const processRequest = async (action: 'approved' | 'rejected') => {
    if (!selectedRequest || !user) return;

    setProcessing(true);
    try {
      // Update the request
      const { error: updateError } = await supabase
        .from('order_comments')
        .update({
          request_status: action,
          admin_response: adminResponse || null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // If cancellation approved, update order status
      if (selectedRequest.comment_type === 'cancellation_request' && action === 'approved') {
        const { error: statusError } = await supabase
          .from('sales_orders')
          .update({ status: 'cancelled' })
          .eq('id', selectedRequest.so_id);

        if (statusError) throw statusError;
      }

      toast.success(`Request ${action} successfully`);
      setDialogOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(`Failed to ${action} request`);
      // Error handled silently
    } finally {
      setProcessing(false);
    }
  };

  const getRequestTypeBadge = (type: string) => {
    return type === 'cancellation_request' ? (
      <Badge variant="destructive">Cancellation</Badge>
    ) : (
      <Badge variant="default">Modification</Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status as keyof typeof variants] as any}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Requests</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer cancellation and modification requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'resolved')}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {requests.filter(r => r.request_status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {requests.filter(r => r.request_status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending requests</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        Order {request.sales_orders.human_uid}
                        {getRequestTypeBadge(request.comment_type)}
                      </CardTitle>
                      <CardDescription>
                        {request.sales_orders.customer.name} ({request.sales_orders.customer.email})
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Request Details:</p>
                    <p className="text-sm text-muted-foreground">{request.comment}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRequestAction(request)}
                      variant="outline"
                      size="sm"
                    >
                      Review Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No resolved requests</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        Order {request.sales_orders.human_uid}
                        {getRequestTypeBadge(request.comment_type)}
                        {getStatusBadge(request.request_status)}
                      </CardTitle>
                      <CardDescription>
                        {request.sales_orders.customer.name} ({request.sales_orders.customer.email})
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Resolved {formatDistanceToNow(new Date(request.resolved_at || request.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Request Details:</p>
                    <p className="text-sm text-muted-foreground">{request.comment}</p>
                  </div>
                  {request.admin_response && (
                    <div>
                      <p className="text-sm font-medium mb-1">Admin Response:</p>
                      <p className="text-sm text-muted-foreground">{request.admin_response}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              {selectedRequest?.comment_type === 'cancellation_request'
                ? 'Approve or reject this cancellation request'
                : 'Approve or reject this modification request'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Order:</p>
              <p className="text-sm text-muted-foreground">
                {selectedRequest?.sales_orders.human_uid} - {selectedRequest?.sales_orders.customer.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Request:</p>
              <p className="text-sm text-muted-foreground">{selectedRequest?.comment}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Admin Response (optional):</p>
              <Textarea
                placeholder="Add a note or explanation..."
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => processRequest('rejected')}
              disabled={processing}
            >
              {processing && <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button
              onClick={() => processRequest('approved')}
              disabled={processing}
            >
              {processing && <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
