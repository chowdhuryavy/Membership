// Perfection Brand Asset & QR Emblem Utility

export const PERFECTION_P_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="pBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#3730a3" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <filter id="pDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- Outer Safety Border (Guarantees QR Contrast) -->
  <rect x="3" y="3" width="114" height="114" rx="32" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
  <!-- Brand Gradient Badge -->
  <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#pBrandGrad)" filter="url(#pDropShadow)" />
  <!-- Inner Ring Accent -->
  <rect x="12" y="12" width="96" height="96" rx="24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
  <!-- Stylized Modern Luxury "P" for Perfection -->
  <path 
    d="M42 30 h24 c14 0 24 10 24 24 s-10 24 -24 24 h-14 v16 c0 4 -2 6 -5 6 s-5 -2 -5 -6 v-64 Z M52 40 v24 h12 c8 0 14 -6 14 -12 s-6 -12 -14 -12 Z" 
    fill="#ffffff" 
  />
  <!-- Sparkle Accent -->
  <circle cx="84" cy="40" r="5" fill="url(#accentGrad)">
    <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
  </circle>
</svg>
`)}`;

export const PERFECTION_QR_IMAGE_SETTINGS = {
  src: PERFECTION_P_LOGO_SVG,
  height: 46,
  width: 46,
  excavate: true,
};

import React from 'react';

export const PerfectionLogo: React.FC<{ className?: string, animate?: boolean }> = ({ className = "w-full h-full", animate = true }) => {
  return (
    <svg viewBox="0 0 120 120" className={className}>
      <defs>
        <linearGradient id="pBrandGradComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#3730a3" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="accentGradComp" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <filter id="pDropShadowComp" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.25"/>
        </filter>
      </defs>
      <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#pBrandGradComp)" filter="url(#pDropShadowComp)" />
      <rect x="12" y="12" width="96" height="96" rx="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <path 
        d="M42 30 h24 c14 0 24 10 24 24 s-10 24 -24 24 h-14 v16 c0 4 -2 6 -5 6 s-5 -2 -5 -6 v-64 Z M52 40 v24 h12 c8 0 14 -6 14 -12 s-6 -12 -14 -12 Z" 
        fill="#ffffff" 
      />
      <circle cx="84" cy="40" r="5" fill="url(#accentGradComp)">
        {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
};
