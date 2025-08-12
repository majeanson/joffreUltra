'use client';

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  // Check if we're in the browser
  if (typeof window === 'undefined') return;

  // Set initial status
  setIsOnline(navigator.onLine);

  // Event handlers
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

return isOnline;
}
