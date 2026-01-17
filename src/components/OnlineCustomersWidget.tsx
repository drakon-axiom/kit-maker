import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Circle } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface OnlineUser {
  id: string;
  email: string;
  name: string;
  online_at: string;
}

const OnlineCustomersWidget = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const presenceChannel = supabase.channel('online-customers', {
      config: {
        presence: {
          key: 'customers',
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.role === 'customer') {
              users.push({
                id: presence.user_id,
                email: presence.email || 'Unknown',
                name: presence.name || presence.email || 'Unknown Customer',
                online_at: presence.online_at,
              });
            }
          });
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe();

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Online Customers
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          {onlineUsers.length} online
        </Badge>
      </CardHeader>
      <CardContent>
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customers currently online</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
              >
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                <span className="font-medium truncate flex-1">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {user.email}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnlineCustomersWidget;
