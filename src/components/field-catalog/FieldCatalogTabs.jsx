import React from 'react';

export default function FieldCatalogTabs({ tabs, activeTab, onChange }) {
  if (tabs.length <= 1) return null;
  return <nav className="field-catalog-tabs" aria-label="Sections du champ">
    {tabs.map(tab => <button key={tab.id} className={tab.id === activeTab ? 'active' : ''} onClick={event => onChange(tab.id, event.currentTarget)}>{tab.label}</button>)}
  </nav>;
}
