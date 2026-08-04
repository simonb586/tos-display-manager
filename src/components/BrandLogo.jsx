import React from 'react';

const OFFICIAL_LOGO_PATH = '/assets/logo-groupe-tos-officiel.png';

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
