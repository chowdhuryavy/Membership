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
        
        if (!text && tagName !== 'input') return;

        // Smart Detail Formatting
        let details = `Interacted with [${text || tagName}]`;
        
        // Contextual labeling
        const nav = el.closest('nav') || el.closest('aside');
        const modal = el.closest('[role="dialog"]') || el.closest('.modal');
        const form = el.closest('form');

        if (nav) {
          details = `Navigation: [${text}]`;
        } else if (el.closest('.calendar') || text.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateStr = text.match(/\d{4}-\d{2}-\d{2}/) ? text.match(/\d{4}-\d{2}-\d{2}/)?.[0] : text;
          details = `Calendar: Selected ${dateStr}`;
        } else if (tagName === 'button' && (text.toLowerCase().includes('save') || text.toLowerCase().includes('update') || text.toLowerCase().includes('add'))) {
          details = `Action -> [${text}] triggered`;
        } else if (tagName === 'input' && (el as HTMLInputElement).type === 'text') {
           const label = el.closest('label')?.innerText || el.getAttribute('placeholder') || 'Input Field';
           details = `Data Entry: Edited [${label}]`;
        } else if (text.length < 3 && !isNaN(Number(text)) && !el.closest('.calendar')) {
          return;
        }

        if (modal) details = `[Modal] ${details}`;
        if (form && !details.includes('Action')) details = `[Form] ${details}`;

        // We use a special action type 'INTERACTION'
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
