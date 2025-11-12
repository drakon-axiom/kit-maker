import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '@/components/Layout';

interface Application {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  business_type: string | null;
  website: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  notes: string | null;
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
}

const WholesaleApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('wholesale_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (appId: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const application = applications.find(app => app.id === appId);
      
      if (!application) {
        toast.error('Application not found');
        return;
      }

      // Update application status
      const { error: updateError } = await supabase
        .from('wholesale_applications')
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          notes: reviewNotes || null,
        })
        .eq('id', appId);

      if (updateError) throw updateError;

      // If approved, create customer record
      if (newStatus === 'approved') {
        const { error: customerError } = await supabase
          .from('customers')
          .insert([{
            name: application.company_name,
            email: application.email,
            phone: application.phone,
            default_terms: 'Net 30',
            shipping_address_line1: application.shipping_address_line1,
            shipping_address_line2: application.shipping_address_line2,
            shipping_city: application.shipping_city,
            shipping_state: application.shipping_state,
            shipping_zip: application.shipping_zip,
            shipping_country: application.shipping_country,
            billing_address_line1: application.billing_address_line1,
            billing_address_line2: application.billing_address_line2,
            billing_city: application.billing_city,
            billing_state: application.billing_state,
            billing_zip: application.billing_zip,
            billing_country: application.billing_country,
            billing_same_as_shipping: application.billing_same_as_shipping,
          }]);

        if (customerError) {
          console.error('Error creating customer:', customerError);
          toast.error('Application approved but failed to create customer record');
          return;
        }
        
        toast.success('Application approved and customer created successfully!');
      } else {
        toast.success('Application rejected');
      }

      setSelectedApp(null);
      setReviewNotes('');
      fetchApplications();
    } catch (error: any) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Wholesale Applications</h1>
          <p className="text-muted-foreground">Review and manage wholesale account applications</p>
        </div>

        <div className="grid gap-4">
          {applications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No applications yet
              </CardContent>
            </Card>
          ) : (
            applications.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{app.company_name}</CardTitle>
                      <CardDescription>
                        {app.contact_name} • {app.email}
                      </CardDescription>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {app.phone && (
                      <div>
                        <span className="font-medium">Phone:</span> {app.phone}
                      </div>
                    )}
                    {app.business_type && (
                      <div>
                        <span className="font-medium">Business:</span> {app.business_type}
                      </div>
                    )}
                    {app.website && (
                      <div>
                        <span className="font-medium">Website:</span>{' '}
                        <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Link
                        </a>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Applied:</span> {format(new Date(app.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>

                  {app.message && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm">{app.message}</p>
                    </div>
                  )}

                  {app.notes && (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium mb-1">Admin Notes:</p>
                      <p className="text-sm">{app.notes}</p>
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="space-y-3 pt-2">
                      {selectedApp?.id === app.id && (
                        <div className="space-y-2">
                          <Label>Review Notes (Optional)</Label>
                          <Textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add any notes about this application..."
                            rows={3}
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            handleAction(app.id, 'approved');
                          }}
                          disabled={actionLoading}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          {actionLoading && selectedApp?.id === app.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedApp(app);
                            handleAction(app.id, 'rejected');
                          }}
                          disabled={actionLoading}
                        >
                          {actionLoading && selectedApp?.id === app.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WholesaleApplications;
