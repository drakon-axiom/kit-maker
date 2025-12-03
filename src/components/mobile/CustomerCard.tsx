import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, Shield, Trash2, Mail, Phone } from 'lucide-react';

interface CustomerCardProps {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    default_terms: string | null;
  };
  onEdit: (customer: any) => void;
  onDelete: (customer: any) => void;
  onManageAccess: (customerId: string) => void;
}

export const CustomerCard = ({
  customer,
  onEdit,
  onDelete,
  onManageAccess,
}: CustomerCardProps) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-base truncate">{customer.name}</h3>
          {customer.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Phone className="h-3 w-3" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.default_terms && (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Terms: {customer.default_terms}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onManageAccess(customer.id)}
          >
            <Shield className="h-4 w-4 mr-1" />
            Access
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(customer)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(customer)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
