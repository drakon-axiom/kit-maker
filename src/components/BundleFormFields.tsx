import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface BundleFormFieldsProps {
  isBundle: boolean;
  packSize: number;
  bundleProductPrice: string;
  bundlePackagingPrice: string;
  bundleLabelingPrice: string;
  bundleInsertsPrice: string;
  bundleLaborPrice: string;
  bundleOverheadPrice: string;
  insertsOptional: boolean;
  pricePerKit: string;
  onChange: (field: string, value: any) => void;
}

export const BundleFormFields = ({
  isBundle,
  packSize,
  bundleProductPrice,
  bundlePackagingPrice,
  bundleLabelingPrice,
  bundleInsertsPrice,
  bundleLaborPrice,
  bundleOverheadPrice,
  insertsOptional,
  pricePerKit,
  onChange,
}: BundleFormFieldsProps) => {
  // Calculate costs based on whether it's a bundle or single item
  const totalCost = isBundle 
    ? parseFloat(bundleProductPrice || '0') +
      parseFloat(bundlePackagingPrice || '0') +
      parseFloat(bundleLabelingPrice || '0') +
      parseFloat(bundleInsertsPrice || '0') +
      parseFloat(bundleLaborPrice || '0') +
      parseFloat(bundleOverheadPrice || '0')
    : parseFloat(bundleProductPrice || '0') +
      parseFloat(bundleLabelingPrice || '0') +
      parseFloat(bundleLaborPrice || '0') +
      parseFloat(bundleOverheadPrice || '0');

  const sellingPrice = parseFloat(pricePerKit || '0');
  const margin = sellingPrice - totalCost;
  const marginPercentage = totalCost > 0 ? (margin / totalCost) * 100 : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">
            {isBundle ? 'Bundle Configuration' : 'Production Cost Tracking'}
          </CardTitle>
        </div>
        <CardDescription>
          {isBundle 
            ? 'Configure multi-pack products with detailed pricing breakdown'
            : 'Track production costs and margin for this product'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch
            id="is_bundle"
            checked={isBundle}
            onCheckedChange={(checked) => onChange('is_bundle', checked)}
          />
          <Label htmlFor="is_bundle">This is a bundle/multi-pack product</Label>
        </div>

        {isBundle ? (
          <>
            <div>
              <Label htmlFor="pack_size">Pack Size *</Label>
              <Input
                id="pack_size"
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => onChange('pack_size', parseInt(e.target.value) || 1)}
                required
                placeholder="e.g., 2, 4, 6"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of units in this bundle
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bundle_product_price">Product Cost</Label>
                <Input
                  id="bundle_product_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleProductPrice}
                  onChange={(e) => onChange('bundle_product_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_packaging_price">Packaging Cost</Label>
                <Input
                  id="bundle_packaging_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundlePackagingPrice}
                  onChange={(e) => onChange('bundle_packaging_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_labeling_price">Labeling Cost</Label>
                <Input
                  id="bundle_labeling_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleLabelingPrice}
                  onChange={(e) => onChange('bundle_labeling_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_inserts_price">Inserts Cost</Label>
                <Input
                  id="bundle_inserts_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleInsertsPrice}
                  onChange={(e) => onChange('bundle_inserts_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_labor_price">Labor Cost</Label>
                <Input
                  id="bundle_labor_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleLaborPrice}
                  onChange={(e) => onChange('bundle_labor_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_overhead_price">Overhead Cost</Label>
                <Input
                  id="bundle_overhead_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleOverheadPrice}
                  onChange={(e) => onChange('bundle_overhead_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="inserts_optional"
                checked={insertsOptional}
                onCheckedChange={(checked) => onChange('inserts_optional', checked)}
              />
              <Label htmlFor="inserts_optional">Inserts are optional</Label>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Manufacturing Cost:</span>
                <span className="text-xl font-bold">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Selling Price (per kit):</span>
                <span className="text-xl font-bold">
                  ${sellingPrice.toFixed(2)}
                </span>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Profit Margin:</span>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      ${margin.toFixed(2)}
                    </span>
                    {totalCost > 0 && (
                      <span className={`block text-sm ${margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        ({marginPercentage >= 0 ? '+' : ''}{marginPercentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-2">
                {packSize}-pack bundle with {insertsOptional ? 'optional' : 'included'} inserts
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Single Item Cost Tracking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bundle_product_price">Product Cost</Label>
                <Input
                  id="bundle_product_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleProductPrice}
                  onChange={(e) => onChange('bundle_product_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_labeling_price">Labeling Cost</Label>
                <Input
                  id="bundle_labeling_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleLabelingPrice}
                  onChange={(e) => onChange('bundle_labeling_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_labor_price">Labor Cost</Label>
                <Input
                  id="bundle_labor_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleLaborPrice}
                  onChange={(e) => onChange('bundle_labor_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="bundle_overhead_price">Overhead Cost</Label>
                <Input
                  id="bundle_overhead_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bundleOverheadPrice}
                  onChange={(e) => onChange('bundle_overhead_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Production Cost:</span>
                <span className="text-xl font-bold">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold">Selling Price (per kit):</span>
                <span className="text-xl font-bold">
                  ${sellingPrice.toFixed(2)}
                </span>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Profit Margin:</span>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      ${margin.toFixed(2)}
                    </span>
                    {totalCost > 0 && (
                      <span className={`block text-sm ${margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        ({marginPercentage >= 0 ? '+' : ''}{marginPercentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
