import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';

interface ExpiringQuote {
  id: string;
  human_uid: string;
  quote_expires_at: string;
  customer: {
    name: string;
    email: string;
  };
  subtotal: number;
  quote_expiration_days: number | null;
}

const ExpiringQuotesWidget = () => {
  const [quotes, setQuotes] = useState<ExpiringQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [renewingAll, setRenewingAll] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExpiringQuotes();
  }, []);

  const fetchExpiringQuotes = async () => {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          human_uid,
          quote_expires_at,
          subtotal,
          quote_expiration_days,
          customer:customers(name, email)
        `)
        .in('status', ['quoted', 'draft'])
        .not('quote_expires_at', 'is', null)
        .lte('quote_expires_at', sevenDaysFromNow.toISOString())
        .order('quote_expires_at', { ascending: true })
        .limit(10);

      if (error) throw error;

      setQuotes(data as any || []);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleRenewQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase.functions.invoke('renew-quote', {
        body: { orderId: quoteId }
      });

      if (error) throw error;

      toast({
        title: 'Quote Renewed',
        description: 'Quote expiration extended and customer notified',
      });

      fetchExpiringQuotes();
      setSelectedQuotes(prev => {
        const next = new Set(prev);
        next.delete(quoteId);
        return next;
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleBulkRenewal = async () => {
    if (selectedQuotes.size === 0) return;

    setRenewingAll(true);
    try {
      const promises = Array.from(selectedQuotes).map(quoteId =>
        supabase.functions.invoke('renew-quote', {
          body: { orderId: quoteId }
        })
      );

      await Promise.all(promises);

      toast({
        title: 'Quotes Renewed',
        description: `${selectedQuotes.size} quote${selectedQuotes.size !== 1 ? 's' : ''} renewed successfully`,
      });

      fetchExpiringQuotes();
      setSelectedQuotes(new Set());
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setRenewingAll(false);
    }
  };

  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedQuotes.size === quotes.length) {
      setSelectedQuotes(new Set());
    } else {
      setSelectedQuotes(new Set(quotes.map(q => q.id)));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Expiring Quotes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Expiring Quotes
          </CardTitle>
          <CardDescription>Quotes expiring within 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No quotes expiring soon</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Expiring Quotes
            </CardTitle>
            <CardDescription>
              {quotes.length} quote{quotes.length !== 1 ? 's' : ''} expiring within 7 days
            </CardDescription>
          </div>
          {selectedQuotes.size > 0 && (
            <Button
              size="sm"
              onClick={handleBulkRenewal}
              disabled={renewingAll}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${renewingAll ? 'animate-spin' : ''}`} />
              Renew Selected ({selectedQuotes.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotes.length > 1 && (
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              checked={selectedQuotes.size === quotes.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}
        
        {quotes.map((quote) => {
          const daysRemaining = getDaysRemaining(quote.quote_expires_at);
          const isExpired = daysRemaining < 0;
          const isCritical = daysRemaining <= 3 && daysRemaining >= 0;

          return (
            <div
              key={quote.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={selectedQuotes.has(quote.id)}
                onCheckedChange={() => toggleQuoteSelection(quote.id)}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{quote.human_uid}</span>
                  {isExpired ? (
                    <Badge variant="destructive" className="text-xs">
                      Expired
                    </Badge>
                  ) : isCritical ? (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {daysRemaining} days
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {quote.customer.name}
                </div>
                <div className="text-xs font-medium">
                  ${quote.subtotal.toFixed(2)}
                </div>
              </div>

              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/orders/${quote.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRenewQuote(quote.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ExpiringQuotesWidget;
