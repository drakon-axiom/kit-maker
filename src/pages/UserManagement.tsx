import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, UserCog, Shield, Wrench } from 'lucide-react';

type AppRole = 'admin' | 'operator' | 'customer';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
}

const UserManagement = () => {
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AppRole>>({});

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('email');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles.map(r => [r.user_id, r.role as AppRole]));

      return profiles.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || null,
      })) as UserWithRole[];
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First, delete existing role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then insert new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (insertError) throw insertError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success(`Role updated to ${variables.role}`);
      setSelectedRoles(prev => {
        const newState = { ...prev };
        delete newState[variables.userId];
        return newState;
      });
    },
    onError: (error) => {
      toast.error('Failed to update role');
      console.error('Error updating role:', error);
    },
  });

  const getRoleIcon = (role: AppRole | null) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'operator':
        return <Wrench className="h-3 w-3" />;
      case 'customer':
        return <UserCog className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getRoleVariant = (role: AppRole | null) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'operator':
        return 'default';
      case 'customer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Separate internal users (admin/operator) from customers
  const internalUsers = users?.filter(u => u.role === 'admin' || u.role === 'operator' || !u.role) || [];
  const customerUsers = users?.filter(u => u.role === 'customer') || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Internal User Management</CardTitle>
          <CardDescription>
            Assign admin and operator roles to internal employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {internalUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{user.full_name || user.email}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={getRoleVariant(user.role)} className="gap-1">
                    {getRoleIcon(user.role)}
                    {user.role || 'No role'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedRoles[user.id] || ''}
                      onValueChange={(value) =>
                        setSelectedRoles(prev => ({ ...prev, [user.id]: value as AppRole }))
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="operator">Operator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedRoles[user.id] || assignRoleMutation.isPending}
                      onClick={() =>
                        assignRoleMutation.mutate({
                          userId: user.id,
                          role: selectedRoles[user.id],
                        })
                      }
                    >
                      {assignRoleMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Assign'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {internalUsers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No internal users found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Users</CardTitle>
          <CardDescription>
            Customers are automatically assigned their role on signup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {customerUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{user.full_name || user.email}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  {getRoleIcon(user.role)}
                  Customer
                </Badge>
              </div>
            ))}
            {customerUsers.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No customers found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
