import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Calendar, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface EmailLogData {
  recipient?: string;
  subject?: string;
  template_type?: string;
  status?: string;
  order_number?: string;
  error?: string;
}

interface EmailLog {
  id: string;
  created_at: string;
  action: string;
  after: EmailLogData;
}

const EmailHistory = () => {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientFilter, setRecipientFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const { toast } = useToast();

  const fetchEmails = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('entity', 'email')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date filters
      if (dateFromFilter) {
        query = query.gte('created_at', new Date(dateFromFilter).toISOString());
      }
      if (dateToFilter) {
        const endDate = new Date(dateToFilter);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Type cast and filter the data
      let filtered = (data || []).map(item => ({
        ...item,
        after: (item.after || {}) as EmailLogData
      })) as EmailLog[];

      // Apply recipient filter
      if (recipientFilter) {
        filtered = filtered.filter(email => 
          email.after?.recipient?.toLowerCase().includes(recipientFilter.toLowerCase())
        );
      }

      // Apply template type filter
      if (templateFilter !== 'all') {
        filtered = filtered.filter(email => 
          email.after?.template_type === templateFilter
        );
      }

      setEmails(filtered);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleClearFilters = () => {
    setRecipientFilter('');
    setTemplateFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('approval')) {
      return <Badge className="bg-green-500">Approval</Badge>;
    }
    if (action.includes('rejection')) {
      return <Badge className="bg-red-500">Rejection</Badge>;
    }
    if (action.includes('failed')) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">{action.replace(/_/g, ' ')}</Badge>;
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    if (status === 'sent') {
      return <Badge className="bg-blue-500">Sent</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
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
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Mail className="h-8 w-8" />
          Email History
        </h1>
        <p className="text-muted-foreground">
          View all sent emails and delivery status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter emails by recipient, template type, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Email</Label>
              <Input
                id="recipient"
                placeholder="Search by email..."
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template Type</Label>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger id="template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  <SelectItem value="order_approval">Order Approval</SelectItem>
                  <SelectItem value="order_rejection">Order Rejection</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="quote_renewal">Quote Renewal</SelectItem>
                  <SelectItem value="order_status">Order Status</SelectItem>
                  <SelectItem value="shipment">Shipment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchEmails}>
              <Search className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Log ({emails.length} emails)</CardTitle>
          <CardDescription>Most recent 100 emails matching your filters</CardDescription>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails found matching your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(email.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(email.action)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {email.after?.recipient || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {email.after?.subject || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {email.after?.template_type?.replace(/_/g, ' ') || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {email.after?.order_number || '-'}
                      </TableCell>
                      <TableCell>
                        {email.after?.error ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="destructive">Failed</Badge>
                            <span className="text-xs text-muted-foreground max-w-xs truncate">
                              {email.after.error}
                            </span>
                          </div>
                        ) : (
                          getStatusBadge(email.after?.status)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailHistory;
