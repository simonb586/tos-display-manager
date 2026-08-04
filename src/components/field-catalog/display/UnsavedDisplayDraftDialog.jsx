import React, { useEffect, useRef } from 'react';

export default function UnsavedDisplayDraftDialog({
  open,
  busy,
  onContinue,
  onDiscard,
  onSave,
  returnFocus
}) {
  const dialogRef = useRef(null);
  const firstButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstButtonRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onContinue();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocus?.current?.focus?.();
    };
  }, [busy, onContinue, open, returnFocus]);

  if (!open) return null;
  return <div className="field-display-dialog-backdrop">
    <div
      ref={dialogRef}
      className="field-display-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-display-unsaved-title"
      aria-describedby="field-display-unsaved-description"
    >
      <h3 id="field-display-unsaved-title">Changements non enregistrés</h3>
      <p id="field-display-unsaved-description">Des changements non enregistrés seront perdus.</p>
      <div>
        <button ref={firstButtonRef} type="button" disabled={busy} onClick={onContinue}>Continuer l’édition</button>
        <button type="button" disabled={busy} onClick={onDiscard}>Abandonner les changements</button>
        <button type="button" disabled={busy} onClick={onSave}>
          {busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
      </div>
    </div>
  </div>;
}
