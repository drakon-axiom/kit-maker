import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, Clock, Trash2, MessageSquare } from 'lucide-react';

interface OrderRequest {
  id: string;
  comment: string;
  comment_type: string;
  request_status: string;
  created_at: string;
  admin_response: string | null;
  resolved_at: string | null;
  user_id: string;
}

interface OrderRequestHistoryProps {
  orderId: string;
  onRequestChange?: () => void;
}

export default function OrderRequestHistory({ orderId, onRequestChange }: OrderRequestHistoryProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [orderId]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('order_comments')
        .select('*')
        .eq('so_id', orderId)
        .in('comment_type', ['cancellation_request', 'modification_request'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Failed to load request history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setDeletingId(requestId);
    try {
      const { error } = await supabase
        .from('order_comments')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request cancelled successfully');
      await fetchRequests();
      onRequestChange?.();
    } catch (error: any) {
      toast.error('Failed to cancel request');
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const getRequestIcon = (type: string, status: string) => {
    if (status === 'approved') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'rejected') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
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
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Request History
        </CardTitle>
        <CardDescription>
          Track your modification and cancellation requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getRequestIcon(request.comment_type, request.request_status)}
                  {getRequestTypeBadge(request.comment_type)}
                  {getStatusBadge(request.request_status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </span>
                  {request.request_status === 'pending' && request.user_id === user?.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === request.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel this request? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>No, keep it</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelRequest(request.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, cancel request
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Request Details:</p>
                <p className="text-sm text-muted-foreground">{request.comment}</p>
              </div>

              {request.request_status !== 'pending' && request.resolved_at && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">
                    {request.request_status === 'approved' ? 'Approved' : 'Rejected'}{' '}
                    {formatDistanceToNow(new Date(request.resolved_at), { addSuffix: true })}
                  </p>
                  {request.admin_response && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Response:</span> {request.admin_response}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
