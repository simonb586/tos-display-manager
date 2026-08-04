import React from 'react';

// Variante web transparente strictement dérivée de l'actif officiel conservé dans public/assets.
const OFFICIAL_LOGO_PATH = '/assets/logo-groupe-tos-web-transparent.png';

export default function BrandLogo({ className = '', priority = false }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={OFFICIAL_LOGO_PATH}
      alt="Groupe TOS"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
