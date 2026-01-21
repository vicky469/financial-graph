// InactivityTimeout - Automatically logs out user after 8 hours of inactivity
// Activity is synced across all browser tabs

import { useEffect } from "react";
import { db } from "../db/client";

interface InactivityTimeoutProps {
  user: any; // InstantDB user object
}

const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
const ACTIVITY_KEY = 'last_activity_time';
const THROTTLE_INTERVAL = 60 * 1000; // Only update once per minute

export function InactivityTimeout({ user }: InactivityTimeoutProps) {
  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let lastUpdateTime = 0;

    const checkAndLogout = () => {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      if (!lastActivity) return;

      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.log('[Auth] Session expired after 8 hours of inactivity');
        localStorage.removeItem(ACTIVITY_KEY);
        db.auth.signOut();
      }
    };

    const updateActivity = () => {
      const now = Date.now();
      
      // Throttle: only update if more than 1 minute has passed
      if (now - lastUpdateTime < THROTTLE_INTERVAL) {
        return;
      }
      
      lastUpdateTime = now;
      localStorage.setItem(ACTIVITY_KEY, now.toString());
      
      // Reset timeout
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkAndLogout, INACTIVITY_TIMEOUT);
    };

    // Listen for activity in other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY && e.newValue) {
        // Another tab had activity - reset our timeout
        clearTimeout(timeoutId);
        const lastActivity = parseInt(e.newValue);
        const timeRemaining = INACTIVITY_TIMEOUT - (Date.now() - lastActivity);
        
        if (timeRemaining > 0) {
          timeoutId = setTimeout(checkAndLogout, timeRemaining);
        } else {
          checkAndLogout();
        }
      }
    };

    // Listen for activity events in this tab (throttled)
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Listen for activity in other tabs
    window.addEventListener('storage', handleStorageChange);

    // Initial setup
    updateActivity();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  // This component doesn't render anything
  return null;
}
