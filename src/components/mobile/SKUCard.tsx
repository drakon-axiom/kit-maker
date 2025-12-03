import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface PricingTier {
  min_quantity: number;
  max_quantity: number | null;
  price_per_kit: number;
}

interface SKU {
  id: string;
  code: string;
  description: string;
  label_required: boolean;
  price_per_kit: number;
  price_per_piece: number;
  active: boolean;
  use_tier_pricing: boolean;
  is_bundle: boolean;
  pack_size: number;
  pricing_tiers?: PricingTier[];
  sizes?: Array<{ id: string; size_ml: number }>;
  categories?: { id: string; name: string };
}

interface SKUCardProps {
  sku: any;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onEdit: (sku: any) => void;
  onDelete: (sku: any) => void;
}

export const SKUCard = ({
  sku,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
  onEdit,
  onDelete,
}: SKUCardProps) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(sku.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-semibold text-sm">{sku.code}</span>
              <Badge variant={sku.active ? 'default' : 'secondary'}>
                {sku.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate mb-2">
              {sku.description}
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {sku.is_bundle && (
                <Badge variant="outline" className="text-xs">Bundle ({sku.pack_size})</Badge>
              )}
              {sku.label_required && (
                <Badge variant="outline" className="text-xs">Label</Badge>
              )}
              {sku.use_tier_pricing && (
                <Badge variant="outline" className="text-xs">Tiered</Badge>
              )}
              {sku.categories && (
                <Badge variant="secondary" className="text-xs">{sku.categories.name}</Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Kit: ${sku.price_per_kit.toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                Piece: ${sku.price_per_piece.toFixed(2)}
              </span>
            </div>
            {sku.sizes && sku.sizes.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Sizes: {sku.sizes.map(s => `${s.size_ml}ml`).join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Pricing tiers expandable section */}
        {sku.use_tier_pricing && sku.pricing_tiers && sku.pricing_tiers.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start p-0 h-auto text-xs text-muted-foreground"
              onClick={() => onToggleExpand(sku.id)}
            >
              {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              {expanded ? 'Hide' : 'Show'} Pricing Tiers ({sku.pricing_tiers.length})
            </Button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {sku.pricing_tiers.map((tier, idx) => (
                  <div key={idx} className="flex justify-between text-xs bg-muted/50 rounded px-2 py-1">
                    <span>
                      {tier.min_quantity}-{tier.max_quantity || '∞'} units
                    </span>
                    <span className="font-medium">${tier.price_per_kit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(sku)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(sku)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
