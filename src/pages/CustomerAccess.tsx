import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerAccessManager } from '@/components/CustomerAccessManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AccessRequest {
  id: string;
  customer_id: string;
  requested_at: string;
  status: string;
  admin_notes: string | null;
  customers: {
    name: string;
    email: string;
  };
}

export default function CustomerAccess() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/');
      return;
    }
    fetchAccessRequests();
  }, [userRole, navigate]);

  const fetchAccessRequests = async () => {
    try {
      // Fetch access requests with customer data
      const { data: requestsData, error: requestsError } = await supabase
        .from('customer_access_requests')
        .select(`
          id,
          customer_id,
          requested_at,
          status,
          admin_notes,
          customers (
            name,
            email,
            user_id
          )
        `)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch users with admin or operator roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'operator']);

      if (rolesError) throw rolesError;

      // Filter out requests from customers who have admin or operator roles
      const internalUserIds = new Set(rolesData?.map(r => r.user_id) || []);
      const filteredRequests = (requestsData || []).filter(
        req => !req.customers?.user_id || !internalUserIds.has(req.customers.user_id)
      );

      setRequests(filteredRequests);
    } catch (error) {
      // Error handled silently
      toast.error('Failed to load access requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, customerId: string) => {
    try {
      const { error } = await supabase
        .from('customer_access_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request approved');
      setSelectedCustomerId(customerId);
      fetchAccessRequests();
    } catch (error) {
      // Error handled silently
      toast.error('Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('customer_access_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request rejected');
      fetchAccessRequests();
    } catch (error) {
      // Error handled silently
      toast.error('Failed to reject request');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-destructive';
      default:
        return 'bg-yellow-500';
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Customer Access Management</h1>
          <p className="text-muted-foreground">Manage customer product and category access</p>
        </div>
      </div>

      <Tabs defaultValue="assign" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assign">Assign Access</TabsTrigger>
          <TabsTrigger value="requests">
            Access Requests
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <Badge className="ml-2 bg-yellow-500">
                {requests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assign" className="space-y-6">
          <CustomerAccessManager initialCustomerId={selectedCustomerId || undefined} />
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Requests</CardTitle>
              <CardDescription>Review and approve customer access requests</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No access requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium">{request.customers.name}</p>
                          <p className="text-sm text-muted-foreground">{request.customers.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested: {new Date(request.requested_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(request.id, request.customer_id)}
                            >
                              Approve & Assign
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
