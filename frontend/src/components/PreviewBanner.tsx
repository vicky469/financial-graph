import { useState, useEffect } from 'react';
import { db } from '../db/client';

export function PreviewBanner() {
  const { user } = db.useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset banner when user changes (logout/login)
  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div 
      className="duration-200 animate-in fade-in slide-in-from-top-12" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 9999,
        backgroundColor: 'hsl(155, 80%, 8%)',
        borderBottom: '1px solid hsl(155, 60%, 18%)',
      }}
    >
      <div className="w-full mx-auto" style={{ padding: '8px 0' }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="ml-1"></div>
          <div 
            className="text-center flex items-center gap-1"
            style={{ 
              fontSize: '14px',
              color: 'hsl(150, 60%, 70%)',
              textShadow: '0 0 8px hsl(150, 60%, 70%, 0.4), 0 0 16px hsl(150, 60%, 70%, 0.2)',
            }}
          >
            Preview Mode: We're hardening security before public launch.
          </div>
          <div className="flex justify-end">
            <button 
              onClick={handleDismiss}
              className="inline-flex items-center justify-center h-6 w-6 p-1 mr-1 rounded-full transition-colors" 
              style={{
                backgroundColor: 'hsl(155, 95%, 4%)',
                border: '1px solid hsl(155, 75%, 14%)',
                cursor: 'pointer',
              }}
              type="button" 
              aria-label="Dismiss notification"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(155, 85%, 8%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(155, 95%, 4%)';
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth="2" 
                stroke="currentColor" 
                style={{ width: '14px', height: '14px', color: 'hsl(150, 60%, 70%)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
