import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeValidationConfig,
  validationConfigChanged,
  validationConfigFromField,
  validationProtectionReasons
} from '../lib/fieldCatalogValidationDraft.js';
import { saveFieldValidationDraft } from '../services/fieldCatalogValidationWriteService.js';

export default function useFieldValidationDraft({ field, role, onSaved, onDirtyChange }) {
  const loaded = useMemo(() => validationConfigFromField(field), [field]);
  const [initial, setInitial] = useState(loaded);
  const [draft, setDraft] = useState(loaded);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(field?.updated_at || null);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const submittingRef = useRef(false);
  const requestRef = useRef(0);
  const reasons = useMemo(() => validationProtectionReasons(field), [field]);
  const protectedField = reasons.length > 0;
  const validation = useMemo(() => normalizeValidationConfig(draft), [draft]);
  const dirty = useMemo(() => validationConfigChanged(initial, draft), [initial, draft]);

  useEffect(() => {
    setInitial(loaded); setDraft(loaded); setExpectedUpdatedAt(field?.updated_at || null);
    setErrors({}); setStatus('idle'); setMessage('');
    requestRef.current += 1; submittingRef.current = false;
  }, [field?.fieldId, field?.updated_at]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

  const patch = useCallback((key, value) => {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors({}); setStatus('idle'); setMessage('');
  }, []);
  const cancel = useCallback(() => {
    setDraft(initial); setErrors({}); setStatus('idle'); setMessage('Modifications annulées.');
  }, [initial]);
  const save = useCallback(async () => {
    if (submittingRef.current || protectedField) return false;
    const checked = normalizeValidationConfig(draft);
    if (!checked.valid) {
      setErrors(checked.errors); setStatus('error'); setMessage(Object.values(checked.errors)[0]);
      return false;
    }
    if (!validationConfigChanged(initial, checked.normalized)) {
      setStatus('no_change'); setMessage('Aucun changement à enregistrer.'); return true;
    }
    if (!expectedUpdatedAt) {
      setStatus('error'); setMessage('L’horodatage du brouillon est indisponible. Rechargez le catalogue.'); return false;
    }
    submittingRef.current = true;
    const requestId = ++requestRef.current;
    setStatus('saving'); setMessage('Enregistrement du brouillon de validation…');
    try {
      const result = await saveFieldValidationDraft({ field, draft: checked.normalized, expectedUpdatedAt, role });
      if (requestId !== requestRef.current) return false;
      const next = result?.validationConfig || checked.normalized;
      setInitial(next); setDraft(next); setExpectedUpdatedAt(result?.updatedAt || expectedUpdatedAt);
      setErrors({}); setStatus(result?.changed === false ? 'no_change' : 'saved');
      setMessage(result?.changed === false ? 'Aucun changement à enregistrer.' : 'Brouillon de validation enregistré.');
      await onSaved?.(field.fieldId, next);
      return true;
    } catch (error) {
      if (requestId !== requestRef.current) return false;
      setErrors(error.validationErrors || (error.field ? { [error.field]: error.message } : {}));
      setStatus(error.code === 'stale_draft' ? 'stale_draft' : 'error');
      setMessage(error.code === 'stale_draft'
        ? 'Un autre administrateur a modifié ce brouillon. Vos modifications locales sont conservées; rechargez avant de réessayer.'
        : `${error.message || 'Une erreur est survenue.'} Vos modifications locales ont été conservées.`);
      return false;
    } finally {
      if (requestId === requestRef.current) submittingRef.current = false;
    }
  }, [draft, expectedUpdatedAt, field, initial, onSaved, protectedField, role]);

  return { initial, draft, errors, status, message, dirty, validation,
    submitting: status === 'saving', protectedField, protectionReasons: reasons,
    patch, cancel, save };
}
