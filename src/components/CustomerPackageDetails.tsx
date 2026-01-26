import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OrderPackage {
  id: string;
  package_number: number;
  length_inches: number;
  width_inches: number;
  height_inches: number;
  weight_oz: number;
  item_count: number;
  notes: string | null;
}

interface CustomerPackageDetailsProps {
  orderId: string;
  orderStatus: string;
}

export function CustomerPackageDetails({ orderId, orderStatus }: CustomerPackageDetailsProps) {
  const [packages, setPackages] = useState<OrderPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Only show for these statuses where packing has been done
  const showForStatuses = ['in_packing', 'packed', 'awaiting_invoice', 'awaiting_payment', 'ready_to_ship', 'shipped'];
  
  useEffect(() => {
    if (!showForStatuses.includes(orderStatus)) {
      setLoading(false);
      return;
    }

    const fetchPackages = async () => {
      const { data, error } = await supabase
        .from('order_packages')
        .select('*')
        .eq('so_id', orderId)
        .order('package_number', { ascending: true });

      if (!error && data) {
        setPackages(data);
      }
      setLoading(false);
    };

    fetchPackages();
  }, [orderId, orderStatus]);

  // Don't show if status doesn't warrant it or no packages
  if (!showForStatuses.includes(orderStatus) || loading || packages.length === 0) {
    return null;
  }

  const formatWeight = (weightOz: number) => {
    const lbs = Math.floor(weightOz / 16);
    const oz = Math.round(weightOz % 16);
    if (lbs === 0) return `${oz} oz`;
    if (oz === 0) return `${lbs} lbs`;
    return `${lbs} lbs ${oz} oz`;
  };

  const totalWeight = packages.reduce((sum, pkg) => sum + pkg.weight_oz, 0);
  const totalItems = packages.reduce((sum, pkg) => sum + pkg.item_count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Package Details
        </CardTitle>
        <CardDescription className="text-sm">
          {packages.length} package{packages.length !== 1 ? 's' : ''} • {totalItems} item{totalItems !== 1 ? 's' : ''} • {formatWeight(totalWeight)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Package {pkg.package_number}</span>
                <span className="text-xs text-muted-foreground">
                  {pkg.item_count} item{pkg.item_count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>{' '}
                  <span className="font-medium">
                    {pkg.length_inches}" × {pkg.width_inches}" × {pkg.height_inches}"
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Weight:</span>{' '}
                  <span className="font-medium">{formatWeight(pkg.weight_oz)}</span>
                </div>
              </div>
              {pkg.notes && (
                <p className="text-xs text-muted-foreground mt-2">{pkg.notes}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
