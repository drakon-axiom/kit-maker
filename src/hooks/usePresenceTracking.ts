import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePresenceTracking = () => {
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (!user || userRole !== 'customer') return;

    const channel = supabase.channel('online-customers', {
      config: {
        presence: {
          key: 'customers',
        },
      },
    });

    const trackPresence = async () => {
      // Get customer profile info
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email')
        .eq('user_id', user.id)
        .single();

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            email: user.email,
            name: customer?.name || user.email,
            role: 'customer',
            online_at: new Date().toISOString(),
          });
        }
      });
    };

    trackPresence();

    return () => {
      channel.unsubscribe();
    };
  }, [user, userRole]);
};
