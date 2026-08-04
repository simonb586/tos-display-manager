import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  displayDraftChangeSummary,
  displayDraftFromField
} from '../lib/fieldCatalogDisplayDraft.js';
import {
  displayOrderCollision,
  displayProtectionReasons,
  parseDisplayOrderInput
} from '../lib/fieldCatalogDisplayPresentation.js';
import { validateFieldDisplayDraft } from '../services/fieldCatalogDisplayValidationService.js';
import { saveFieldDisplayDraft } from '../services/fieldCatalogDisplayWriteService.js';

const orderText = draft => draft.displayOrder === null ? '' : String(draft.displayOrder);

export default function useFieldDisplayDraft({
  field,
  role,
  catalogFields,
  onSaved,
  onDirtyChange
}) {
  const loaded = useMemo(() => displayDraftFromField(field), [field]);
  const [initial, setInitial] = useState(loaded);
  const [draft, setDraft] = useState(loaded);
  const [rawDisplayOrder, setRawDisplayOrder] = useState(orderText(loaded));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const submittingRef = useRef(false);
  const requestRef = useRef(0);
  const fieldKey = field?.fieldId || '';
  const protectionReasons = useMemo(() => displayProtectionReasons(field), [field]);
  const protectedField = protectionReasons.length > 0;
  const parsedOrder = useMemo(
    () => parseDisplayOrderInput(rawDisplayOrder),
    [rawDisplayOrder]
  );
  const candidate = useMemo(
    () => ({ ...draft, displayOrder: parsedOrder.valid ? parsedOrder.value : draft.displayOrder }),
    [draft, parsedOrder]
  );
  const dirty = useMemo(
    () => !parsedOrder.valid ||
      displayDraftChangeSummary(initial, candidate).changed ||
      rawDisplayOrder !== orderText(initial),
    [candidate, initial, parsedOrder.valid, rawDisplayOrder]
  );
  const collision = useMemo(
    () => parsedOrder.valid
      ? displayOrderCollision(field, catalogFields, parsedOrder.value)
      : null,
    [catalogFields, field, parsedOrder]
  );

  useEffect(() => {
    setInitial(loaded);
    setDraft(loaded);
    setRawDisplayOrder(orderText(loaded));
    setErrors({});
    setStatus('idle');
    setMessage('');
    requestRef.current += 1;
    submittingRef.current = false;
  }, [fieldKey]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return undefined;
    const preventLoss = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  const clearTransientMessage = useCallback(() => {
    setMessage('');
    setStatus('idle');
  }, []);

  const patchChoice = useCallback((name, value) => {
    setDraft(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined, contract: undefined }));
    clearTransientMessage();
  }, [clearTransientMessage]);

  const patchDisplayOrder = useCallback(value => {
    setRawDisplayOrder(value);
    setErrors(current => ({ ...current, displayOrder: undefined, contract: undefined }));
    clearTransientMessage();
  }, [clearTransientMessage]);

  const cancel = useCallback(() => {
    setDraft(initial);
    setRawDisplayOrder(orderText(initial));
    setErrors({});
    setStatus('idle');
    setMessage('Modifications annulées.');
  }, [initial]);

  const save = useCallback(async () => {
    if (submittingRef.current || protectedField) return false;

    const currentParsedOrder = parseDisplayOrderInput(rawDisplayOrder);
    if (!currentParsedOrder.valid) {
      setErrors({ displayOrder: currentParsedOrder.error });
      setStatus('error');
      setMessage(currentParsedOrder.error);
      return false;
    }

    const normalizedCandidate = {
      ...draft,
      displayOrder: currentParsedOrder.value
    };
    const validation = validateFieldDisplayDraft(field, normalizedCandidate, role);
    if (!validation.valid) {
      setErrors(validation.errors);
      setStatus('error');
      setMessage(Object.values(validation.errors)[0]);
      return false;
    }

    const summary = displayDraftChangeSummary(initial, validation.normalized);
    if (!summary.changed) {
      setErrors({});
      setStatus('no_change');
      setMessage('Aucun changement à enregistrer.');
      return true;
    }

    submittingRef.current = true;
    const requestId = ++requestRef.current;
    setErrors({});
    setStatus('saving');
    setMessage('Enregistrement du brouillon…');
    try {
      const result = await saveFieldDisplayDraft({
        field,
        draft: validation.normalized,
        role
      });
      if (requestId !== requestRef.current) return false;
      setInitial(validation.normalized);
      setDraft(validation.normalized);
      setRawDisplayOrder(orderText(validation.normalized));
      setStatus(result?.changed === false ? 'no_change' : 'saved');
      setMessage(
        result?.changed === false
          ? 'Aucun changement à enregistrer.'
          : 'Brouillon enregistré.'
      );
      await onSaved?.(field.fieldId, validation.normalized);
      return true;
    } catch (error) {
      if (requestId !== requestRef.current) return false;
      setErrors(error.validationErrors || {});
      setStatus('error');
      setMessage(
        `${error.message || 'Une erreur est survenue pendant l’enregistrement.'} ` +
        'Vos modifications locales ont été conservées.'
      );
      return false;
    } finally {
      if (requestId === requestRef.current) submittingRef.current = false;
    }
  }, [draft, field, initial, onSaved, protectedField, rawDisplayOrder, role]);

  return {
    initial,
    draft,
    rawDisplayOrder,
    errors,
    status,
    message,
    dirty,
    submitting: status === 'saving',
    protectedField,
    protectionReasons,
    collision,
    patchChoice,
    patchDisplayOrder,
    cancel,
    save
  };
}
