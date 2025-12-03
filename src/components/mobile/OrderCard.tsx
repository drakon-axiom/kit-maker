import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Order {
  id: string;
  human_uid: string;
  status: string;
  customer?: {
    name: string;
  };
  subtotal: number;
  deposit_required: boolean;
  deposit_status: string;
  created_at: string;
}

interface OrderCardProps {
  order: Order;
  selected: boolean;
  onSelect: (id: string) => void;
  onPrintLabel: (order: Order, type: 'order' | 'shipping' | 'batch') => void;
  statusColors: Record<string, string>;
  formatStatus: (status: string) => string;
}

export const OrderCard = ({
  order,
  selected,
  onSelect,
  onPrintLabel,
  statusColors,
  formatStatus,
}: OrderCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(order.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-semibold text-sm">{order.human_uid}</span>
              <Badge className={statusColors[order.status] || 'bg-muted'} variant="secondary">
                {formatStatus(order.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate mb-1">
              {order.customer?.name || 'No customer'}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>${order.subtotal.toFixed(2)}</span>
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            {order.deposit_required && (
              <div className="mt-2">
                <Badge variant={order.deposit_status === 'paid' ? 'default' : 'outline'} className="text-xs">
                  Deposit: {order.deposit_status}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPrintLabel(order, 'order')}>
                Order Label
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPrintLabel(order, 'shipping')}>
                Shipping Label
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPrintLabel(order, 'batch')}>
                Batch Labels
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};
