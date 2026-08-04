import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, X } from 'lucide-react';
import FieldCatalogTabs from './FieldCatalogTabs';
import { FIELD_CATALOG_TABS } from './tabRegistry';
import UnsavedDisplayDraftDialog from './display/UnsavedDisplayDraftDialog';

export default function FieldCatalogDrawer({ field, role, catalogFields, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState(FIELD_CATALOG_TABS[0].id);
  const [dirty, setDirty] = useState(false);
  const [saveAction, setSaveAction] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const returnFocusRef = useRef(null);
  const handleSaveActionChange = useCallback(
    action => setSaveAction(() => action),
    []
  );
  useEffect(() => setActiveTab(FIELD_CATALOG_TABS[0].id), [field?.fieldId]);
  if (!field) return null;

  function requestTransition(action, trigger) {
    if (!dirty) {
      action();
      return;
    }
    if (!saveAction) {
      if (window.confirm('Des modifications ne sont pas enregistrées. Fermer quand même?')) action();
      return;
    }
    returnFocusRef.current = trigger || document.activeElement;
    setPendingAction(() => action);
  }

  function requestClose(event) {
    requestTransition(onClose, event.currentTarget);
  }

  function requestTabChange(tabId, trigger) {
    if (tabId === activeTab) return;
    requestTransition(() => {
      setDirty(false);
      setActiveTab(tabId);
    }, trigger);
  }

  function continueEditing() {
    setPendingAction(null);
  }

  function discardAndContinue() {
    const action = pendingAction;
    setPendingAction(null);
    setDirty(false);
    action?.();
  }

  async function saveAndContinue() {
    if (!saveAction || dialogBusy) return;
    setDialogBusy(true);
    const saved = await saveAction();
    setDialogBusy(false);
    if (!saved) return;
    const action = pendingAction;
    setPendingAction(null);
    setDirty(false);
    action?.();
  }

  const tab = FIELD_CATALOG_TABS.find(item => item.id === activeTab) || FIELD_CATALOG_TABS[0];
  const TabContent = tab.component;
  return <div className="field-catalog-drawer" role="dialog" aria-modal="true" aria-label={`Détail du champ ${field.technicalName}`}>
    <section inert={pendingAction ? '' : undefined} aria-hidden={pendingAction ? 'true' : undefined}>
      <button className="field-catalog-close" onClick={requestClose} aria-label="Fermer"><X/></button>
      <span className="field-catalog-eyebrow"><Eye size={16}/> Configuration en brouillon</span><h2>{field.label}</h2>
      <FieldCatalogTabs tabs={FIELD_CATALOG_TABS} activeTab={activeTab} onChange={requestTabChange}/>
      <TabContent
        field={field}
        role={role}
        catalogFields={catalogFields}
        onSaved={onSaved}
        onDirtyChange={setDirty}
        onSaveActionChange={handleSaveActionChange}
      />
    </section>
    <UnsavedDisplayDraftDialog
      open={Boolean(pendingAction)}
      busy={dialogBusy}
      onContinue={continueEditing}
      onDiscard={discardAndContinue}
      onSave={saveAndContinue}
      returnFocus={returnFocusRef}
    />
  </div>;
}
