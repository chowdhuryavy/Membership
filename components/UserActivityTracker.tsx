import React, { useEffect } from 'react';
import { db } from '../services/mockSupabase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const UserActivityTracker: React.FC = () => {
  const { user } = useAuth();
  const { currentOutlet } = useSettings();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Try to find a meaningful element (button, link, input, or element with text)
      const element = target.closest('button, a, input, select, textarea, [role="button"]');
      
      if (element || (target.innerText && target.innerText.length < 50)) {
        const el = element || target;
        const tagName = el.tagName.toLowerCase();
        let text = (el as HTMLElement).innerText?.trim() || (el as HTMLInputElement).value?.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
        text = text.replace(/\n/g, ' ').substring(0, 50).trim();
        
        const details = text ? `Clicked '${text}'` : `Clicked ${tagName}`;
        
        // We use a special action type 'INTERACTION'
        // Pass the current outlet ID so it shows up in the logs for this outlet
        db.logAction('INTERACTION', details, currentOutlet?.id); 
      }
    };

    window.addEventListener('click', handleClick, true); // Capture phase to get it before propagation stops

    return () => {
      window.removeEventListener('click', handleClick, true);
    };
  }, [user, currentOutlet]); // Re-bind if user or outlet changes

  return null;
};

export default UserActivityTracker;
