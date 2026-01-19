import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';

const VERSION_CHECK_INTERVAL = 60000; // Check every 60 seconds

export function useVersionCheck() {
  const initialBuildTime = useRef<string | null>(null);
  const hasShownToast = useRef(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Fetch the index.html with cache-busting to get the latest version
        const response = await fetch(`/index.html?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) return;
        
        const html = await response.text();
        
        // Extract script src hashes which change on each build
        const scriptMatches = html.match(/src="\/assets\/[^"]+\.js"/g);
        const buildSignature = scriptMatches?.join('|') || '';
        
        if (!initialBuildTime.current) {
          // First check - store the current build signature
          initialBuildTime.current = buildSignature;
          return;
        }
        
        // Compare with stored signature
        if (buildSignature !== initialBuildTime.current && !hasShownToast.current) {
          hasShownToast.current = true;
          toast({
            title: "Update Available",
            description: "A new version of the app is available.",
            duration: Infinity, // Don't auto-dismiss
            action: (
              <ToastAction altText="Refresh to update" onClick={() => window.location.reload()}>
                Refresh
              </ToastAction>
            ),
          });
        }
      } catch (error) {
        // Silently fail - network issues shouldn't break the app
        console.debug('Version check failed:', error);
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkForUpdates, 5000);
    
    // Periodic checks
    const interval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);
}
