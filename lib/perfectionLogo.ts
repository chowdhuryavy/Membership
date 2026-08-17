// Perfection Brand Asset & QR Emblem Utility

export const PERFECTION_P_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="pBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#3730a3" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="pTextGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e0e7ff" />
    </linearGradient>
    <filter id="pDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- Outer Safety Border (Guarantees QR Contrast) -->
  <rect x="3" y="3" width="114" height="114" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
  <!-- Brand Gradient Badge -->
  <rect x="8" y="8" width="104" height="104" rx="24" fill="url(#pBrandGrad)" filter="url(#pDropShadow)" />
  <!-- Inner Ring Accent -->
  <rect x="12" y="12" width="96" height="96" rx="20" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
  <!-- Stylized Modern Luxury "P" for Perfection -->
  <path d="M36 30 h24 c14 0 24 8 24 20 c0 12 -10 20 -24 20 h-12 v20 h-12 Z M48 40 v20 h12 c7 0 12 -4 12 -10 c0 -6 -5 -10 -12 -10 Z" fill="url(#pTextGrad)" />
</svg>
`)}`;

export const PERFECTION_QR_IMAGE_SETTINGS = {
  src: PERFECTION_P_LOGO_SVG,
  height: 46,
  width: 46,
  excavate: true,
};
