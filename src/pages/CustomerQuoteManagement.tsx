import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInHours, differenceInDays, formatDistanceToNow } from 'date-fns';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';

interface Quote {
  id: string;
  human_uid: string;
  status: string;
  subtotal: number;
  quote_expires_at: string | null;
  created_at: string;
  deposit_required: boolean;
  deposit_amount: number | null;
}

export default function CustomerQuoteManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  const fetchQuotes = useCallback(async () => {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customerData) return;

      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, human_uid, status, subtotal, quote_expires_at, created_at, deposit_required, deposit_amount')
        .eq('customer_id', customerData.id)
        .in('status', ['quoted', 'awaiting_approval'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      // Error handled silently
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchQuotes();
    }
  }, [user, fetchQuotes]);

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    if (expiryDate < now) {
      return { expired: true, text: 'Expired', color: 'text-red-600' };
    }
    
    const hours = differenceInHours(expiryDate, now);
    const days = differenceInDays(expiryDate, now);
    
    if (days > 2) {
      return { 
        expired: false, 
        text: `${days} days remaining`, 
        color: 'text-green-600' 
      };
    } else if (hours > 24) {
      return { 
        expired: false, 
        text: `${Math.floor(hours / 24)} days remaining`, 
        color: 'text-yellow-600' 
      };
    } else if (hours > 0) {
      return { 
        expired: false, 
        text: `${hours} hours remaining`, 
        color: 'text-orange-600' 
      };
    } else {
      return { 
        expired: false, 
        text: 'Less than 1 hour', 
        color: 'text-red-600' 
      };
    }
  };

  const handleQuoteAction = async () => {
    if (!selectedQuote || !actionType) return;

    setActionLoading(true);
    try {
      // Record quote action
      await supabase.from('quote_actions').insert({
        so_id: selectedQuote.id,
        action: actionType === 'accept' ? 'accepted' : 'rejected',
        action_by: user!.id,
        notes: notes || null,
      });

      // Update order status
      const newStatus = actionType === 'accept' 
        ? (selectedQuote.deposit_required ? 'deposit_due' : 'in_queue')
        : 'cancelled';

      await supabase
        .from('sales_orders')
        .update({ status: newStatus })
        .eq('id', selectedQuote.id);

      toast.success(
        actionType === 'accept' 
          ? 'Quote accepted successfully!' 
          : 'Quote rejected'
      );

      // Refresh quotes
      await fetchQuotes();
      
      // Close dialog
      setSelectedQuote(null);
      setActionType(null);
      setNotes('');
    } catch (error) {
      // Error handled silently
      toast.error('Failed to process quote action');
    } finally {
      setActionLoading(false);
    }
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
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/customer">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Quotes</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">Quote Management</h1>
        <p className="text-muted-foreground mt-1">
          Review and respond to your pending quotes
        </p>
      </div>

        {quotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending quotes</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any quotes awaiting your response
              </p>
              <Button onClick={() => navigate('/customer')}>
                Back to Orders
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pending Quotes</CardTitle>
              <CardDescription>
                Review details and accept or reject quotes before they expire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => {
                    const timeInfo = getTimeRemaining(quote.quote_expires_at);
                    return (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.human_uid}</TableCell>
                        <TableCell>${quote.subtotal.toFixed(2)}</TableCell>
                        <TableCell>
                          {quote.deposit_required ? (
                            <span className="text-sm">
                              ${(quote.deposit_amount || 0).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {timeInfo ? (
                            <span className={`text-sm font-medium ${timeInfo.color}`}>
                              {timeInfo.expired ? '❌ ' : '⏰ '}
                              {timeInfo.text}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No expiration</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700">
                            {quote.status === 'quoted' ? 'Awaiting Response' : 'Under Review'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/customer/orders/${quote.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            {quote.status === 'quoted' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setSelectedQuote(quote);
                                    setActionType('accept');
                                  }}
                                  disabled={timeInfo?.expired}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedQuote(quote);
                                    setActionType('reject');
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Action Confirmation Dialog */}
        <Dialog open={!!selectedQuote && !!actionType} onOpenChange={(open) => {
          if (!open) {
            setSelectedQuote(null);
            setActionType(null);
            setNotes('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'accept' ? 'Accept Quote' : 'Reject Quote'}
              </DialogTitle>
              <DialogDescription>
                {actionType === 'accept' 
                  ? `You are about to accept quote ${selectedQuote?.human_uid}. ${selectedQuote?.deposit_required ? 'You will be able to pay the deposit after accepting.' : 'The order will move to production queue.'}`
                  : `You are about to reject quote ${selectedQuote?.human_uid}. This action cannot be undone.`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder={actionType === 'accept' ? 'Any additional instructions...' : 'Reason for rejection...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedQuote(null);
                  setActionType(null);
                  setNotes('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === 'accept' ? 'default' : 'destructive'}
                onClick={handleQuoteAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === 'accept' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Quote
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Quote
                      </>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
