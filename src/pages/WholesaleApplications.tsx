import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, XCircle, Clock, Archive } from 'lucide-react';
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

interface ArchivedApplication extends Application {
  archived_at: string;
}

const WholesaleApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [archivedApplications, setArchivedApplications] = useState<ArchivedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archivingSelected, setArchivingSelected] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (activeTab === 'archived' && archivedApplications.length === 0) {
      fetchArchivedApplications();
    }
  }, [activeTab]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('wholesale_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedApplications = async () => {
    setArchivedLoading(true);
    try {
      const { data, error } = await supabase
        .from('wholesale_applications_archive')
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) throw error;
      setArchivedApplications(data || []);
    } catch (error) {
      toast.error('Failed to load archived applications');
    } finally {
      setArchivedLoading(false);
    }
  };

  const handleAction = async (appId: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // If approved, create the account first; only then mark the application as approved.
      // This prevents "approved" applications that have no associated account.
      if (newStatus === 'approved') {
        const { error: functionError } = await supabase.functions.invoke('approve-wholesale-application', {
          body: {
            applicationId: appId,
            reviewNotes: reviewNotes || undefined,
            siteUrl: window.location.origin,
          },
        });

        if (functionError) {
          toast.error(`Account creation failed: ${functionError.message ?? 'Unknown error'}`);
          return;
        }
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

      if (newStatus === 'approved') {
        toast.success(`Application approved! Login credentials sent to ${applications.find(a => a.id === appId)?.email}`);
      } else {
        toast.success('Application rejected');
      }

      setSelectedApp(null);
      setReviewNotes('');
      fetchApplications();
      // Refresh archived list if we're viewing it
      if (activeTab === 'archived') {
        fetchArchivedApplications();
      }
    } catch (error) {
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

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const processedApplications = applications.filter(a => a.status === 'approved' || a.status === 'rejected');

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (apps: Application[]) => {
    const allSelected = apps.every(app => selectedIds.has(app.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        apps.forEach(app => next.delete(app.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        apps.forEach(app => next.add(app.id));
        return next;
      });
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedIds.size === 0) return;
    
    setArchivingSelected(true);
    try {
      const toArchive = applications.filter(app => selectedIds.has(app.id));
      
      // Insert into archive table
      const archiveData = toArchive.map(app => ({
        id: app.id,
        company_name: app.company_name,
        contact_name: app.contact_name,
        email: app.email,
        phone: app.phone,
        business_type: app.business_type,
        website: app.website,
        message: app.message,
        status: app.status,
        created_at: app.created_at,
        reviewed_at: app.reviewed_at,
        reviewed_by: null,
        notes: app.notes,
        shipping_address_line1: app.shipping_address_line1,
        shipping_address_line2: app.shipping_address_line2,
        shipping_city: app.shipping_city,
        shipping_state: app.shipping_state,
        shipping_zip: app.shipping_zip,
        shipping_country: app.shipping_country,
        billing_address_line1: app.billing_address_line1,
        billing_address_line2: app.billing_address_line2,
        billing_city: app.billing_city,
        billing_state: app.billing_state,
        billing_zip: app.billing_zip,
        billing_country: app.billing_country,
        billing_same_as_shipping: app.billing_same_as_shipping,
      }));

      const { error: archiveError } = await supabase
        .from('wholesale_applications_archive')
        .insert(archiveData);

      if (archiveError) throw archiveError;

      // Delete from active table
      const { error: deleteError } = await supabase
        .from('wholesale_applications')
        .delete()
        .in('id', Array.from(selectedIds));

      if (deleteError) throw deleteError;

      toast.success(`${selectedIds.size} application(s) archived successfully`);
      setSelectedIds(new Set());
      fetchApplications();
      // Refresh archived if viewing
      if (activeTab === 'archived') {
        fetchArchivedApplications();
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive selected applications');
    } finally {
      setArchivingSelected(false);
    }
  };

  const renderApplicationCard = (app: Application | ArchivedApplication, isArchived = false, showCheckbox = false) => (
    <Card key={app.id} className={selectedIds.has(app.id) ? 'ring-2 ring-primary' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {showCheckbox && (
              <Checkbox
                checked={selectedIds.has(app.id)}
                onCheckedChange={() => toggleSelection(app.id)}
                className="mt-1"
              />
            )}
            <div className="space-y-1">
              <CardTitle>{app.company_name}</CardTitle>
              <CardDescription>
                {app.contact_name} • {app.email}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isArchived && (
              <Badge variant="outline" className="gap-1">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
            {getStatusBadge(app.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-sm">
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
          {isArchived && 'archived_at' in app && (
            <div>
              <span className="font-medium">Archived:</span> {format(new Date(app.archived_at), 'MMM d, yyyy')}
            </div>
          )}
          {app.reviewed_at && (
            <div>
              <span className="font-medium">Reviewed:</span> {format(new Date(app.reviewed_at), 'MMM d, yyyy')}
            </div>
          )}
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

        {!isArchived && app.status === 'pending' && (
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
  );

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
      <div className="container mx-auto p-4 md:py-8 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Wholesale Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage wholesale account applications</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              All Active
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              Archived
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="grid gap-3 md:gap-4">
              {applications.filter(a => a.status === 'pending').length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pending applications
                  </CardContent>
                </Card>
              ) : (
                applications
                  .filter(a => a.status === 'pending')
                  .map((app) => renderApplicationCard(app))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-4 space-y-4">
            {processedApplications.length > 0 && (
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={processedApplications.length > 0 && processedApplications.every(app => selectedIds.has(app.id))}
                    onCheckedChange={() => toggleSelectAll(processedApplications)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select approved/rejected to archive'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleArchiveSelected}
                  disabled={selectedIds.size === 0 || archivingSelected}
                  className="gap-2"
                >
                  {archivingSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  Archive Selected
                </Button>
              </div>
            )}
            <div className="grid gap-3 md:gap-4">
              {applications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No applications yet
                  </CardContent>
                </Card>
              ) : (
                applications.map((app) => renderApplicationCard(app, false, app.status !== 'pending'))
              )}
            </div>
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            {archivedLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {archivedApplications.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No archived applications yet
                    </CardContent>
                </Card>
                ) : (
                  archivedApplications.map((app) => renderApplicationCard(app, true))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default WholesaleApplications;
