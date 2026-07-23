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
        const isPassword = (el as HTMLInputElement).type === 'password';
        
        let text = (el as HTMLElement).innerText?.trim() || 
                   (isPassword ? '********' : (el as HTMLInputElement).value?.trim()) || 
                   el.getAttribute('aria-label') || 
                   el.getAttribute('title') || 
                   '';
        text = text.replace(/\n/g, ' ').substring(0, 50).trim();
        
        // If it's a small element like an icon with no text/label, skip it unless it's an input
        if (!text && tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') return;

        const pageTitle = document.title.split('|')[0].trim();
        const pathName = window.location.hash.replace('#', '') || '/';
        
        // Smart Detail Formatting
        let details = `User interacted with [${text || tagName}] on ${pageTitle}`;
        
        // Contextual labeling
        const nav = el.closest('nav') || el.closest('aside');
        const modal = el.closest('[role="dialog"]') || el.closest('.modal');
        const form = el.closest('form');
        const table = el.closest('table');

        if (nav) {
          details = `Navigation: User clicked [${text || 'Menu Item'}] to navigate ${pathName}`;
        } else if (el.closest('.calendar') || text.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateStr = text.match(/\d{4}-\d{2}-\d{2}/) ? text.match(/\d{4}-\d{2}-\d{2}/)?.[0] : text;
          details = `Calendar: User selected ${dateStr || 'a date'} in ${pageTitle}`;
        } else if (tagName === 'button') {
          const actionWord = text.toLowerCase().includes('save') ? 'Saved' : 
                             text.toLowerCase().includes('update') ? 'Updated' : 
                             text.toLowerCase().includes('add') ? 'Added' : 
                             text.toLowerCase().includes('delete') ? 'Deleted' : 'Clicked';
          details = `${actionWord} [${text || 'Button'}] in ${pageTitle}`;
        } else if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
           const label = el.closest('label')?.innerText?.trim() || el.getAttribute('placeholder') || el.getAttribute('name') || 'Field';
           let val = (el as HTMLInputElement).value;
           if ((el as HTMLInputElement).type === 'checkbox') {
             val = (el as HTMLInputElement).checked ? 'Checked' : 'Unchecked';
           } else if (isPassword) {
             val = '********';
           }
           details = `Data Entry: User interacted with [${label}] (Value: ${val}) in ${pageTitle}`;
        } else if (table) {
           details = `Table Interaction: User selected row/item [${text.substring(0, 20)}...] in ${pageTitle}`;
        }

        if (modal) details = `[Modal] ${details}`;
        if (form && !details.includes('Saved') && !details.includes('Updated')) details = `[Form] ${details}`;

        // Final safety check
        if (!details || details.trim() === '') {
            details = `Activity: ${tagName.toUpperCase()} interaction on ${pageTitle}`;
        }

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
