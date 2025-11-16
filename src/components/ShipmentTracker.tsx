import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Calendar, ExternalLink, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Shipment {
  id: string;
  tracking_no: string;
  carrier: string | null;
  tracking_status: string | null;
  tracking_location: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  tracking_events: any;
}

interface ShipmentTrackerProps {
  shipment: Shipment | null;
  onUpdate?: () => void;
}

const ShipmentTracker = ({ shipment, onUpdate }: ShipmentTrackerProps) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshTracking = async () => {
    if (!shipment) return;

    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('update-ups-tracking', {
        body: { shipmentId: shipment.id },
      });

      if (error) throw error;

      toast.success('Tracking information updated');
      onUpdate?.();
    } catch (error: any) {
      console.error('Refresh tracking error:', error);
      toast.error('Failed to refresh tracking information');
    } finally {
      setRefreshing(false);
    }
  };
  if (!shipment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipment Tracking
          </CardTitle>
          <CardDescription>No shipment information available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Your order hasn't shipped yet</p>
            <p className="text-sm mt-2">You'll receive tracking information once it ships</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrackingUrl = () => {
    const carrier = shipment.carrier?.toLowerCase() || '';
    const tracking = shipment.tracking_no;
    
    if (carrier.includes('ups')) {
      return `https://www.ups.com/track?tracknum=${tracking}`;
    }
    if (carrier.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
    }
    if (carrier.includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
    }
    if (carrier.includes('dhl')) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
    }
    return `https://www.google.com/search?q=${tracking}+tracking`;
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-muted';
    const s = status.toLowerCase();
    if (s.includes('delivered')) return 'bg-green-500';
    if (s.includes('transit') || s.includes('picked')) return 'bg-blue-500';
    if (s.includes('exception') || s.includes('delayed')) return 'bg-yellow-500';
    return 'bg-muted';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Shipment Tracking
        </CardTitle>
        <CardDescription>Real-time tracking information for your order</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tracking Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tracking Number:</span>
              <span className="font-mono font-semibold">{shipment.tracking_no}</span>
            </div>
            {shipment.carrier && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Carrier:</span>
                <Badge variant="outline">{shipment.carrier}</Badge>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshTracking}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={getTrackingUrl()} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Track on Carrier Site
              </a>
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        {shipment.tracking_status && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={getStatusColor(shipment.tracking_status)}>
              {shipment.tracking_status}
            </Badge>
          </div>
        )}

        {/* Location */}
        {shipment.tracking_location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Current Location:</span>
            <span className="font-medium">{shipment.tracking_location}</span>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {shipment.shipped_at && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Shipped On
              </div>
              <div className="text-sm font-medium">
                {format(new Date(shipment.shipped_at), 'MMM dd, yyyy')}
              </div>
            </div>
          )}
          {shipment.estimated_delivery && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Estimated Delivery
              </div>
              <div className="text-sm font-medium">
                {format(new Date(shipment.estimated_delivery), 'MMM dd, yyyy')}
              </div>
            </div>
          )}
        </div>

        {/* Tracking Events */}
        {shipment.tracking_events && Array.isArray(shipment.tracking_events) && shipment.tracking_events.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Tracking History</h4>
            <div className="space-y-3">
              {shipment.tracking_events.slice(0, 5).map((event: any, index: number) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="relative">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    {index < shipment.tracking_events.length - 1 && (
                      <div className="absolute top-3 left-1 w-px h-6 bg-border" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-medium">{event.status || event.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.location && <span>{event.location} • </span>}
                      {event.timestamp && format(new Date(event.timestamp), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShipmentTracker;
